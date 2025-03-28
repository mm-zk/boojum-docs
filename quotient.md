# What is quotient ?

Circtuit usually contains a lot of constraints (boolean, quadratic, lookups) - please see [constraint](constraint.md) for more info.

In [single column](single_column.md) you can see how to take a single (boolean in this example) constraint and check that it holds using FRI proof.

In case of a single circuit, we might have thousands of these constraints, so instead of handling them one-by-one we combine it together into a single `quotient` polynomial.

## Constraint

Each constraint usually has 2 parts:
* how to create a polynomial that is equal to 0 in points where it should be matching
* in which points it should apply.

For example:
* many constraints would match in all rows except for the last one
* public input constraint might only apply in the first row
* some checking constraints might only apply in the last row.

So the whole idea is to take these constraints in the form of $contrib(x) / matching(x)$ and combine them together.

### Contrib function

This function depends on the type of constraint. For simple boolean it would be $f(x) * (f(x)-1)$, for a linear constraint that says that 5th witness column * 5 should be equal to 3, it would be $witness_5(x)*5 - 3$ etc.

The main goal, is that if this constraint should hold - this function should be equal to 0 in that point

### Matching function (a.k.a divisor)

If a given constraint should only match in 10th row - it would be simply equal to: $(x-\omega^{10})$ - as remember that when we put things into polynomials, the 10th row is placed in coordinate $\omega^{10}$.

If a given constraint should only match in 5th & 10th row - it would be
equal to $(x-\omega^{5})*(x-\omega^{10})$.

and so on.

The real reason why we selected $\omega$ - is when the constraint should apply to all the rows -- then the divisor would be equal to:

$(x-\omega^{0})*(x-\omega^{1})*... = (x^N - 1)$.

Which means that if divisor should apply to all the rows except first, it would be simply:

$(x^N - 1) / (x - 1)$

## Putting them together

How that we have constraints and divisors, we have to put them together into a single polynomial (and if we prove that this polynomial exists - then it means that all these constraints are really matching - please see [single_column](single_column.md) for more details why).

For this, we'll use 2 different random values: $\alpha, \beta$ (Important - they have to be randomly selected, using the seed that is based off some hash from the full trace).

We'll first collect all the constraint that should apply to all rows - and multiply them with powers of alpha - and then apply the common divisor:

$all\_rows(x) = (\sum_i contrib_i(x) * \alpha^i) / all\_rows\_divisor(x)$

Then we'd do similar thing for all constraints that apply to the first row, all rows except first etc etc (in total we have around 6 combinations).

And final quotient will be a sum of these, using powers of $\beta$ as a coefficient:

$quotient(x) = all\_rows(x) + first\_row(x) * \beta + except\_last(x) * \beta^2 + ...$


## Summary

Quotient is an extension of the example in [single_column](single_column.md) that is applied to all the constraints at the same time.

This way, if we can prove that the quotient is the actual polynomial, it automatically proves that all of the parts of it must have been polynomials too, therefore proving that the constraints did hold on their respective rows. 