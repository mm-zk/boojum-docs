# Traces, Columns, and Polynomials

The term "trace" (short for execution trace) is central to this document. Essentially, it's a table where each row captures the values of various variables at a specific step in a program's execution.

Imagine a program like this:

```rust
1: for i in 1..5 {
2:     a += i;
3: }
```

A corresponding trace might look like this:

| timestamp | pc   | i   | a   |
|-----------|------|-----|-----|
| 0         | 0x01 | 1   | 0   |
| 1         | 0x02 | 1   | 1   |
| 2         | 0x01 | 2   | 1   |
| 3         | 0x02 | 2   | 3   |
| 4         | 0x01 | 3   | 3   |
| 5         | 0x02 | 3   | 6   |


Note that we don't create a column for every program variable (since most don't change every step). Instead, we include columns for significant memory reads (from memory, registers, etc.) and for variables directly involved in execution (like the program counter).

In practice, our programs include hundreds of columns.

## Setup, Witness, Memory, etc.

While each column represents a value, related columns are grouped for clarity—especially when multiple columns are updated during the same step of the proving process.

- Setup columns contain constants that define the circuit; these values remain the same regardless of the run.
- Memory columns record data read from memory, including ROM, RAM, and registers.
- Witness columns hold "generic" variables computed dynamically as memory columns are populated.
- Stage2 columns (also known as lookup helper and range check columns) store helper or temporary data needed to verify lookup correctness.
- Quotient columns gather data used to prove that all constraints are met.
- DEEP columns store the final polynomial, ensuring it is valid for the proof.

