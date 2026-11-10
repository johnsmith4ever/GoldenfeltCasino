/* Keno: pick up to 10 of 80 numbers; the game draws 20. */

export const POOL = 80
export const DRAWN = 20
export const MAX_PICKS = 10

/** Multiplier paid for [numbers picked][numbers matched]. Anything not listed pays nothing. */
export const PAYTABLE: Record<number, Record<number, number>> = {
  1: { 1: 3.8 },
  2: { 2: 15.6 },
  3: { 2: 4, 3: 27 },
  4: { 2: 2, 3: 7.4, 4: 65 },
  5: { 3: 5.2, 4: 26, 5: 285 },
  6: { 3: 2.8, 4: 9.8, 5: 61, 6: 820 },
  7: { 4: 7.4, 5: 32, 6: 245, 7: 3950 },
  8: { 5: 23.8, 6: 127, 7: 1150, 8: 5000 },
  9: { 5: 11.4, 6: 48, 7: 305, 8: 3300, 9: 5000 },
  10: { 5: 7, 6: 23, 7: 114, 8: 870, 9: 2500, 10: 5000 }
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/** Exact chance of matching exactly `hits` of your `picks` numbers. */
export function hitProbability(picks: number, hits: number): number {
  return (choose(picks, hits) * choose(POOL - picks, DRAWN - hits)) / choose(POOL, DRAWN)
}

export function payMultiplier(picks: number, hits: number): number {
  return PAYTABLE[picks]?.[hits] ?? 0
}

/** Long-run return to player for a given number of picks. */
export function returnToPlayer(picks: number): number {
  let r = 0
  for (const [h, m] of Object.entries(PAYTABLE[picks] ?? {})) r += m * hitProbability(picks, Number(h))
  return r
}

/** Chance that a ticket pays anything at all. */
export function hitRate(picks: number): number {
  let r = 0
  for (const h of Object.keys(PAYTABLE[picks] ?? {})) r += hitProbability(picks, Number(h))
  return r
}

function partialShuffle(count: number, rng: () => number): number[] {
  const a = Array.from({ length: POOL }, (_, i) => i + 1)
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (POOL - i))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, count)
}

export function drawNumbers(rng: () => number = Math.random): number[] {
  return partialShuffle(DRAWN, rng)
}

export function quickPick(count: number, rng: () => number = Math.random): number[] {
  return partialShuffle(count, rng).sort((a, b) => a - b)
}
