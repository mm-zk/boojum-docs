# Lookups and Range Checks

Often in circuits, you need to verify an inequality—for instance, that a given value fits in a u16. Regular constraints work well for equality checks, but not so much for proving the opposite condition. We solve this by using lookup tables.

For example, if you need to ensure that $x < 2^{16}$, you can create a table of all values from 0 to 65535. Then, by proving that x matches one of those entries, you effectively confirm the inequality.

Lookup tables are also useful for demonstrating the results of operations like XOR or hashing. Some operations are difficult to define as code but simple to represent in a table that maps possible inputs to outputs. In boojum 2.0, there are around 40 different tables (see `enum TableType`) covering a range of functions—from binary operations like OR and XOR to power of 2 calculations and bit-specific range checks.

While adding a new table to the circuit can be costly (because all its values must be inlined into the main trace table, specifically into the setup columns), it is sometimes necessary.

## Step 1 - Adding a Table

If your circuit requires a particular lookup table, it must be enabled in the table driver. This ensures that during circuit compilation, all the elements from the table will be incorporated into the setup columns (specifically into generic_lookup_columns).

## Step 2 - Multiplicities Table

Each generic lookup column in the setup table will have a corresponding "multiplicities" column in the witness trace. This column tracks the number of times each table entry is accessed during the circuit’s execution.

## Step 3 - Lookup Column

Lastly, the witness table will include several lookup columns. These are where the values, which will be verified against the lookup tables, are placed.

## Putting It All Together

For simplicity, assume that the lookup table has a width of 1 (although in practice, they usually have a width of 3 columns plus an additional column for the table ID).

This means that, for example, the 3rd column in the setup trace will contain all the table elements. The 7th column in the witness trace will hold the multiplicities, and the 15th column will contain the values that must match an entry in the table.

Imagine you have a lookup table containing only even numbers. The table might look like this (note that multiplicities and values are filled during witness generation):

| setup | multiplicities | values |
|-------|----------------|--------|
| 0     | 1              | 2      |
| 2     | 3              | 2      |
| 4     | 1              | 0      |
| 6     | 0              | 4      |
| 8     | 0              | 2      |

To prove the validity of the lookup, you will compare multisets using a grand product:

$\Pi_x  (setup[x] + \gamma) ^ {mult[x]}  == \Pi_x (values[x] + \gamma)$
