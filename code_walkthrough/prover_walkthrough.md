# Prover walkthrough

The goal of this article is to show you how boojum prover works end to end - together with some (simplified) code snippets - I will keep the function names, but try to remove/hide some of the parameters to make things more readable.


Whole journey starts here:

```rust
pub fn prove_image_execution(
    bytecode: &[u32],
    non_determinism: ND,
    risc_v_circuit_precomputations: &MainCircuitPrecomputations<A>,
) -> (Vec<Proof>, Vec<FinalRegisterValue>)
```

We pass bytecode of the program that we want to run, non_determinism (a.k.a IO) - see [how io works](non_determinism.md) - and a compiled circuit together with some pre-computed static data.

What we get back is a list of proofs - as our program could run long enough to no longer fit within a single circuit.

After we got the final proofs, we could either return them directly to caller OR - if there are too many - we could apply recursion to limit their amount (please see (recursion)[recursion.md] for more info).


The first thing that happens inside, is the execution of the program, and writing down all the states of the variables etc, into the witness 

```rust
    let (final_pc, final_register_values, main_circuits_witness, delegation_circuits_witness) =
        run_and_split_in_default_configuration::<ND, C>(
            max_cycles_to_run,
            bytecode,
            &mut non_determinism,
            worker,
        );
```

`main_circuits_witness` contains a vector of `RiscVCircuitWitnessChunk` - each one describing what was happening within a single circuit run (so within `trace_len` steps - usually around 2^22).

As the next step, we look at the memory acceses, put them into a tree, to use its final hash to generate "commitment".

```rust
for circtuit in main_circuits_witness {
    let (caps, aux_data) = commit_memory_tree_for_riscv_circuit(..);
    memory_trees.push(caps);
}
```
Which together with hash from the setup columns is generated to create initial seeds:

```rust
let memory_challenges_seed = fs_transform_for_memory_and_delegation_arguments(
    &setup_caps,
    &final_register_values,
    &memory_trees,
    &delegation_memory_trees,
);
let external_challenges =
    ExternalChallenges::draw_from_transcript_seed(memory_challenges_seed, true);
```

These external challenges are later used within the prover to add some randomness to improve the security.

Now we're ready to start proving the circuit !

## Evaluate witness

First we need to prepare a trace (table) with witness and memory columns. This means taking data from the circruit form (where we say things like "this variable was equal to 15 at this step" - and put it in a nice table).

Trace table is simply a matrix, where each row is responsible for a single execution step.

```rust
let witness_trace = evaluate_witness(
    &risc_v_circuit_precomputations.compiled_circuit,
    cycles_per_circuit,
    &oracle,
    &witness_chunk
        .shuffle_ram_inits_and_teardowns
        .lazy_init_values,
    &witness_chunk
        .shuffle_ram_inits_and_teardowns
        .lazy_teardown_values_and_timestamps,
    &risc_v_circuit_precomputations.table_driver,
    circuit_sequence,
    worker,
    A::default(),
);
```

What's hapenning inside, is we go row by row (usually in multiple threads) - and for each row (inside `evaluate_witness_inner` method), we fill out the columns.

If you look deeper, you'll see that we do it in roughtly 3 steps for each row:
* filling out "static" values - like what memory value was accessed, oracle answers etc (`evaluate_witness_inner_static_work`)
* filling out "dynamic" values - usually custom functions that compute the output of the variables based on values of other variables (`evaluate_witness_inner_witness_generation_functions_work`)
* filling out the final derived columns (for lookups, range checks etc) - (`count_multiplicities`)


After this stage, we have all the witness and memory columns filled, and it is time to move to stage 1.

## Prove

Prove method might look scary, as it accepts a lot of arguments, but most of them can be safely ignored for now:

```rust
pub fn prove<const N: usize, A: GoodAllocator>(
    compiled_circuit: &CompiledCircuitArtifact<Mersenne31Field>,
    public_inputs: &[Mersenne31Field],
    external_values: &ExternalValues,
    witness_eval_data: WitnessEvaluationData<N, A>,
    setup_precomputations: &SetupPrecomputations<N, A, DefaultTreeConstructor>,
    precomputations: &Twiddles<Mersenne31Complex, A>,
    lde_precomputations: &LdePrecomputations<A>,
    circuit_sequence: usize,
    delegation_processing_type: Option<u16>,
    lde_factor: usize,
    _tree_cap_size: usize,
    num_queries: usize,
    pow_bits: u32,
    worker: &Worker,
) -> (ProverData<N, A, DefaultTreeConstructor>, Proof) {
```

The important ones are the compiled_circruit - that has the setup columns, and witness_eval_data - that we just computed - that has witness and memory columns.

The first thing we do inside - is start collecting `transcript` that will be used to initialize yet another seed for randomness:
```rust
    let mut transcript_input = vec![];
    transcript_input.push(circuit_sequence as u32);
    transcrpit_input.push(...);

```
But before we can finish the transcript - we do stage1.

### Stage 1

The goal of stage 1 is to create LDE for the main memory and witness trace, and build trees over them. (see [field](field.md) to understand more about LDE).

Inside `prover_stage_1` we simply create LDEs for all the elements of the trace, and then split the columns, to create separate merkle tree for memory columns and for witness ones (and each of those also get a separate tree per each LDE domain).


```rust
pub struct FirstStageOutput<const N: usize, A: GoodAllocator, T: MerkleTreeConstructor> {
    pub ldes: Vec<CosetBoundTracePart<N, A>>,
    pub num_witness_columns: usize,
    pub witness_tree: Vec<T>,
    pub memory_tree: Vec<T>,
}
```

When we return - we add the hashes of the tree to transcipt - so that the future random variables also partially depend on the LDE values.

### Stage 2

The goal of stage 2 is to fill out additional columns (aptly named stage2 columns - you can see full list in `LookupAndMemoryArgumentLayout`) - that will contain polynomials for lookups, range checks and memory accesses.


Inside, we are going couple times over all the existing columns, looking for memory or range checks, and writing necessary data into new stage 2 columns.

Usually most of them are in the format of "nominators" and "denominators" - where the idea is, that (for example) every time we read - we add nominator, when we write - we add denominator -- and at the end, the total value should be 1.

After full `stage2_trace` is filled, we also compute the LDE & subtrees for these newly created columns, and return all this data in the single struct:

```rust
pub struct SecondStageOutput<const N: usize, A: GoodAllocator, T: MerkleTreeConstructor> {
    // LDEs of second stage table, that contains different contributions, accumulators etc.
    pub ldes: Vec<CosetBoundTracePart<N, A>>,
    // Trees based off the LDEs columns.
    pub trees: Vec<T>,
    // Challenges used for the linearization
    pub lookup_argument_linearization_challenges:
        [Mersenne31Quartic; NUM_LOOKUP_ARGUMENT_KEY_PARTS - 1],
    // gamma used for the contributions
    pub lookup_argument_gamma: Mersenne31Quartic,
    // grand product of all the memory accesses
    pub grand_product_accumulator: Mersenne31Quartic,
    // sum of all the delegations & processed ones.
    pub sum_over_delegation_poly: Mersenne31Quartic,
}
```


### Stage 3 

Stage 3 is all about computing the quotient polynomial that should combine all the constraints from the previous steps.

Please look into [What is quotient](quotient.md) to understand the math and reasoning behind it.

For us, the important part, is that we use the current random seed to create the $\alpha, \beta$ params - and then proceed to creating the actual polynomial.

The outcome is a trace with a single quartic (so 4 columns), and with LDE and trees as usual.

```rust
pub struct ThirdStageOutput<const N: usize, A: GoodAllocator, T: MerkleTreeConstructor> {
    pub quotient_alpha: Mersenne31Quartic,
    pub quotient_beta: Mersenne31Quartic,
    pub ldes: Vec<CosetBoundTracePart<N, A>>,
    pub trees: Vec<T>,
}
```


### Stage 4 

Before jumping into stage 4, let's see what we have. We basically have a very large `trace` (table) with `trace_len` rows (2^22)that contains:

* setup columns - created when we "compiled" the circruit.
* witness & memory columns - created by witness evaluation
* some lookup related columns - created by stage 2
* and quotient columns - created by stage 3

Plus for all these, we have also computed LDE extensions and trees.

Now each of these columns is supposed to be a polynomial, that we could prove with FRI - but instead of doing them separately, we'll do it together.

So in step 4, we'll combine them into a single polynomial (DEEP) - using a random $\alpha$ (it will be a different alpha than in stage 3), and we'll also pick a random point $z$ on which we'll evaluate all of them (so that the verifier can confirm the relationships between them - especially the way how quotient was computed).

```rust

    let mut it = transcript_challenges.array_chunks::<4>();
    // random
    let z = Mersenne31Quartic::from_coeffs_in_base(
        &it.next()
            .unwrap()
            .map(|el| Mersenne31Field::from_nonreduced_u32(el)),
    );


    // random
    let deep_poly_alpha = Mersenne31Quartic::from_coeffs_in_base(
        &it.next()
            .unwrap()
            .map(|el| Mersenne31Field::from_nonreduced_u32(el)),
    );
```

After evaluating each column in point $z$ - we create the final DEEP polynomial by combining these polynomials with different coefficients (different powers of alpha):

```rust
    // alphas is 1, alpha, alpha^2, alpha^3, ...
    let alphas =
        materialize_powers_serial_starting_with_one::<_, Global>(deep_poly_alpha, total_num_evals);
```

And we finish by creating (yet another) trace with the values for the deep polynomial in each row:

```rust
    let deep_poly_trace =
        RowMajorTrace::<Mersenne31Field, N, A>::new_zeroed_for_size(trace_len, 4, A::default());
```

If you look carefully, you'll notice that we do 2 additional tricks:
* the actual polynomial that we compute is (deep(x) - deep(z) / (z-x))
* we also compute part of the deep polynomial over $x * \omega$

The first part is visible in:

```rust
// deep(z) - constant
let mut contribution_at_z = adjustment_at_z;
// deep(x)
contribution_at_z.sub_assign(&deep_poly_accumulator);
// x-z
contribution_at_z.mul_assign(&divisor);
```

This trick allow us to use FRI proving to not only check that deep is a polynomial but also to confirm that it's value in point $z$ is correct.

The second part - computation at $z * \omega$ - is for some columns that require a "peek-ahead" to compare the value in the next row to the current one:


And then, once all the rows for the DEEP polynomial are filled, as usual, we create LDE extension and trees.

```rust
pub struct FourthStageOutput<const N: usize, A: GoodAllocator, T: MerkleTreeConstructor> {
    pub values_at_z: Vec<Mersenne31Quartic>,
    pub ldes: Vec<CosetBoundColumnMajorTracePart<A>>,
    pub trees: Vec<T>,
    // gpu comparison test needs z and alpha
    pub z: Mersenne31Quartic,
    pub alpha: Mersenne31Quartic,
}
```

### Stage 5

In stage 5 - we do the FRI verification of the DEEP polynomial created in step 4.

```rust
pub fn prover_stage_5<const N: usize, A: GoodAllocator, T: MerkleTreeConstructor>(
    seed: &mut Seed,
    stage_4_output: &FourthStageOutput<N, A, T>,
    twiddles: &Twiddles<Mersenne31Complex, A>,
    lde_factor: usize,
    folding_description: &FoldingDescription,
    num_queries: usize,
    worker: &Worker,
) -> FifthStageOutput<A, T>
```

We use folding description to tell us how to fold the polynomial into a smaller one (as for optimization reason we don't just fold by 2x, but we try folding in larger batches)

```rust
FoldingDescription {
    initial_degree: 22,
    folding_sequence: &[4, 4, 3, 3, 3],
    total_caps_size_log2: 7,
    final_monomial_degree_log2: 5,
}, // 22
```

And finally we also compute the coefficients of the final polynomial:
```rust
    // fold one more time from the final oracle and make monomial form. Here we do not need to make another merkle tree
    let monomial_coefficients = { ... } 

```

The final output of stage 5, contains the fri_oracles field that has full traces after each folding step.

```rust
pub struct FifthStageOutput<A: GoodAllocator, T: MerkleTreeConstructor> {
    /// List of FRI folding steps with details.
    pub fri_oracles: Vec<FRIStep<A, T>>,
    /// Final set of monomials for the DEEP FRI polynomial after all the foldings.
    pub final_monomials: Vec<Mersenne31Quartic>,
    /// If true - then last step has put the leaves in last_fri_step_plain_leaf_values.
    pub expose_all_leafs_at_last_step_instead: bool,
    /// Might (if expose_all above is true) contain all the leaves from the final folding step.
    /// If leaves are not here - then we simply created a tree with caps out of them and put it inside
    /// fri_oracles.
    // It is a vec of vec, as we store leaves for multiple cosets/domains.
    pub last_fri_step_plain_leaf_values: Vec<Vec<Mersenne31Quartic>>,
}
```

### Compute Fri queries

As a final stap of our proving, we compute a bunch of FRI queries, to prove to the verifier that folding was done properly.

```rust
let mut queries = Vec::with_capacity(num_queries);
for _i in 0..num_queries {
    // random
    let query_index = assemble_query_index(query_index_bits as usize, &mut bit_source);
    //...
    // query set with leaves from all the columns
    let query_set = QuerySet {
        witness_query,
        memory_query,
        setup_query,
        stage_2_query,
        quotient_query,
        initial_fri_query,
        // And intermediate FRI leaves from folding.
        intermediate_fri_queries,
    };
```

We pass all the "original" leaves in each query, so that we can reconstruct the DEEP polynomial in that point during verification

After this - we put it all together into a single `Proof` struct, that is finally returned to the caller

```rust
pub struct Proof {
    pub external_values: ExternalValues,
    pub public_inputs: Vec<Mersenne31Field>,
    pub witness_tree_caps: Vec<MerkleTreeCapVarLength>,
    pub memory_tree_caps: Vec<MerkleTreeCapVarLength>,
    pub setup_tree_caps: Vec<MerkleTreeCapVarLength>,
    pub stage_2_tree_caps: Vec<MerkleTreeCapVarLength>,
    pub memory_grand_product_accumulator: Mersenne31Quartic,
    pub delegation_argument_accumulator: Option<Mersenne31Quartic>,
    pub quotient_tree_caps: Vec<MerkleTreeCapVarLength>,
    pub evaluations_at_random_points: Vec<Mersenne31Quartic>,
    pub deep_poly_caps: Vec<MerkleTreeCapVarLength>,
    pub intermediate_fri_oracle_caps: Vec<Vec<MerkleTreeCapVarLength>>,
    pub last_fri_step_plain_leaf_values: Vec<Vec<Mersenne31Quartic>>,
    pub final_monomial_form: Vec<Mersenne31Quartic>,
    pub queries: Vec<QuerySet>,
    pub pow_nonce: u64,
    pub circuit_sequence: u16,
    pub delegation_type: u16,
}
```