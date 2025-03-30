# Polynomials

We are used to showing polynomials with **monomial** coefficients:

$f(x) = a_0 + a_1 * x + a_2 * x^2 + ...$


## Lagrange coefficients

The other way of defining the polynomial of degree $n$ is to provide the values that it has in $n+1$ points (for example for a single line - which is degree 1 - we have to provide 2 points).

Then we can represent polynomial using **lagrange** coefficients. First we have to define a list of points (for now, let's assume that we put values in natural numbers: 1, 2, 3 etc)

$f(x) = l_1(x) * val_1 + l_2(x) * val_2 + ..$

Where $l_b(x)$ is a lagrange polynomial that is equal to 1 in point $b$ and to 0 in all other points of our set.

But we can select a different set of points if we want (and one good choice would be the powers of omega in the multiplicative group - see [Fields](field.md) for more info)


## Divisor polynomials

If a polynomial is supposed to be 0 in some points ($b_1, b_2 $, etc) - it means that it must be divisible by a polynomial $(x-b_1) * (x-b_2) * ...$.

That means that the result of the division should be a polynomial.

The usual places where we apply it - is during checking whether constraints are really met - we have a list of places where constraint polynomial should be 0 - then we build this divisor polynomial, and we prove (for example using FRI) that the result is really a proper polynomial.


## Proving a value of a polynomial

Let's say someone tells you - I have polynomial $f(x)$, you ask them - what's the value in $z$ - and they say $f(z) = v$. How to check it ?

You can use the same trick as above, with divisor polynomials.

Let's build a temporary polynomial $h(x) = f(x) - v$, if the computation it correct, it means that $h(z) = 0$, right ? So the polynomial $h$ should be divisible by $(x-z)$.

So you simply ask for proof, that $(f(x) - v)/(x - z)$ is a polynomial.

This trick is used in couple places during our proofs (for example in the final DEEP-FRI proving - to both check that DEEP polynomial is valid and to check that its evaluations in point $z$ are valid too).


## Combining polynomials

If $f(x)$ and $g(x)$ are polynomials of degree $d$ - then their linear combination is also a polynomial of degree $d$. For example $f(x) + g(x)$ or $f(x)*17 + g(x)*33$. 

This is the trick that we use when we create DEEP polynomial during our proofs - where we combine dozens of polynomial into one - using a random $\alpha$  and its powers - this allows us to create proof of just a single polynomial to prove them all.
