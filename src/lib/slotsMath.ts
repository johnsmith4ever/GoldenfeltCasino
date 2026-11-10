/* Slot machine rules: symbol odds, paytable and the maths behind them. */

export type Sym = 'diamond' | 'seven' | 'star' | 'bell' | 'lemon' | 'cherry'
export const SYMS: Sym[] = ['diamond', 'seven', 'star', 'bell', 'lemon', 'cherry']

/** Relative chance of each symbol landing on a reel. */
export const WEIGHTS: Record<Sym, number> = { diamond: 1, seven: 2, star: 3, bell: 5, lemon: 8, cherry: 10 }
const TOTAL_WEIGHT = SYMS.reduce((a, s) => a + WEIGHTS[s], 0)

export function randSym(rng: () => number = Math.random): Sym {
  let r = rng() * TOTAL_WEIGHT
  for (const s of SYMS) {
    r -= WEIGHTS[s]
    if (r <= 0) return s
  }
  return 'cherry'
}

/** Pays on the middle line. Three of a kind, or exactly two cherries. */
export const PAYOUTS: { sym: Sym; mult: number; label: string }[] = [
  { sym: 'diamond', mult: 500, label: 'TRIPLE DIAMONDS' },
  { sym: 'seven', mult: 100, label: 'TRIPLE SEVENS' },
  { sym: 'star', mult: 50, label: 'TRIPLE STARS' },
  { sym: 'bell', mult: 20, label: 'TRIPLE BELLS' },
  { sym: 'lemon', mult: 6, label: 'TRIPLE LEMONS' },
  { sym: 'cherry', mult: 4, label: 'TRIPLE CHERRIES' },
]
export const TWO_CHERRIES_MULT = 2

export function evaluateLine(line: Sym[]): { mult: number; label: string } {
  const [a, b, c] = line
  if (a === b && b === c) {
    const p = PAYOUTS.find((x) => x.sym === a)
    if (p) return { mult: p.mult, label: p.label }
  }
  if (line.filter((s) => s === 'cherry').length === 2) return { mult: TWO_CHERRIES_MULT, label: 'TWO CHERRIES' }
  return { mult: 0, label: '' }
}

/** Exact long-run return to player, from the symbol odds. */
export function returnToPlayer(): number {
  const p = (s: Sym) => WEIGHTS[s] / TOTAL_WEIGHT
  let rtp = 0
  for (const x of PAYOUTS) rtp += Math.pow(p(x.sym), 3) * x.mult
  const c = p('cherry')
  rtp += 3 * c * c * (1 - c) * TWO_CHERRIES_MULT
  return rtp
}

/** Chance that a spin pays anything. */
export function hitRate(): number {
  const p = (s: Sym) => WEIGHTS[s] / TOTAL_WEIGHT
  let h = 0
  for (const x of PAYOUTS) h += Math.pow(p(x.sym), 3)
  const c = p('cherry')
  return h + 3 * c * c * (1 - c)
}
