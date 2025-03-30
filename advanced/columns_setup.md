# Setup columns

Setup columns can be considered "constants" - their values can be filled during circruit "compilation" time, and they don't depend on any execution parameters.


Currently we have 3 different ones:

* timestamps
* range check 16
* generic lookups


We fill out these columns during circruit compilation - in SetupPrecomputations.

## Timestamps

Timestamp column has size 2, and increases in every row. (it has size 2, as our circuits can handle up to 2^24 rows,  and for simplicity we consider timestamp to be u32).

For each row, we usually use multiplications of 4 (so first row has timestamp 0, second timestamp 4 etc) - controlled with NUM_EMPTY_BITS_FOR_RAM_TIMESTAMP. 
This allows us to have fine-grained timestamps for memory accesses (as we can do up to 4 memory accesses within a single step - we can give them unique timestamps).

We actually have an optimization, that if we don't need to shuffle timestamps, we don't create this column implicitly.  This is usually the case for main risc V circruit (as we increment timestamp in each step).
For delegation circruits - that are processing delegations coming at different timestamps, these columns must be explicitly present.



## Generic lookups

These columns keep all the elements from lookup tables. Each "column set" has size 4 (which is the max size of a single lookup table entry - which is 3 + last column is used to keep lookup table id).

If number of lookup entries is larger than number of rows, we might create more copies of these columns, so that all elements fit.


## Range check

A single column, that keeps all values from 0 .. 2^16. We are using a lot of u16 checks (this is due to the fact that u32 doesn't fit our field, so we usually assume that the highest value that we keep in a given cell is u16).

As u16 check just requires a single column, plus we don't need to store additional column with table id, this allows us to use just a single column instead of 4, that we would have used if we kept it together with other generic lookups.

## Example trace table

In the table below, with timestamp (here represented as single column, u16 range check, and generic lookups - here showing a XOR with table_id = 5)

| Timestamp | Range Check | Generic 1   | Generic   2 | Generic 3  | Generic 4 |
|-----------|-------------|-------------|-------------|------------|-----------|
| 0         | 0           | 0           | 1           | 1          | 5         |
| 4         | 1           | 1           | 2           | 3          | 5         |
| 8         | 2           | 2           | 0           | 2          | 5         |
| 12        | 3           | 3           | 4           | 7          | 5         |
| 16        | 4           | 4           | 5           | 1          | 5         |
| 20        | 5           | 5           | 6           | 3          | 5         |
