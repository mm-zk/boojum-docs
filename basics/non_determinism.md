# Non determinism a.k.a I/O

Most programs require some form of input and output, such as opening files or listening on network sockets.

In boojum 2.0, all input/output operations are handled by reading from and writing to a special CSR register. We use register `0x7c0` (1984) for every I/O operation.

Similarly, we manage delegations through designated delegation coprocessors, each associated with a unique register value (for example, `0x7c2` is used for blake32). More details are available on the [Delegations](delegations.md) page.

## Using the CSR Register

If a program needs to read external data, it must first indicate what to read by sending bytes to the CSR register using a helper method:

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

This instruction is intercepted by the RISC-V simulator, which processes it (typically by invoking a specific "Oracle" that supplies the required data). Later, the program can retrieve the data by calling `csr_read_word`.

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

Note – Since programs are deterministic, you can record all data supplied to the `csr_read_word`. Then, during verification, you no longer need to execute custom Oracle code; instead, you provide the recorded data stream (ignoring any data the program sends via `csr_write_word`).

## Final Outputs

It is crucial that a program returns its final outputs via registers, rather than writing them to the CSR.

Typically, the program retrieves an expected output from input, then returns "1" in a register if it matches, or "0" if it does not.

The final register values are propagated through all recursive steps, allowing the final caller to verify the result easily.
