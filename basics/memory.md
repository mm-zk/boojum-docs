# Memory and registers

In this article, we'll cover memory and register access - which is done in basically every single step.


Imagine you have the following code:

```asm
set r2, 0
add r2, 5
add r2, 7
```

In each step, you add some constant to register 2 - how should this be represented in our trace ?

If you look at the middle step - what we're actually doing is:

* reading value 0 from register 2
* adding 5 to it
* writing value 5 into register 2

And that's how it will be represented in the trace.
We know that each step can access at most 3 different memory/register slots (1-2 for reading, and 1 for writing), so the code above will be written to the trace as:

// TODO: add trace.

To make things easier later, we can treat each read, as a write - but making sure that we are writing back the same value.

So each such operation would look like the tuple below:

(read_address, last_written_timestamp, read_value, current_timestamp, written_value)

Now how can we prove that all accesses to the memory or registers were correct. We do the following trick.

Each such operation is broken into two pieces:

* 1: (read_address, last_written_timestamp, read_value)
* 2: (read_address, current_timestamp, written_value)

moreover we'll also add "boundary" values:
* for init -- all "(read_address, 0, 0)
* for teardown -- all "(read_address, last_written timestamp, last_value)"


## Proving consistency

If you look carefully, you can notice that if set 1 + teardown matches set 2 + init - it means that all the memory reads & writes were consistent.

This is due to a fact that each write is unique (it must have unique timestamp) - and for every written value, we should have a read value with exactly identical parameters (as the "last_written_timestamp" in the read should match the timestamp from the right).

We can prove such set matching - by computing the multiplication of all the elements from the first group (+ random $\alfa$) and doing the same to the last group. If the final value matches, it means that both sets were equal.



