## Single column proof

Let's look a at a single column - let's start with a column that should contain only boolean values.

Prover is telling us, that he put only 0 & 1 values in that column.

We ask the prover to create a polynomial over these values (f) - so that $f(\omega) = col[0]$, $f(omega^2) = col[1]$, etc.


For now - let's assume for a second that prover is honest about the way how he computes the polynomial (we'll remove this assumption soon).

In such case - how can we easily check that all the values are really 0 or 1 ?

First, let's ask prover to compute polynomial  $g(x) = f(x) * (f(x)-1)$. If you look at this polynomial carefully, you'll notice that it iff $f(x)$ really had only values 0 or 1 in points $\omega$ - then $g(x)$ would have values 0 there.

This means that all these points are root points for the polynomial q, so it can be factored into: $g(x) = (x-\omega) * (x-\omega^2)*...*(x-\omega^{n-1})*q(x)$ - where $q(x)$ is some remainder.

And here comes the reason why we selected such special points as $\omega$ for the places where we put our values -- thanks to that, this long multiplication $(x-\omega)*(x-\omega^2)... = (x^N -1)$

So now, we just need to prove that polynomial $g(x) = (x^N-1)*q(x)$ or, if we revert the equation:

$q(x) = g(x) / (x^n - 1)$

So we have to check that $q$ is really a polynomial (which we can do using fri queries: [fri_query.md](fri_query.md))
