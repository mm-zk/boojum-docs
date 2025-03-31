## Single column proof

Let's examine a single column. We start with a column that should only contain boolean values.

The prover asserts that the column contains exclusively 0 and 1 values.

We then ask the prover to create a polynomial over these values (f) such that $f(\omega) = col[0]$, $f(omega^2) = col[1]$, etc.

For now, let's assume the prover is honest about how the polynomial is computed (we will address potential dishonesty later).

Given this assumption, how can we verify that all the values are indeed 0 or 1?

First, we ask the prover to compute the polynomial $g(x) = f(x) * (f(x)-1)$. Notice that if $f(x)$ truly only takes the values 0 or 1 at the points $\omega$, then $g(x)$ will be 0 at those points.

This implies that all these points are roots of the polynomial, so it can be factored as: $g(x) = (x-\omega) * (x-\omega^2)*...*(x-\omega^{n-1})*q(x)$ , where $q(x)$ is the remainder.

It is important to note that because we selected these special points $\omega$, the product $(x-\omega)*(x-\omega^2)...$ simplifies to $(x^N-1)$.

Thus, we need to show that the polynomial $g(x) = (x^N-1)*q(x)$, or equivalently:

$q(x) = g(x) / (x^n - 1)$

We then verify that $q(x)$ is indeed a polynomial using fri queries as explained in [fri_query.md](fri_query.md).
