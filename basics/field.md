# Fields and basic concepts

All the operations in Boojum are happening on the Mersenne31 field - which is natural numbers modulo prime $p$, where $p = 2^{31} - 1$.


Using such fields means that:

* to represent larger numbers, like u32, you have to use 2 separate elements
* for safety we assume that most of the entries in the field are smaller than u16
* for larger operations (where we need u64 etc) - we keep using `Mersenne31Complex` (holding 2 elements) and `Mersenne31Quartic` (holding 4 elements).


## Multiplicative groups in fields - omega

In the documentation and code, you'll see $\omega$ - here's the quick explaination how it works.

Let's use a field with a smaller prime - for example 17, pick a number 3 - and see what happens when we start multiplying 3 by itself within this field:

```
3^1 = 3
3^2 = 9
...
3^16 = 1
3^17 = 3 
```

So in our scenario, 3 is a generator of a multiplicative group of size 16 (this group also happens to contain all the elements of the field except for 0 - but this doesn't always have to be the case).

Now let's look at some cool features:

if 3 is a generator of the group of size 16, then $3^2 = 9$ is a generator of a group of size 8, and $9^2 mod 17 = 13$ is a generator of a group of size 4.

```
13^1 = 13
13^2 = 16
13^3 = 4
13^4 = 1
```

You can also notice that there can be multiple groups of size 4 - we can create a new one, by simply multiplying the generator by the original generator $3$.

```
3*13^1 = 5
3*13^2 = 14
3*13^3 = 12
3*13^4 = 3
```

These are so called "cosets" - and we will be using them when we do Low Degree Extensions in our code.

You can see the things above visualized on images below:

![Omega 3 Generator](images/omega_3_generator.png)

![Omega 9 Generator](images/omega_9_generator.png)

![Omega 9 coset](images/omega_9_coset.png)


## Why Mersenne field ?

In the previous system, we used Goldilocks field $p = 2^{64} − 2^{32} +1$, that had a nice large multiplicative group with a high 2-adicity (so the size of this group was divisible by a large power of 2).

In case of mersenne field, the group that is spread on it, doesn't have this property (it is only divisible by $2^1$).

So instead, we'll do most of the operations on the `MersenneComplex` struct - that is an  extension field (think - complex numbers) - and has a group of size $2^31$. 

If you're curious: this is the generator for this group:

```rust
pub const TWO_ADIC_GENERATOR: Self = Self {
    c0: Mersenne31Field::new(311014874),
    c1: Mersenne31Field::new(1584694829),
};
```

## Why multiplicative groups

There are reasons why we decided to do operations in such groups, rather than directly on the elements of the field.

The main reason, is the fact that we have to keep computing "vanishing polynomial". (see [Basic polynomials](polynomials.md) for more info).

Imagine that you have to compute the polynomial that looks like this:

$(x-a_0) * (x-a_1) * (x-a_2) * ... * (x-a_{8388607})$

This would result in a very large polynomial with lot of coefficients.

But here's where the multiplicative groups help.

Let's start with a simple example: 

16 is a generator of a group of size 2 in field modulo 17.

```
16^1 = 16
16^2 = 1
```

Let's compute:

$(x-16) * (x-1) = x^2 - (16+1)x +16 = x^2 - 1$

As you can see - most of the terms have "zero-ed" out, and we got a nice short polynomial.

This actually applies to any generator, you can compute it for 3 (generator of size 16):

$(x-3) * (x-9) * ... * (x-1) = x^16 - 1$

And that's the main secret - by using powers of $\omega$ as positions of $a$ - we can easily compute the values of such large polynomial very quickly - and this is crucial, as it must be done during the verification of the proof.

## Why 2-adicity

In FRI, we'll be "folding" the polynomial, by cutting its degree by half - this means that being a large power of two, means that we can keep doing it for a long time, resulting in a small final polynomial degree.
