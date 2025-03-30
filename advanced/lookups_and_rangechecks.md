# Lookups and range checks

One thing that we have to often do in a circruit, is check some inequality - for example that a given value first in u16.

Unfortunately regular constraints are not great at that - they check that something is equal to something else, but proving the opposite is very hard.

That's why we turn things around and use lookup tables.

When you say "I want to check that x <  2^16" - you can represent it as - here's a table with all the values from 0 to 65535 - and please prove that this value is matching some element in there.

This can be also useful if you want to represent the results of some other operations (like Xor or hashing) - that might be hard to build as code - but easy to generate a table with all the possible inputs and outputs, and prove that your input and output pair belongs to this table.

In boojum 2.0, we have around 40 different tables (check enum TableType) - ranging from binary operations (like Or or Xor), to tables with power of 2, range checks for different bits etc.

Adding a new table to the circruit can be expensive (as you have to inline all its values into the main trace table - into setup columns) - but in many cases it is unavoidable.

## Step 1 - adding a table

If your circtuit wants to use a given lookup table, it has to be explicitly enabled in the table driver. 

This way, when we start compiling the circuit into the trace, the compilation process will take all the elements from this table, and inline them into setup columns (into generic_lookup_columns to be specific).

## Step 2 - multiplicities table

For every generic lookup column in the setup table, there will be a corresponding "multiplicities" column in witness trace.

Its role is to keep track of how many times a given table entry was accessed during program execution.

## Step 3 - lookup column

Finally, the witness table would also have multiple lookup columns in witness trace - where the values that should be present in lookup tables will be placed.


## Putting it all together

For simplicity, let's assume that our lookup table has width 1 (in practive, they usually have a width of 3 columns + one more for table id.)

This means that let's say a 3rd column in setup trace will contain all the elements of the table.

There will be 7th column in witness that will be holding mulitplicities, and 15th column in witness where all the values present should be in the table.

Imagine we have a lookup table that holds only even numbers:

It would look like this - notice that multiplicities & values are filled during witness generation.

| setup | mutiplicities | values |
|-------|---------------|--------|
| 0     | 1             | 2      |
| 2     | 3             | 2      |
| 4     | 1             | 0      |
| 6     | 0             | 4      |
| 8     | 0             | 2      |


For proving, what we'll have to compare multisets - using a grand product of 

$\Pi_x  (setup[x] + \gamma) ^ {mult[x]}  == \Pi_x (values[x] + \gamma) $