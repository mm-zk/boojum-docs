# Recursion a.k.a Proving Larger Programs

Currently, we can prove a circuit that has at most $2^{22}$ traces (cycles). This limitation means we need a different solution for longer programs.

The idea is simple: run the entire program and split its execution trace into chunks of $2^{22}$. For each chunk, we also record the output state so that we can compare it with the input state of the next chunk.

By doing this, we create several circuits that together represent the full computation.

Next, we apply recursion. We run a new program that verifies all these proofs by checking that the outputs and inputs of consecutive circuits match.

Then, we create a proof for this new program. If done correctly, this proof will require fewer cycles than the original, resulting in a smaller number of proofs.

We can repeat this verification process—prove the verification, then prove that proof, and so on.

After several iterations, we end up with a final proof that can be passed to our caller.

## Small Caveats

In practice, we also use precompiles (delegations) that generate their own set of proofs, which must be verified during the process.

Thus, in the final step, we might need to run a slightly modified version of our circuit that does not use these delegations and possibly has a longer trace. This change ensures that the final proof is contained within a single file.