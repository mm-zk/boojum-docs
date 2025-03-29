# Constraints

Constraints are the core building block of the circruits (they are the "animals" from the ZK ELI5 book).

For each constraint, we need a way to represent it as such a polynomial equation, that it should be equal to 0 in all the places where the constraint should be met. 

Constraints are usually operating on top of variables (and constants) - where in our case, we can think about a variable as a column in our trace table (where each row represents the state of this variable at a given moment in time a.k.a program execution).

To make things simpler - for most of the constraints, we assume that they should match on all rows (except last). 

## Boolean constraint

This is the simplest type of constraint - we claim that a given variable should be a boolean, so have a value of 0 or 1. 

If we say that polynomial $f$ is representing the column of this variable, then our contrib polynomial equation becomes $f * (f-1)$. You can easily notice, that as long as $f$ is 0 or 1, the output polynomial will be equal to 0.


## Linear and quadratic constraints

Also known as degree 1 or degree 2 constraints.

They are usually in a form of $c_0 + c1_1 * var_1 + c1_2 * var2 + c2_1 * var_3 * var_4 = 0$

The great thing about them, is that by definition the equation that they are representing should be equal to 0.

## Public inputs 

This is the special type, as on one side it is simple - usually wanting to simply check that a given variable / column is matching the value from the public input.

At the same time, it should be checked only in a few places - like first or last row (as it doesn't make sense for the column to be always equal to public inputs in all the rows.)

Currently we have it defined as an enum:

```rust
pub enum BoundaryConstraintLocation {
    FirstRow,
    LastRow,
    OneBeforeLastRow,
}
```

In this case, the contrib polynomial is quite easy - simply checking that column is equal to public input value - $f(x) - public\_input$ - but the magic is in the vanishing_polynomial (which controls on which rows this contrib polynomial should be checked).


## State linkage constraints

All the constraints abiove were operating over the columns from the same row, but in many cases we need to check the consistency **between rows**.

State linkage is doing exactly that - checking that a column A from row X is matching the value from column B from row X+1.

Due to the way how we map rows into polynomial values, this is equivalent to checking that $f_a(x) - f_b(x * \omega) == 0$ and of course applying it only on selected rows (we usually skip last 2 rows in such constraints).

