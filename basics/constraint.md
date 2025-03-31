# Constraints

Constraints form the core building block of the circuits (referred to as the "animals" in the ZK ELI5 book).

Each constraint is defined as a polynomial equation that should equal 0 wherever the constraint applies. Typically, constraints involve variables (and constants) where each variable corresponds to a column in a trace table. In this table, every row represents the state of a variable at a specific time (i.e., during program execution).

For most constraints, we assume they must hold true in every row except the last.

## Boolean Constraint

A Boolean constraint ensures that a variable can only have the value 0 or 1. If we represent the variable's column with the polynomial f, the constraint is expressed as:

$f * (f - 1)$

Notice that this equation evaluates to 0 only when f is either 0 or 1.

## Linear and Quadratic Constraints

Also known as degree 1 (linear) or degree 2 (quadratic) constraints, these generally take the form:


$c_0 + c1_1 * var_1 + c1_2 * var_2 + c2_1 * var_3 * var_4 = 0$

By definition, the value of this equation should always equal 0.

## Public Inputs

This constraint type ensures that a specific variable (or column) matches a given public input value. However, it only applies in certain rows (typically the first or last), since it doesn't make sense for the column to equal the public input in all rows.

This is defined in the code using an enum:

```rust
pub enum BoundaryConstraintLocation {
    FirstRow,
    LastRow,
    OneBeforeLastRow,
}
```

Here, the constraint polynomial simply checks that the column equals the public input:

$f(x) - {publicInput}$

The vanishing polynomial then takes care of ensuring this check is only applied on the selected rows.

## State Linkage Constraints

Unlike the previous constraints that operate on the same row, state linkage constraints ensure consistency between consecutive rows. They verify that the value in column A of row X matches the value in column B of row X+1.

Because of the way rows are mapped to polynomial values, this is equivalent to verifying:

  
$f_a(x) - f_b(x * ω) == 0$ 

This check is typically applied only on selected rows (skipping the last two rows).

