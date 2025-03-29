# Verifier walkthrough


## Inputs

```rust
    let skeleton = ProofSkeletonInstance::fill::<I>(...);
    let queries = QueryValuesInstance::fill_array::(...)
```

We start our verification by getting the proof (a.k.a skeleton) and FRI queries data.


We are not passing them directly as arguments, but the functions above are reading them from the `read_crs` functions (see [passing_data](passing_data.md))

We are doing it - as the verifier code has to be runnable also in RISCV itself (as we're using it in the recursion - please see [recursion](recursion.md) for more info).


### Proof skeleton

It contains the main proof information - public inputs, merkle tree roots (caps), accumulators, openings, coefficients etc.

### Query values

This contains a list of FRI queries and corresponding leaves.


### Traces and types

While you can think about the "trace" as one huge table with multiple columns, in practice we break it into multiple sub traces:

#### Setup

Setup contains the "constants" that don't really change, no matter the circtuit type. One example is "timestamp" - which you can almost consinder as "row index".

#### Witness

This is where most of the "circuit" variables end up in. When you allocate a new circtuit variable, you basically create a new column.

#### Memory

Memory columns are responsible for memory reads and writes - that's where we put the information, which slots were accesses (read or written) in a given step.

We usually have a strict upper limit (around 3) of accesses per single step - which gives us the upper limit on number of columns here.

Reading and writing to regiters is treated as memory acceses.

#### Stage2

TODO (helper stuff)

#### Quotient

One polynomial to check them all -  see [quotient](quotient.md) for more info.


## Randomness

Security of the FRI, really depends on the deterministic randomness (see Fiat-Shamir for more info) - and we keep modifying seeds multiple times during the verification step, and then using this seed to generate different parameters (alpha, beta, gamma, challenges etc).

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

For additional security, we also require the prover to provide PoW - which is expensive - and only then we use this seed to generate the FRI query indexes.


```rust
    // now we can verify PoW
    Blake2sTranscript::verify_pow_using_hasher(
        &mut transcript_hasher,
        &mut seed,
        skeleton.pow_nonce,
        POW_BITS as u32,
    );
    ...
    let indexes_bits = Transcript::draw_randomness_using_hasher(&mut transcript_hasher, &mut seed);

```

## Quotient opening

First we'll unpack the values of different column polynomials at this randomly chosen point $z$.

```rust
let (setup, rest) = skeleton.openings_at_z.split_at(NUM_SETUP_OPENINGS);
let (witness, rest) = rest.split_at(NUM_WITNESS_OPENINGS);
...
```

Then we'll also get the divisors - these are the polynomials representing points where given subgroups of polynomials should be 0:

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

This shows the 6 common patterns that we see in our polynomials - that they either have to be equal to 0 on all rows except for last one, or all rows expect for the last 2 etc.

And then we pass all this information to `evaluate_quotient` method:

```rust
let quotient_opening = skeleton.openings_at_z[-1];
let quotient_recomputed_value = evaluate_quotient(...);
assert_eq!(
    quotient_recomputed_value, quotient_opening,
    "quotient evaluation diverged"
);
```    

`evaluate_quotient` is the method that is auto generated based off the compiled circtuit.

Its goal is to compute the special quotient polynomial (see quotient.md) - so it has to apply all the circtuit specific computations.

For example, if circuit knows that 5th column must be only booleans and it should be true for all rows except last one, this method would add $witness[5] * (witness[5] - 1) / divisors[0] $ to the quotient.

It would do similar things to constraints etc etc.

(divisiors[0] == everywhere except last).

Overall this will be a check, that in this random point $z$ the quotient polynomial is really equal to the combination of the polynomials from other columns - which will prove that all those combinations really exist (which proves that the original polynomials are really 0 in the right places).

### Public inputs

One of the parameter that is passed into `evaluate_quotient` are public inputs. For most of the circtuits, the evaluate quotient will create a polynomial that would compare the value of the public inputs to a value in a given witness column - and say that such polynomial should vanish (be equal 0) - only on the first row!

The example code below adds such contribution to `first_row_contribution`.
Notice that it says that first public_input should be equal to 102 column of the witness.
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
In the last part, the we'll actually divide it by a `divisor[2]` - which is the first row divisor ($1 / (x - omega^0)$)

And then the final quotient is a combination of all of those (using a random $\beta$):

```rust
    let mut quotient = every_row_except_last_contribution;
    quotient.mul_assign(&quotient_beta);
    quotient.add_assign(&every_row_except_two_last_contribution);
    quotient.mul_assign(&quotient_beta);
    quotient.add_assign(&first_row_contribution);
    ...
```


## Fri verification

Now that we know that quotient polynomial evaluation matches at random point - we still have to prove that all these polynomials are actual polynomials with some maximum degree AND that their evaluation at point $z$ is correct.

In theory, we could have done it for each polynomial separately - but this would be less efficient - so instead we are combining all these polynomials into 1 - using a random "alpha".

So we are constructing a polynomial that looks roughly like:

$deep = f_{setup_0} + \alpha*f_{setup_1} + ... \alpha^5*f_{witness_0} + ..$

This polynomial also includes the quotient polynomial.

This way, if we can prove that this $deep$ is the actual polynomial of a fixed degree.


### Checking the value at z
But how to check that values at $z$ were calculated correctly ?

To do this, we'll do a small trick -- we'll use FRI to verify a DIFFERENT polynomial

$deep_{fri}(x) = (deep(z) - deep(x)) / (z - x)$. 

If the $deep(z)$ that we compute based off `eval_at_z` elements from the proof is correct, then when $x = z$ the delta will be 0 - therefore the polynomial should be divisible by $(x-z)$. 

So if we prove that $deep_fri(x)$ is a polynomial, then $deep(z)$ was correctly computed AND $deep(x)$ is a polynomial, so all the other column functions are polynomials too, and the quotient is also a polynomial and everything works.


### Precomputations

We'll start with some precomputations:

```rust
let (precompute_with_evals_at_z, precompute_with_evals_at_z_omega, powers_of_deep_quotient_challenge) = 
                precompute_for_consistency_checks(
                    &skeleton,
                    &deep_poly_alpha
                )
```

And then we'll verify each FRI query:

```rust
for query_round in 0..NUM_QUERIES {
```

### Fri query handling

The very first thing we do - is check whether it queries the right index.
It is absolutely crucial that the FRI leaves that are checked are determined based on the current seed (without this the Fiat-Shamir assumption fails).

```rust
let query_index: u32 =
    assemble_query_index(BITS_FOR_QUERY_INDEX, &mut bit_iterator) as u32;

// assert that our query is at the proper index
assert_eq!(query.query_index, query_index);
```

To make things a little bit more complex, some points are evaluated at $z$, while others at $z * \omega$. The latter ones are needed, as for some constraints we have to look "a step ahead".

The first thing we do, is to compute the expected value:

```rust
let expected_value = accumulate_over_row_for_consistency_check(...);
```

$deep$ polynomial is a combination of polynomials coming from columns - so based on that we can compute $deep(z)$ (that's what `precompute_with_evals_at_z` and `precompute_with_evals_at_z_omega` is for).

Now the given `query_index` gives us access to the $deep(\omega^{query\_index})$ value (a.k.a `evaluation_point`).

This allows us to keep doing the FRI_FOLDING on the deep method - and in each step, we're "folding" the deep polynomial, making the degree lower and lower, while properly updating expected value (more deails on how it works in [fri_query](fri_query.md)).

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

### Monomial form

After some steps of folding, the $deep$ polynomial becomes such low degree, that our proof can directly contain its monomial form (that is parameters $a_0, a_1, a_2..$ where polynomial is $a_0 + x * a_1 + x^2 * a_2 ...$)

So the only thing remaining is to compute the value of this polynomial in the `evaluation_point` and make sure that it matches `expected_value`.
(Important - evaluation point & expected value keeps changing as we do folding - more info in [fri_query](fri_query.md)).


## Summary

Let's do a quick summary of all the steps that we did in the verifier:

* loaded proof & queries
* based on proof - computed necessary seeds and random parameters (alpha, beta, query indexes)
* we got the values of all the polynomials in random point $z$ - and checked - using evaluate_quotient - that the quotient polynomial at that point matches the computations
* then we combined all these polynomials together (into deep polynomial)
* we created the deep-fri polynomial (by adding the check that deep polynomial evaluation at $z$ divides $(x-z)$)
* and finally, using FRI, we have proven that deep fri is an an actual polynomial of some degree.


Therefore - prover did possess such a trace table, where all the constraints were met (that is that the contributions to the quotient polynomial were actually 0 in the places where divisors required them).



