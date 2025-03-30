# Recursion a.k.a proving larger programs

Currently we can prove a circuit that has at most $2^{22}$ traces (cycles) - so we need a different solution for programs that are longer.

The TL;DR of the idea - so to run the whole program, and split its execution trace into chunks of 2^22. For each one, we'll also remember some output state - so that we can compare it with the input state of the next one.

This way, we'll end up with some number of circuits, that would represent the whole computation.

Now, what we can do - is recursion - run a new program, that would verify all those proofs, and check that the inputs and outputs of consecutive circuits are matching.

And then we can create a proof of this program too! And if we did the right job, this proof will require less cycles than the original program, so we'll end up with smaller number of proofs.

Which we can verify again, and prove this verification etc etc.

After multiple steps, we should be able to end up with a final proof - that we can pass to our caller.

## Small caveats

In practice, we also have precompiles (delegations) - that would produce their own set of proofs, that we will have to verify in the process too.

So in the final step - we might want to run a slightly different version of our circruit, that doesn't use any delegations - and potentially has longer trace - so that the final proof is a single file.