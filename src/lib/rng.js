/**
 * Seeded randomness.
 *
 * PLAN 2.2 rule 3: `generate` must be pure and take `rng` last. Everything in
 * here therefore takes the generator as an injected argument and never reaches
 * for `Math.random` itself — that single rule is what makes the whole content
 * layer testable, and PLAN 6 has the tests stub `Math.random` to throw.
 */

/**
 * mulberry32 — a 32-bit seeded PRNG. Tiny, fast, and good enough for shuffling
 * a deck of eighteen cards. The same seed always produces the same sequence.
 *
 * @param {number} seed  Coerced to a uint32, so any integer works.
 * @returns {() => number} A generator returning floats in [0, 1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;

  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates. Returns a new array; the input is never mutated, because a
 * caller that shuffles the same source deck twice must get the same source
 * deck back both times.
 *
 * @template T
 * @param {readonly T[]} array
 * @param {() => number} rng
 * @returns {T[]}
 */
export function shuffle(array, rng) {
  const out = [...array];

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

/**
 * Draw `n` items without replacement — a partial Fisher-Yates over a copy, so
 * an item can never appear twice.
 *
 * Asking for more than exists **throws** rather than quietly returning a short
 * array. PLAN 4.3 documents a stratified block that genuinely runs out of cards
 * at the top of its range; a sampler that silently hands back four items when
 * asked for six turns that into a wrong deck instead of a loud failure.
 *
 * @template T
 * @param {readonly T[]} array
 * @param {number} n
 * @param {() => number} rng
 * @returns {T[]}
 */
export function sample(array, n, rng) {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`sample(): n must be a non-negative integer, got ${n}`);
  }

  if (n > array.length) {
    throw new RangeError(
      `sample(): asked for ${n} items but only ${array.length} are available`
    );
  }

  const pool = [...array];
  const out = [];

  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }

  return out;
}
