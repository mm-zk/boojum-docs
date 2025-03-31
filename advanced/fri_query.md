# Fri query

The goal of FRI folding is to prove that a given function $f(x)$ is a polynomial of some degree.

## How

The main idea of FRI is to take a function $f$, which is intended to be a polynomial of degree $d$, and "fold" it into another function $g$ that is a polynomial of degree $d/2$. By repeating this process several times, we eventually reduce the polynomial to a low degree (even as low as degree 1) where the coefficients can be directly verified.

Typically, we start with polynomials of degrees around $2^{20}$, $2^{22}$, and so on. Without FRI, we would need to include all these coefficients in a proof, making the proof very large and the verification process slow.

## Query

To prove that the folding was performed correctly, the prover creates a Merkle tree of all the evaluations of the polynomial at every point (including the additional coset domains—see [LDE](lde.md) for more details). The prover also provides the coefficients of the final "folded" polynomial, which is usually a short list (for instance, if we end up with a degree 4 polynomial, only 5 coefficients are needed).

For each query, the verifier (or, in non-interactive proofs, the prover using randomness and Fiat-Shamir) selects a starting point $c$ and a coefficient $\alpha$. The evolution of the values at point $c$ is then demonstrated through successive folding steps, ending with the final polynomial. At one point in the process, the final value must match the value obtained by applying the final coefficients directly.

Since this verification is repeated for multiple queries using various starting points (including points on the LDE), even a single error in the folding procedure would cause one of the proofs to fail. It is estimated that each FRI query contributes roughly 2 bits of security.

## Batched folding

In our implementation, we have optimized several steps to speed up the process. 

For instance, the naive method of a 2x folding from degree 24 to degree 6 would require 18 steps. Instead, we perform approximately 5 steps by employing 8x to 16x foldings. The specific mappings are described in the `OPTIMAL_FOLDING_PROPERTIES` struct, and the code in `fri_fold_by_log_n` uses the $N$ parameter to specify the folding amount in each step.

## Folding degree 2 details

Let’s explain the simple case of 2x folding, before moving on to more optimized approaches.

Suppose we have a polynomial $f$ that we wish to fold:

$f(x) = 4x^4 + 3x^3 + 2x^2 + 5x + 7$

Conceptually, we split the polynomial into two parts: one for even and one for odd powers:

$even(x) = (f(x) + f(-x))/2 = 4x^4 + 2x^2 + 7$

$odd(x) = (f(x) - f(-x))/2 = 3x^3 + 5x$

We then define a new function $g()$ as follows:

$g(x^2) = even(x) + odd(x)/x = (f(x) + f(-x))/2 + (f(x) - f(-x))/(2x)$

Which simplifies to:

$g(x^2) = 4x^4 + (3+2)x^2 + (7+5)$

Thus, we can write $g$ as:

$g(x) = 4x^2 + 5x + 12$

This shows that if $f$ is a polynomial of degree 4, the transformation results in $g$ being a degree 2 polynomial.

The key advantage is that to compute $g(x^2)$, only the values $f(x)$ and $f(-x)$ are needed. Although the example simply adds the even and odd parts, the process remains valid even when one of them is multiplied by a random challenge, which is commonly done in practice.

The following code snippet from `fri_folding` illustrates this process:

```rust
let mut folded = *a;
folded.sub_assign(b);
folded.mul_assign_by_base(root);
folded.mul_assign(&challenge);
folded.add_assign(a);
folded.add_assign(b);

*output_buffer.get_unchecked_mut(i) = folded;
```

Here, $a$ represents $f(x)$, $b$ represents $f(-x)$, and $root$ is the $1/x$ value.

## Final monomial check

After all the folding steps are complete, we obtain a purported low-degree polynomial whose coefficients can be directly provided. A final check is then performed to ensure that the value traced from the leaf in the Merkle tree matches the value computed from this polynomial at the evaluation point.
