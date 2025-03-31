# Memory and Registers

In this article, we'll explain memory and register access, which is used in nearly every execution step.

Consider the following code:

```asm
set r2, 0
add r2, 5
add r2, 7
```

In each step, you add a constant to register 2. How should this be captured in our trace?

Take the middle step as an example. What happens is:

* The value 0 is read from register 2.
* 5 is added to it.
* The result, 5, is written back into register 2.

This sequence will be reflected in the trace. We know that each step can have up to three memory/register interactions (two reads and one write). Thus, the code will be recorded in the trace as:

// TODO: add trace.

To simplify things later, we treat each read operation like a write, ensuring that we write back the same value. So each operation is represented as a tuple:

```
(read_address, last_written_timestamp, read_value, current_timestamp, written_value)
```

But how do we prove that all memory and register accesses were performed correctly? We use the following method.

Each operation is split into two parts:

1. (read_address, last_written_timestamp, read_value)
2. (read_address, current_timestamp, written_value)

Additionally, we include "boundary" values:
* For initialization — all entries are "(read_address, 0, 0)"
* For teardown — all entries are "(read_address, last_written_timestamp, last_value)"

## Proving Consistency

If you inspect the process, you'll notice that if the set of operations from the initialization plus teardown matches the set from the read and write stages, it means every memory and register access is consistent.

This works because every write has a unique timestamp. For each value written, there should be a corresponding read where the "last_written_timestamp" exactly matches the write's timestamp.

To verify that both sets are identical, we multiply all the elements from the first group (with an added random $\alpha$) and compare it to the multiplication of all elements from the second group. If the final results are the same, the sets match.
