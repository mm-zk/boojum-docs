# Setup Columns

Setup columns act like constants: their values are established during circuit "compilation" time and remain unchanged during execution.

Currently, there are three types of setup columns:

* Timestamps
* Range check 16
* Generic lookups

These columns are populated during circuit compilation in the SetupPrecomputations stage.

## Timestamps

The Timestamp column has a size of 2 and increases with each row. (It has size 2 since our circuits can handle up to 2^24 rows, and for simplicity we treat the timestamp as u32.)

For each row, the timestamp typically increases by multiples of 4 (e.g., the first row has a timestamp of 0, the second 4, and so on). This increment is controlled by `NUM_EMPTY_BITS_FOR_RAM_TIMESTAMP`. Using multiples of 4 allows us to timestamp up to 4 memory accesses within a single step uniquely.

An optimization exists: if timestamp shuffling is not required, the column is not created implicitly. This is generally acceptable for the main RISC-V circuit, where the timestamp is increased in every step. However, for delegation circuits— which process delegations arriving at different timestamps— the columns must be explicitly included.

## Generic Lookups

These columns store all elements from lookup tables. Each set of columns is sized to 4, which is the maximum size for a single lookup table entry (3 columns for data, with the last column used for the lookup table id).

If the number of lookup entries exceeds the number of rows, additional copies of these columns may be created so that all elements fit.

## Range Check

A single column is used to store every value in the range $0 .. 2^{16}$. We use many u16 checks since u32 values don’t fit our field, and we assume that the highest value in any cell is a u16.

Because a u16 check only requires one column—and because there’s no need to store an extra column with a table id—it is more efficient to use a single column instead of the four that would be necessary if combined with the generic lookups.

## Example Trace Table

Below is an example trace table. The table includes the timestamp (represented as a single column), a u16 range check, and generic lookups (illustrated by an XOR operation with table_id = 5):

| Timestamp | Range Check | Generic 1 | Generic 2 | Generic 3 | Generic 4 |
|-----------|-------------|-----------|-----------|-----------|-----------|
| 0         | 0           | 0         | 1         | 1         | 5         |
| 4         | 1           | 1         | 2         | 3         | 5         |
| 8         | 2           | 2         | 0         | 2         | 5         |
| 12        | 3           | 3         | 4         | 7         | 5         |
| 16        | 4           | 4         | 5         | 1         | 5         |
| 20        | 5           | 5         | 6         | 3         | 5         |
