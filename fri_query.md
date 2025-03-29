# Fri query

The goal of FRI folding is to prove that a given function $f(x)$ is a polynomial of some degree.

## How
The high level idea of FRI, is to take our function $f$ that is supposed to be a polynomial of degree $d$ - and "fold" it - into a function $g$ that would be a polynomial of degree $d/2$.

If we repeat this process multiple times, we should be able to get to a low degree polynomial (even up to degree 1) - where we can show the coefficients directly.

Usually we start with degrees of size $2^{20}, 2^{22}$ etc - so without FRI, we would need to pass all these coefficients inside a proof, that would make proof large and verification slow.

## Query 

The way that prover proofs to verifier that the folding was done correctly - is through multiple queries.

Before doing any of the queries, prover creates a merkle tree with all the evaluations of the polynomial on all the points (and on our case also on the additional coset domains - see [LDE](lde.md) for more info).

Prover also provides the coefficient of the final "folded" polynomial (it usually is a short list, as we - for example - end up with polynomial of degree 4 - then we need to have only 5 coefficients).

For each query, the verifier (or in case of non-interactive proofs - the prover using a randomness and Fiat-Shamir) chooses a starting point $c$ and coefficient $\alpha$.

Then it shows what happens to the values of a given point c - as they travel through folding polynomials - ending up in the already known "folded" one - and which moment, the final value must match the value obtained by simply applying the final coefficients.

As this is done over multiple queries, using multiple starting points (including points on LDE) - if prover did some part of folding in incorrect way, one of these proofs would have failed.

It is approximated, that each FRI query provides around 2 bits of security.

## Batched folding

In case of our prover, we optimized multiple steps allowing us to speed up the process.

For example, the naive 2x folding from degree 24 to degree 6, would have taken 18 steps. Instead, we're doing it in around 5 steps, doing 8x - 16x foldings along the way.

The exact mappings are described in `OPTIMAL_FOLDING_PROPERTIES` struct and the code for folding `fri_fold_by_log_n` takes the $N$ parameter to say how much it should fold in a given step.



## Folding degree 2 details

Let's describe in more details the simple case of 2x folding - and later we can discuss more optimized approaches.

imagine we have a polynomial f, that we would like to fold:

$f(x) = 4x^4 + 3x^3 + 2x^2 + 5x + 7$

Conceptually, we want to "break in two halves and squash together".

let's take all the even and odd powers:

$even(x) = (f(x) + f(-x))/2 = 4x^4 + 2x^2 + 7$

$odd(x) = (f(x) - f(-x))/2 = 3x^3 + 5x$

and now let's define $g()$ as:

$g(x^2) = even(x) + odd(x)/x = (f(x) + f(-x))/2 + (f(x) - f(-x))/2x$

$g(x^2) = 4x^4 + (3+2)x^2 + (7+5)$

So - we can write g as:

$g(x) = 4x^2 + 5x + 12$

Therefore, on one side we see that if $f$ was a polynomial of degree 4, then when applyying this transformation, we end up with $g$ being a polynomial of degree 2.

The great news, is that to compute the $g(x^2)$, we only need $f(x) and f(-x)$. 

While here we simply added the two parts (even and odd) - the equation still holds, even if we do a linear combination of them - so in practice, we multiply one of them by a random challenge.

This is visible in this code in `fri_folding`:


```rust
let mut folded = *a;
folded.sub_assign(b);
folded.mul_assign_by_base(root);
folded.mul_assign(&challenge);
folded.add_assign(a);
folded.add_assign(b);

*output_buffer.get_unchecked_mut(i) = folded;
```

Where $a$ is $f(x)$ and $b$ is $f(-x)$, and $root$ is the $1/x$ point.


## Final monomial check

After all the folding is done, we end up with an (alleged) low degree polynomial - and its coefficients can be directly provided.

Then we can do the final check, that the element that we were comparing all the way from the leaf, is actually matching the value of this polynomial in the evaluation point.
