# Verifier Walkthrough

This guide explains the verification process, detailing how we obtain and use proof and FRI query data.

Note: that we have a separate standalone code for each verifier - all coming from the common "verifier" directory.

Morever all the quotient code is auto-generated from the circruit description.

## Inputs

```rust
let skeleton = ProofSkeletonInstance::fill::<I>(...);
let queries = QueryValuesInstance::fill_array::(...)
```

We start verification by obtaining the proof (the "skeleton") and FRI query data. These functions read values using `read_crs` (see [passing_data](../basics/non_determinism.md)). Note that these functions allow the verifier to be runnable on RISCV as well (see [recursion](../basics/recursion.md)).

### Proof Skeleton

This contains the main proof information, including public inputs, Merkle tree roots (caps), accumulators, openings, coefficients, etc.

### Query Values

This consists of a list of FRI queries paired with their corresponding leaves.

### Traces and Types

Think of the "trace" as one large table with many columns. In practice, we split it into several subtraces.

#### Setup

The setup holds constants that remain the same regardless of circuit type. For example, "timestamp" almost acts like a "row index."

#### Witness

This is where most of the circuit variables reside. Allocating a new circuit variable creates a new column.

#### Memory

Memory columns record memory reads and writes. They track which slots were accessed (read or written) in a given step. We impose a strict upper limit (about 3) of accesses per step. Reading or writing to registers is treated as memory access.

#### Stage2

This subtrace handles helper tasks. (TODO)

#### Quotient

This is one polynomial that checks all conditions (see [quotient](../advanced/quotient.md) for more details).

## Randomness

FRI security depends on deterministic randomness (refer to Fiat-Shamir for background). We modify seeds repeatedly during verification, and use these seeds to generate various parameters (alpha, beta, gamma, challenges, etc.).

```rust
let mut seed = Blake2sTranscript::commit_initial_using_hasher(
    blake2s_u32::DelegatedBlake2sState,
    skeleton.transcript_elements_before_stage2(),
);
let challenges = Transcript::draw_randomness_using_hasher(seed);
let lookup_argument_gamma = Mersenne31Quartic::from(challenges.next());
...
// Update seed again
Blake2sTranscript::commit_with_seed_using_hasher(
    &mut transcript_hasher,
    &mut seed,
    skeleton.transcript_elements_stage2_to_stage3(),
);
let quotient_alpha = Mersenne31Quartic::from(challenges.next());
...
```

## PoW

For extra security, the prover must provide PoW. After verifying PoW, we use the seed to generate FRI query indexes.

```rust
// Now we can verify PoW
Blake2sTranscript::verify_pow_using_hasher(
    &mut transcript_hasher,
    &mut seed,
    skeleton.pow_nonce,
    POW_BITS as u32,
);
...
let indexes_bits = Transcript::draw_randomness_using_hasher(&mut transcript_hasher, &mut seed);
```

## Quotient Opening

Next, we unpack the values from different column polynomials at a randomly chosen point $z$.

```rust
let (setup, rest) = skeleton.openings_at_z.split_at(NUM_SETUP_OPENINGS);
let (witness, rest) = rest.split_at(NUM_WITNESS_OPENINGS);
...
```

We then calculate the divisors. These divisors represent points where specific subgroups of polynomials must be 0:

```rust
let divisors = [
    everywhere_except_last,
    everywhere_except_last_two_rows,
    first_row,
    one_before_last_row,
    last_row,
    last_row_and_zero,
];
```

This showcases the six common patterns observed in our polynomials. We follow this up by calling the `evaluate_quotient` method:

```rust
let quotient_opening = skeleton.openings_at_z[-1];
let quotient_recomputed_value = evaluate_quotient(...);
assert_eq!(
    quotient_recomputed_value, quotient_opening,
    "quotient evaluation diverged"
);
```    

`evaluate_quotient` is auto-generated based on the compiled circuit. Its goal is to compute the special quotient polynomial (see quotient.md), applying all circuit-specific computations. For example, if a circuit enforces that the 5th column contains only booleans (true for all rows except the last), the method adds 
$witness[5] * (witness[5] - 1) / divisors[0]$ 
to the quotient. Similar logic applies for other constraints.

This check confirms that the quotient polynomial at the point $z$ equals the computed combination of other polynomials, verifying that the original polynomials are 0 where required.

### Public Inputs

Among the parameters passed to `evaluate_quotient` are public inputs. Typically, the method creates a polynomial that compares a public input with a witness column value, ensuring that the polynomial vanishes (equals 0) on the first row.

Below is an example where the first public input is set to match column 102 of the witness:

```rust
let first_row_contribution = {
    ...
    {
        accumulated_contribution.mul_assign(&quotient_alpha);
        let contribution = {
            let individual_term = {
                let mut individual_term = *(witness.get_unchecked(102usize));
                let t = public_inputs[0usize];
                individual_term.sub_assign_base(&t);
                individual_term
            };
            individual_term
        };
        accumulated_contribution.add_assign(&contribution);
    }
    ...
    let divisor = divisors[2usize];
    accumulated_contribution.mul_assign(&divisor);
    accumulated_contribution
}
```

In the final part, we divide by `divisors[2]` (the first row divisor, $1 / (x - omega^0)$ ). The final quotient then combines contributions using a random $\beta$:

```rust
let mut quotient = every_row_except_last_contribution;
quotient.mul_assign(&quotient_beta);
quotient.add_assign(&every_row_except_two_last_contribution);
quotient.mul_assign(&quotient_beta);
quotient.add_assign(&first_row_contribution);
...
```

## Fri Verification

After confirming the quotient polynomial evaluation at $z$, we prove two additional things:
1. All the polynomials are valid (of a fixed maximum degree).
2. Their evaluation at the point $z$ is correct.

Instead of checking each polynomial separately, we combine them into a single polynomial using a random parameter $\alpha$. The combined polynomial looks roughly like:

$deep = f_{setup_0} + \alpha*f_{setup_1} + ... + \alpha^5*f_{witness_0} + \ldots $

This polynomial also includes the quotient polynomial, so if we can prove that $deep$ has the correct degree, the original polynomials are all valid.

### Checking the Value at $z$

To verify the computed $deep(z)$, we use a clever trick. We define a different polynomial:

$deep_{fri}(x) = (deep(z) - deep(x)) / (z - x)$. 

If $deep(z)$ is correctly computed, then plugging $x = z$ results in 0, meaning $deep_{fri}(x)$ should be divisible by $(x-z)$. Proving that $deep_{fri}(x)$ is a valid polynomial confirms the correctness of $deep(z)$ and that all other column functions are polynomials, including the quotient.

### Precomputations

We start with some precomputations:

```rust
let (precompute_with_evals_at_z, precompute_with_evals_at_z_omega, powers_of_deep_quotient_challenge) = 
                precompute_for_consistency_checks(
                    &skeleton,
                    &deep_poly_alpha
                )
```

Then, we verify each FRI query:

```rust
for query_round in 0..NUM_QUERIES {
```

### Fri Query Handling

The first step is to verify that each query targets the correct index. This is crucial because FRI leaves must be determined based on the current seed to uphold the Fiat-Shamir assumption.

```rust
let query_index: u32 =
    assemble_query_index(BITS_FOR_QUERY_INDEX, &mut bit_iterator) as u32;

// Assert that our query is at the proper index
assert_eq!(query.query_index, query_index);
```

Some points are evaluated at $z$, while others at $z * \omega$—the latter is needed for constraints that require a "step ahead". We compute the expected value as follows:

```rust
let expected_value = accumulate_over_row_for_consistency_check(...);
```

Here, the $deep$ polynomial is a combination of various column polynomials. Using `precompute_with_evals_at_z` and `precompute_with_evals_at_z_omega`, we compute $deep(z)$. The `query_index` then lets us access $deep(\omega^{queryIndex})$ (referred to as `evaluation_point`). This value is used in the FRI folding process, where in each step the degree of the deep polynomial is reduced and the expected value is updated (more details in [fri_query](fri_query.md)).

```rust
for (step, folding_degree_log_2) in FRI_FOLDING_SCHEDULE.iter().enumerate() {
    ...
    fri_fold_by_log_n::<N>(
        &mut expected_value,
        &mut evaluation_point,
        &mut domain_size_log_2,
        &mut domain_index,
        &mut tree_index,
        &mut offset_inv,
        leaf_projection,
        challenges,
        &SHARED_FACTORS_FOR_FOLDING,
    );
}
```

### Monomial Form

After several folding steps, the $deep$ polynomial reduces to a low degree. At this stage, the proof can present its monomial form (parameters $a_0, a_1, a_2, ...$ for the polynomial $a_0 + a_1*x + a_2*x^2 + \ldots$. ). The final step is to evaluate this polynomial at the current `evaluation_point` and ensure that it matches `expected_value`. (Note: Both the evaluation point and expected value change during folding; see [fri_query](../basics/fri_query.md) for details.)

## Summary

Below is a quick summary of the verifier's process:

* Load the proof and queries.
* Compute necessary seeds and random parameters (alpha, beta, query indexes) based on the proof.
* Obtain evaluations of all polynomials at a random point $z$, and verify that the quotient polynomial matches via `evaluate_quotient`.
* Combine all polynomials into the deep polynomial.
* Create the deep-fri polynomial by incorporating the condition that deep polynomial evaluation at $z$ divides $(x-z)$.
* Finally, use FRI to prove that the deep-fri polynomial is of a specific maximum degree.

This overall process confirms that the prover supplied a valid trace table where all constraints are satisfied as per the divisors' requirements.
