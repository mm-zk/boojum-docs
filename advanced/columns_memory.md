# Memory columns

Before reading this - please look at the [Basic Memory](../basics/memory.md) to understand how memory works and how we check consistency.

## Columns

Memory columns have to keep 3 types of information - full info in `MemorySubtree`:

* memory accesses (both read & writes, to RAM and registers) - kept in `ShuffleRamQueryColumns`
* initial and final values (see basic memory doc to understand what it is) - kept in `ShuffleRamInitAndTeardownLayout`
* delegation request and processor - for calls to delegation processors - kept in `DelegationRequestLayout`
* and things for batched_ram_accesses and register_and_indirect_accesses - these are features that allow some circuits faster access to memory and registers.

## Timestamps

You might notice that these columns don't have the "write timestamp" column - it is due to the fact that we take the timestamp from setup columns (in some cases we don't even need that - for example for riscV we get the timestamp from the row number directly).

One interesting thing, is that for each row, we increment the timestamp by 4. (so row 0 has 4, row 1 has 8 etc).

This is due to the fact, that we know that the maximum number of memory accesses per cycle will never be greater then 4 - which allows us to have different timestamps for each.

So first memory access in the first row will have timestamp 0, second will have timestamp 1 etc. And in the second row, first will have timestamp 4, next timestmap 5 etc.

This makes each memory write really unique (as timestamp differs) and solves the issue on what would happen if we were reading the same memory address twice in a single cycle (those would simply be reads at different timestamps).


