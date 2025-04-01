# Basics

This directory contains articles that introduce the proving system.

The proving system is designed to verify the successful execution of user code compiled into RISC-V assembly. It does this by generating a short FRI proof along with the final register states that programs use to return final values.

Its proof correctness can be quickly verified, and the verification time remains nearly constant regardless of the original code’s running time.

Suggested order of reading:

* [non_determinism](./non_determinism.md) – How input and output work
* [delegations](./delegations.md) – Learn how to call precompiles
* [recursion](./recursion.md) – How we prove larger programs

* [field](./field.md) – Basic math
* [polynomials](./polynomials.md) – Basic info and tricks about polynomials

* [trace](./trace.md) – How we form the execution trace
* [constraint](./constraint.md) – Basic building blocks of proofs
* [memory](./memory.md) – Insights into how memory access is represented

* [single_column_proof](./single_column_proof.md) – Putting it all together
