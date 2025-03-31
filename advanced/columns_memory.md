# Memory Columns

Before reading this section, please review the [Basic Memory](../basics/memory.md) guide to understand memory operations and consistency checks.

## Columns

Memory columns store three types of information within `MemorySubtree`:

- Memory accesses (both reads and writes to RAM and registers) are recorded using `ShuffleRamQueryColumns`.
- Initial and final values (refer to the basic memory documentation for details) are maintained with `ShuffleRamInitAndTeardownLayout`.
- Delegation requests and processors are managed by `DelegationRequestLayout` for delegation processor calls.
- Additional data for batched_ram_accesses and register_and_indirect_accesses, which help improve circuit access speed to memory and registers.

## Timestamps

You'll notice that these columns do not include a "write timestamp" field. This is because the timestamp comes from the setup columns—in some cases, it isn’t even necessary (for example, in riscV, where the timestamp is directly derived from the row number).

A notable feature is that for each row, the timestamp increments by 4 (so row 0 has a timestamp of 4, row 1 has 8, etc.). This works because the maximum number of memory accesses per cycle is limited to 4, ensuring that each access within a row receives a distinct timestamp.

For instance, in the first row, the first memory access gets timestamp 0, the second gets timestamp 1, and so on. In the next row, the first access gets timestamp 4, the next gets timestamp 5, etc. This method guarantees that each memory write is uniquely timestamped, even if the same memory address is read multiple times within a single cycle.
