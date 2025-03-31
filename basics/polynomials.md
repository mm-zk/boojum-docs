# Polynomials

We usually represent polynomials using coefficients for each **monomial** term:

$f(x) = a_0 + a_1 * x + a_2 * x^2 + ...$

## Lagrange Coefficients

Another way to define a polynomial of degree $n$ is by specifying its values at $n+1$ distinct points. For instance, a line (a degree 1 polynomial) requires two points.

This method uses **Lagrange** coefficients. First, you pick a set of points (commonly the natural numbers: 1, 2, 3, etc). The polynomial is then written as:

$f(x) = l_1(x) * val_1 + l_2(x) * val_2 + ...$

Here, each $l_b(x)$ is a Lagrange polynomial that equals 1 at point $b$ and 0 at all the other chosen points.

It is also possible to select a different set of points. One effective choice is using the powers of omega in the multiplicative group – see [Fields](field.md) for more details.

## Divisor Polynomials

If a polynomial is meant to be 0 at certain points (for example, $b_1, b_2$, etc), then it must be divisible by the polynomial $d(x) = (x-b_1) * (x-b_2) *  \ldots $. 

This ensures that the result of the division is another polynomial. This approach is often used to verify that certain constraints are satisfied. When you have a list of points where you expect the polynomial to equal 0, you construct this divisor polynomial and then prove (for example via FRI) that the quotient (which is the result $f(x) / d(x)$ ) is indeed forms a valid polynomial.

## Proving a Value of a Polynomial

Suppose someone asserts that for a polynomial $f(x)$, the value at point $z$ is $v$, i.e., $f(z) = v$. To check this claim, you can use a similar idea based on divisor polynomials.

First, form the polynomial $h(x) = f(x) - v$. If the claim is correct, then $h(z) = 0$. This means that $h(x)$ should be divisible by $(x - z)$.

Thus, you can ask for proof that $(f(x) - v)/(x - z)$ is a valid polynomial. This method is employed in several proofs, such as in the final DEEP-FRI verification, where it is used both to confirm that the DEEP polynomial is correctly formed and that its evaluation at point $z$ is accurate.

## Combining Polynomials

When $f(x)$ and $g(x)$ are polynomials of degree $d$, their linear combination (e.g., $f(x) + g(x)$ or $f(x)*17 + g(x)*33$) is also a polynomial of degree $d$.

This is the strategy used to create the DEEP polynomial in proofs. By combining numerous polynomials using a random scalar $\alpha$ (and its powers), we can consolidate multiple proofs into a single verification of one polynomial.

