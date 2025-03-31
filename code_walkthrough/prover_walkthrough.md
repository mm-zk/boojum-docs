# Prover Walkthrough

The goal of this article is to explain how the boojum prover works from end to end. The content uses simplified code snippets with function names intact, while hiding some parameters for readability.

---

Whole journey starts here:

```rust
pub fn prove_image_execution(
    bytecode: &[u32],
    non_determinism: ND,
    risc_v_circuit_precomputations: &MainCircuitPrecomputations<A>,
) -> (Vec<Proof>, Vec<FinalRegisterValue>)
```

We pass the bytecode of the program, non-determinism (a.k.a. IO; see [how io works](../basics/non_determinism.md)), and the compiled circuit with some precomputed static data. The function returns a list of proofs because the program could run long enough to span multiple circuits. If there are too many proofs, recursion can be applied to combine them (see [recursion](../basics/recursion.md) for more info).

---

The process begins with executing the program and writing down state changes into the witness:

```rust
    let (final_pc, final_register_values, main_circuits_witness, delegation_circuits_witness) =
        run_and_split_in_default_configuration::<ND, C>(
            max_cycles_to_run,
            bytecode,
            &mut non_determinism,
            worker,
        );
```

Here, `main_circuits_witness` holds a vector of `RiscVCircuitWitnessChunk`, each representing what happened during a single circuit run (typically around $2^{22}$ steps).

Next, memory accesses are processed by constructing a tree. The resulting final hash will be used to generate a "commitment":

```rust
for circtuit in main_circuits_witness {
    let (caps, aux_data) = commit_memory_tree_for_riscv_circuit(..);
    memory_trees.push(caps);
}
```

Together with the setup columns’ hash, these are used to generate initial seeds:

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

These external challenges add randomness inside the prover to improve security.

---

## Evaluate Witness

The next step is to prepare a trace (table) with both witness and memory columns. This table is a matrix where each row represents a single execution step. Data from the circuit is organized into readable columns.

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

Internally, the evaluation function processes each row (often in parallel threads) and works in roughly three stages:
* **Static work:** Filling in columns with fixed values (e.g., memory access, oracle answers) via `evaluate_witness_inner_static_work`.
* **Dynamic work:** Computing outputs based on other variable values using custom functions in `evaluate_witness_inner_witness_generation_functions_work`.
* **Final derived columns:** These are computed for lookups, range checks, etc., using `count_multiplicities`.

After completing this stage, the witness and memory columns are fully populated, and the process moves on to stage 1.

---

## Prove

The proving phase begins with a function that accepts numerous arguments; however, the key parameters are the compiled circuit (which contains the setup columns) and the witness evaluation data (which includes the witness and memory columns):

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

The first action is to collect `transcript` data, which helps initialize an additional randomness seed:

```rust
    let mut transcript_input = vec![];
    transcript_input.push(circuit_sequence as u32);
    transcrpit_input.push(...);
```

Before completing the transcript, stage 1 is performed.

---

### Stage 1

Stage 1’s goal is to create LDEs (Low Degree Extensions) for the main memory and witness trace, and then build trees over these LDEs. For more details on LDE, see [field](../basics/field.md).

`prover_stage_1` creates an LDE for all elements of the trace and splits the columns into separate Merkle trees for memory and witness data.

```rust
pub struct FirstStageOutput<const N: usize, A: GoodAllocator, T: MerkleTreeConstructor> {
    pub ldes: Vec<CosetBoundTracePart<N, A>>,
    pub num_witness_columns: usize,
    pub witness_tree: Vec<T>,
    pub memory_tree: Vec<T>,
}
```

When stage 1 completes, the tree hashes are added to the transcript so future random variables depend on the LDE values.

---

### Stage 2

The objective of stage 2 is to compute additional columns, known as stage2 columns (see `LookupAndMemoryArgumentLayout` for the full list). These columns include polynomials for lookups, range checks, and memory access.

In stage 2, the process is repeated over existing columns to identify memory and range checks and to populate the new columns. Many of these have nominators and denominators—for example, each memory read adds a nominator and each write adds a denominator. The overall sum should equal 1.

After the `stage2_trace` is fully constructed, an LDE and corresponding subtrees are computed for these new columns. The complete data is packaged into:

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

---

### Stage 3

Stage 3 involves computing the quotient polynomial, which combines all constraints from earlier stages. For details on the math, see [What is quotient](../advanced/quotient.md). Here, a random seed is used to generate the parameters $\alpha$ and $\beta$, then the quotient polynomial is created. The output is a trace with four columns, accompanied by its LDE and trees.

```rust
pub struct ThirdStageOutput<const N: usize, A: GoodAllocator, T: MerkleTreeConstructor> {
    pub quotient_alpha: Mersenne31Quartic,
    pub quotient_beta: Mersenne31Quartic,
    pub ldes: Vec<CosetBoundTracePart<N, A>>,
    pub trees: Vec<T>,
}
```

---

### Stage 4

At this point, we have a comprehensive trace (table) with `trace_len` rows (approximately $2^{22}$ rows) containing:
* Setup columns (from the compiled circuit).
* Witness & memory columns (from witness evaluation).
* Lookup related columns (from stage 2).
* Quotient columns (from stage 3).

Each column represents a polynomial that will eventually be verified using FRI. In stage 4, these columns are combined into a single DEEP polynomial using a random $\alpha$ and evaluated at a random point $z$. This evaluation verifies the relationships, particularly how the quotient was computed.

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

After evaluating all columns at point $z$, the final DEEP polynomial is formed by combining the evaluations with powers of deep_poly_alpha:

```rust
    // alphas is 1, alpha, alpha^2, alpha^3, ...
    let alphas =
        materialize_powers_serial_starting_with_one::<_, Global>(deep_poly_alpha, total_num_evals);
```

Additionally, two important techniques are applied:
* The computed polynomial is represented as (deep(x) - deep(z))/(z-x).
* A portion of the deep polynomial is also computed over $x * \omega$, which is used for "peek-ahead" comparisons between consecutive rows.




```rust
// deep(z) - constant
let mut contribution_at_z = adjustment_at_z;
// deep(x)
contribution_at_z.sub_assign(&deep_poly_accumulator);
// x-z
contribution_at_z.mul_assign(&divisor);
```



Once the DEEP polynomial trace is complete, its LDE extension and corresponding trees are generated:

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

---

### Stage 5

Stage 5 completes the process by performing FRI verification of the DEEP polynomial computed in stage 4.

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

A folding description outlines how the polynomial is recursively folded to a smaller size. An example folding description includes:

```rust
FoldingDescription {
    initial_degree: 22,
    folding_sequence: &[4, 4, 3, 3, 3],
    total_caps_size_log2: 7,
    final_monomial_degree_log2: 5,
}, // 22
```

Finally, the coefficients of the fully folded polynomial are computed:

```rust
    let monomial_coefficients = { ... } 
```

The output of stage 5 encapsulates several details including:
* FRI oracles representing traces after each folding step.
* The final polynomial in monomial form.
* Information on whether leaves were exposed from the last FRI step.
* And more, as shown below:

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

---

### Compute FRI Queries

As a final step, a series of FRI queries are generated to verify that the folding was performed correctly. Each query collects leaves from all relevant columns, which allows the verifier to reconstruct the DEEP polynomial at specific points.

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

All pieces are then combined into a single `Proof` struct, which is returned to the caller:

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

