# Traces, columns and polynomials

One term that will show up very often in the document is "trace".

Trace (full name is execution trace) is  basically a table - where each row is representing values of different variables during this step.


If you imagine a program like this:

```rust
for i in 0..5 {
    a += i;
}
```

Then the trace could look like this:

// TODO: insert table.

Notice - that in reality we don't create a column for each variable that exists in the program (that would not be efficient - as most variables don't change in every step) - instead we have columns for memory reads (that represent reading variables either from memory or from registers etc) - and the variables for which we'll create columns are ones that are directly tied to the execution (for example holding current program counter etc).

In practice our programs have couple hundred columns.

## Setup, witness, memory etc.

Column is column - but for readability, we group some columns into groups - especially when we mutate them during the similar step of the proving process.

Setup columns usually hold constants - values that depend on the circuit itself, but not values on which it is run.

Memory columns will be filled with data that was read from memory (which covers both ROM, RAM and registers).

Witness columns contain "generic" variables - all the values that will be computed dynamically, once we fill out the memory columns.

Stage2 columns (a.k.a) lookup columns will be filled with all the helper / temporary data to prove correctness of the lookups.

Quotient columns will contain the data to prove that all the constraints are correct.

DEEP columns will keep the final polynomial, which we'll use for proving it is a valid polynomial.



