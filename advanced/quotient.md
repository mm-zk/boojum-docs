# What is quotient?

Circuit computations typically involve numerous constraints (boolean, quadratic, lookup-based). For more on constraints, please refer to [constraint](../basics/constraint.md).

For example, the [single column](../basics/single_column_proof.md) document shows how to verify a single (boolean in this case) constraint using an FRI proof. In circuits, there might be thousands of constraints, so rather than handling them one by one, we combine them into a single `quotient` polynomial.

## Constraint

Each constraint usually has two parts:
* A method to construct a polynomial that equates to 0 at the required points.
* A specification of the points where it should hold.

For instance:
* Many constraints apply to all rows except the last.
* Public input constraints might only apply to the first row.
* Some checking constraints may only be relevant for the last row.

The overall idea is to merge these constraints, which take the form $contrib(x) / matching(x)$, into one expression.

### Contrib function

This function depends on the type of constraint. For a simple boolean constraint, it would be $f(x) * (f(x)-1)$. For a linear constraint stating that the 5th witness column multiplied by 5 should equal 3, it would be $witness_5(x)*5 - 3$. The key is that if the constraint holds, this function will equal 0 at that point.

### Matching function (a.k.a divisor)

The matching function determines at which points a constraint applies. For example:
* If a constraint should only apply in the 10th row, the matching function is $(x-\omega^{10})$, since the 10th row corresponds to $\omega^{10}$ in the polynomial.
* If a constraint applies to both the 5th and 10th rows, the matching function is $(x-\omega^{5})*(x-\omega^{10})$.
* If a constraint should apply to all rows, the matching function would be $(x-\omega^{0} ) * (x - \omega^{1})* ... = (x^N - 1)$ - and this is the real reason why we picked $\omega$ - as this huge constrain nicely folds into short polynomial. See [polynomial basics](../basics/polynomials.md) for more info.
* If it should apply to all rows except the first, it becomes $(x^N - 1) / (x - 1)$.

## Putting them together

Once we have the constraints and their corresponding divisors, they are combined into a single polynomial. Demonstrating the existence of this quotient polynomial proves that all components of the combined expression are valid polynomials and that the constraints hold for their respective rows. For details, see [single_column](../basics/single_column.md).

To create this combined polynomial, we use two random values: $\alpha$ and $\beta$. These values are randomly selected based on a hash from the full trace. We proceed as follows:
1. Collect all constraints that apply to all rows and multiply each by increasing powers of $\alpha$. Then, apply the common divisor:
   
   $all\_rows(x) = (\sum_i contrib_i(x) * \alpha^i) / allRowsDivisor(x)$

2. A similar method is applied to constraints that only cover the first row, all rows except the first, etc. (typically around 6 combinations in total).

3. The final quotient is the sum of these terms, each weighted by powers of $\beta$:

   $quotient(x) = allRows(x) + firstRow(x) * \beta + exceptLast(x) * \beta^2 + ...$

## Summary

The quotient polynomial extends the approach presented in [single_column](../basics/single_column_proof.md) by incorporating all constraints simultaneously. If we can prove that the quotient is a valid polynomial, it confirms that all individual parts are also polynomials, thereby ensuring that the constraints hold on their designated rows.
