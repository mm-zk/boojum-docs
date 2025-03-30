# Delegations (a.k.a precompiles / coprocessors)

While all the operations could be compiled into risc_v assembly directly, for some complex ones that are used a lot, we migth do a better job writing a custom circuit.

This should be very rare - as writing circuits is very error prone and adds additional maintenance.

Currently we have around 3-4 delelegations, that cover things like:
* blake hash function
* poseidon hash function
* ecrecover
* big integer math operations


## Calling delegation

To call a precompile, you have to call a proper CRS register - each precompile has a different number - for example blake has `0x7c1`.

When you call this assembly instruction, you have to pass it the offset of the memory, where the ABI (input structure) is located.

ABI is precompile specific - so you have check precompile documentation to see what to pass.

Any precompile outputs are also written back into that memory location.

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


## Proving

As each delegation is a different circuit, we'll create separate proof files for each one (each file having dozens to hundreds of delegation calls - depending on the type).

They will be read during verification - for example during recursion.
Recursion verification will collect the list of delegation calls from the main program trace, and compare it with the list of delegations that were proven in the delegation proofs.


