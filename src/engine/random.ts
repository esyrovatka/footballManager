/**
 * Mulberry32 — small, fast, deterministic 32-bit PRNG.
 * Same seed → same sequence. Used so a match can be replayed identically
 * from its engine_seed.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function pick<T>(rand: Rng, list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

export function weightedPick<T>(rand: Rng, items: T[], weight: (item: T) => number): T {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return items[Math.floor(rand() * items.length)];

  let r = rand() * total;
  for (const item of items) {
    r -= Math.max(0, weight(item));
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}
