# Non determinism a.k.a I/O

Most of programs require some kind of inputs and outputs - they would open files, listen on the network sockets etc.

In case of boojum 2.0 - all of this is happening via reads & writes to a special CSR register.

We'll use register `0x7c0` (1984) for all the input & outputs.

We'll use the similar way of communication for delegations too - having different delegation coprocessors under different register values (for example `0x7c2` for blake32 etc). More info in [Delegations](delegations.md) page.

## Using CSR register

For example, if the program wants to read something from the outside - it should first define what it wants to read - by sending the bytes to that register using a helper method:

```rust
pub fn csr_write_word(word: usize) {
    unsafe {
        core::arch::asm!(
            "csrrw x0, 0x7c0, {rd}",
            rd = in(reg) word,
            options(nomem, nostack, preserves_flags)
        )
    }
}
```

Such opcode will be caught by the risc v simulator - and handled (usually by calling a specific "Oracle", that would be able to provide some data, which later can be read by your program by calling `csr_read_word`).

```rust
fn csr_read_word() -> u32 {
    let mut output;
    unsafe {
        core::arch::asm!(
            "csrrw {rd}, 0x7c0, x0",
            rd = out(reg) output,
            options(nomem, nostack, preserves_flags)
        );
    }

    output
}
```

Note - as all programs are deterministic - we can record all the data that is being fed to the csr_read_word - and during proving time, we no longer need to run custom oracles code - but just provide the stream of this data (and ignore any data that the program writes in `crs_write_word()`).

## Final outputs

It is important that the program returns the final outputs inside the registers - rather than trying to write them into CRS.

usual flow, is that the program reads the expected output value from the input, and then simply returns "1" in register if this is correct and 0 otherwise.

Final register values are being passed through the recursion steps - therefore even the final recursion step keeps them, and allows final caller to easily verify their value.

