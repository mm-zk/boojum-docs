# Delegations (also known as Precompiles or Coprocessors)

While most operations can be directly compiled into RISC-V assembly, some complex and frequently used operations may benefit from a custom circuit implementation. However, note that creating circuits is error-prone and can lead to higher maintenance costs. Today, we support around 3–4 delegations, which include:

* Blake hash function
* Poseidon hash function
* Ecrecover
* Big integer math operations

## Calling a Delegation

To invoke a precompile, you must call the correct CRS register. Each precompile is assigned a unique number; for example, Blake uses `0x7c1`.

When you execute this assembly instruction, you need to provide the offset of the memory location for the input ABI structure. The structure of this ABI is specific to each precompile, so please refer to the respective documentation to determine the correct parameters. Any outputs from the precompile are written back to the same memory location.

```rust
fn csr_trigger_delegation(offset: usize) {
    debug_assert!(offset as u16 == 0);
    unsafe {
        core::arch::asm!(
            "csrrw x0, 0x7c2, {rs}",
            rs = in(reg) offset,
            options(nostack, preserves_flags)
        )
    }
}
```

## Proving Delegations

Since each delegation involves a distinct circuit, separate proof files will be created for each one. These files may contain dozens or even hundreds of delegation calls, depending on the specific type. During verification—for instance, during recursive verification—the list of delegation calls from the main program trace is compared with the proven list in the delegation proofs.
