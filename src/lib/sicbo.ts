/* Sic Bo: three dice. */

export type Dice = [number, number, number]

export interface SpotInfo { key: string; label: string; pays: string }

const TOTAL_PAYS: Record<number, number> = { 4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60 }

export const isTriple = (d: Dice): boolean => d[0] === d[1] && d[1] === d[2]
export const diceTotal = (d: Dice): number => d[0] + d[1] + d[2]

/** Multiplier (profit per chip staked) a spot pays for these dice, or 0 if it loses. Singles pay per matching die. */
export function spotWin(key: string, d: Dice): number {
  const total = diceTotal(d)
  if (key === 'small') return !isTriple(d) && total >= 4 && total <= 10 ? 1 : 0
  if (key === 'big') return !isTriple(d) && total >= 11 && total <= 17 ? 1 : 0
  if (key === 'any3') return isTriple(d) ? 30 : 0
  if (key.startsWith('sum')) return total === Number(key.slice(3)) ? TOTAL_PAYS[total] : 0
  if (key.startsWith('tr')) { const n = Number(key.slice(2)); return d[0] === n && d[1] === n && d[2] === n ? 180 : 0 }
  if (key.startsWith('d')) { const n = Number(key.slice(1)); return d.filter((x) => x === n).length >= 2 ? 10 : 0 }
  if (key.startsWith('n')) { const n = Number(key.slice(1)); return d.filter((x) => x === n).length }
  return 0
}

export function settleSicBo(spots: Record<string, number>, d: Dice) {
  const returns: Record<string, number> = {}
  let returned = 0
  let staked = 0
  for (const [key, stake] of Object.entries(spots)) {
    if (stake <= 0) continue
    staked += stake
    const m = spotWin(key, d)
    returns[key] = m > 0 ? stake * (1 + m) : 0
    returned += returns[key]
  }
  return { returns, returned, staked, net: returned - staked }
}

export const ALL_SPOT_KEYS: string[] = [
  'small', 'big', 'any3',
  ...[1, 2, 3, 4, 5, 6].map((n) => `n${n}`),
  ...[1, 2, 3, 4, 5, 6].map((n) => `d${n}`),
  ...[1, 2, 3, 4, 5, 6].map((n) => `tr${n}`),
  ...Array.from({ length: 14 }, (_, i) => `sum${i + 4}`),
]

export const totalPays = (t: number): number => TOTAL_PAYS[t]

/** Exact house edge for a spot, from all 216 possible rolls. */
export function houseEdge(key: string): number {
  let ret = 0
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
    const m = spotWin(key, [a, b, c])
    ret += m > 0 ? 1 + m : 0
  }
  return 1 - ret / 216
}
