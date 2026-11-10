import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { ChipSelector } from '../components/Chip'
import { ResultStrip, useNarrow, type ResultInfo } from './poker/shared'
import { PAYOUTS, SYMS, TWO_CHERRIES_MULT, evaluateLine, randSym, returnToPlayer, type Sym } from '../lib/slotsMath'

/* ---------- Symbols ---------- */

/** Gradients used by every symbol. Defined once, in an SVG that is never display:none (hidden defs do not render). */
function SymbolDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
<linearGradient id="g-dia" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c9f4ff" /><stop offset="0.5" stopColor="#35a7ff" /><stop offset="1" stopColor="#0b3d91" />
            </linearGradient>
<linearGradient id="g-sev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff7a8c" /><stop offset="0.5" stopColor="#e0072f" /><stop offset="1" stopColor="#7a0018" />
            </linearGradient>
<radialGradient id="g-star" cx="0.5" cy="0.4" r="0.7">
              <stop offset="0" stopColor="#fff6b8" /><stop offset="0.6" stopColor="#f2c230" /><stop offset="1" stopColor="#b8801a" />
            </radialGradient>
<linearGradient id="g-bell" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#b8801a" /><stop offset="0.45" stopColor="#ffe98a" /><stop offset="1" stopColor="#a8741a" />
            </linearGradient>
<radialGradient id="g-lem" cx="0.4" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#fff8b0" /><stop offset="0.6" stopColor="#f7d51d" /><stop offset="1" stopColor="#c99a06" />
            </radialGradient>
<radialGradient id="g-ch" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ff8da0" /><stop offset="0.5" stopColor="#e0072f" /><stop offset="1" stopColor="#7a0018" />
            </radialGradient>
      </defs>
    </svg>
  )
}

function Symbol({ s, size = 60 }: { s: Sym; size?: number }) {
  const c = { width: size, height: size, viewBox: '0 0 64 64' }
  switch (s) {
    case 'diamond':
      return (
        <svg {...c}>
          <path d="M18 10 H46 L58 24 L32 58 L6 24 Z" fill="url(#g-dia)" stroke="#06265c" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M6 24 H58 M18 10 L24 24 L32 58 M46 10 L40 24 L32 58 M24 24 L32 10 L40 24" stroke="#eafcff" strokeWidth="1.2" opacity="0.85" fill="none" />
          <path d="M20 13 L26 22" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
        </svg>
      )
    case 'seven':
      return (
        <svg {...c}>
          <path d="M11 9 H53 V19 L31 57 H18 L38 20 H11 Z" fill="url(#g-sev)" stroke="#4a000f" strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M15 13 H49" stroke="#ffd6dc" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        </svg>
      )
    case 'star':
      return (
        <svg {...c}>
          <path d="M32 5 L40 24 L60 25 L44.5 37.5 L50 57 L32 46 L14 57 L19.5 37.5 L4 25 L24 24 Z" fill="url(#g-star)" stroke="#5a3d07" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M32 12 L37 25" stroke="#fffbe6" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...c}>
          <path d="M32 7 C21 7 16 16 16 27 L16 40 L8 48 H56 L48 40 L48 27 C48 16 43 7 32 7 Z" fill="url(#g-bell)" stroke="#5a3d07" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="32" cy="53" r="5.5" fill="#d4002a" stroke="#4a000f" strokeWidth="2" />
          <rect x="29" y="3" width="6" height="6" rx="2" fill="#a8741a" stroke="#5a3d07" strokeWidth="1.6" />
          <path d="M22 18 C21 24 21 30 22 36" stroke="#fffbe6" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" fill="none" />
        </svg>
      )
    case 'lemon':
      return (
        <svg {...c}>
          <path d="M6 33 C6 20 20 13 33 14 C44 14 52 17 58 12 C56 20 58 28 54 38 C48 52 28 56 16 48 C9 44 6 39 6 33 Z" fill="url(#g-lem)" stroke="#7a5a00" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M16 26 C20 22 26 20 32 20" stroke="#fffde0" strokeWidth="3" strokeLinecap="round" opacity="0.9" fill="none" />
          <path d="M52 14 C55 8 60 6 62 8" stroke="#2f7a22" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      )
    case 'cherry':
      return (
        <svg {...c}>
          <path d="M42 7 Q36 24 22 38 M42 7 Q48 22 46 38" stroke="#2f6a22" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M42 7 Q52 3 58 10 Q48 13 42 7 Z" fill="#4c9a38" stroke="#1f4a15" strokeWidth="1.6" />
          <circle cx="21" cy="44" r="12" fill="url(#g-ch)" stroke="#4a000f" strokeWidth="2.4" />
          <circle cx="45" cy="45" r="12" fill="url(#g-ch)" stroke="#4a000f" strokeWidth="2.4" />
          <ellipse cx="16.5" cy="39" rx="3.6" ry="2.6" fill="#fff" opacity="0.8" />
          <ellipse cx="40.5" cy="40" rx="3.6" ry="2.6" fill="#fff" opacity="0.8" />
        </svg>
      )
  }
}

/* ---------- Spin timeline (pure) ---------- */

interface ReelPlan {
  strip: Sym[]
  p0: number
  vmax: number
  tAcc: number
  tCruise: number
  tDec: number
  T: number
  pf: number
}

const V_TARGET = 13 // cells per second at full speed
const SETTLE = 0.32 // seconds of "thunk" after the reel stops

function planReel(strip: Sym[], T: number, scale: number): ReelPlan {
  const tAcc = 0.35 * Math.max(scale, 0.5)
  const tDec = Math.min(1.5 * Math.max(scale, 0.5), T * 0.55)
  const tCruise = Math.max(0, T - tAcc - tDec)
  const dist = Math.max(10, Math.round(V_TARGET * (0.5 * tAcc + tCruise + tDec / 3)))
  const vmax = dist / (0.5 * tAcc + tCruise + tDec / 3)
  return { strip, p0: 2, vmax, tAcc, tCruise, tDec, T, pf: 2 + dist }
}

function positionAt(m: ReelPlan, t: number): { pos: number; v: number } {
  if (t <= 0) return { pos: m.p0, v: 0 }
  if (t < m.tAcc) return { pos: m.p0 + (m.vmax * t * t) / (2 * m.tAcc), v: (m.vmax * t) / m.tAcc }
  const tc = m.tAcc + m.tCruise
  const base = m.p0 + m.vmax * 0.5 * m.tAcc
  if (t < tc) return { pos: base + m.vmax * (t - m.tAcc), v: m.vmax }
  if (t < m.T) {
    const u = (t - tc) / m.tDec
    return { pos: base + m.vmax * m.tCruise + (m.vmax * m.tDec * (1 - Math.pow(1 - u, 3))) / 3, v: m.vmax * (1 - u) * (1 - u) }
  }
  const s = Math.min(1, (t - m.T) / SETTLE)
  return { pos: m.pf + 0.1 * Math.sin(Math.PI * s) * (1 - s), v: 0 }
}

const LS_BET = 'golden-felt-slots-bet'
function loadBet(): number {
  try {
    const n = Number(localStorage.getItem(LS_BET))
    return [25, 100, 500, 1000].includes(n) ? n : 25
  } catch { return 25 }
}

type Grid = Sym[][] // [reel][top, middle, bottom]
const START_GRID: Grid = [
  ['bell', 'cherry', 'star'],
  ['lemon', 'seven', 'cherry'],
  ['star', 'diamond', 'bell'],
]

export default function Slots() {
  const { balance, bet, markHand, payout, freeSpinArmed, useFreeSpin } = useChips()
  const narrow = useNarrow(560)
  const CELL = narrow ? 82 : 96
  const [chipVal, setChipValState] = useState(loadBet)
  const [spinning, setSpinning] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'spin' | 'anticipate' | 'win'>('idle')
  const [quick, setQuick] = useState(false)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [burst, setBurst] = useState(0)
  const [pulled, setPulled] = useState(false)

  const gridRef = useRef<Grid>(START_GRID)
  const cellRefs = useRef<(HTMLDivElement | null)[][]>([[], [], []])
  const reelRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef(0)
  const busyRef = useRef(false)
  const cellPx = useRef(CELL)

  const setChipVal = (v: number) => {
    setChipValState(v)
    try { localStorage.setItem(LS_BET, String(v)) } catch { /* storage blocked */ }
  }

  const paint = (r: number, strip: Sym[], pos: number, blur: number) => {
    const P = Math.floor(pos)
    const frac = pos - P
    const cells = cellRefs.current[r]
    for (let k = 0; k < 4; k++) {
      const el = cells[k]
      if (!el) continue
      const row = k - 1
      const sym = strip[P - row] ?? 'cherry'
      if (el.dataset.sym !== sym) el.dataset.sym = sym
      el.style.transform = `translate3d(0, ${(row + frac) * cellPx.current}px, 0)`
    }
    const reel = reelRefs.current[r]
    if (reel) reel.style.filter = blur > 0.25 ? `blur(${blur.toFixed(1)}px)` : 'none'
  }

  const paintIdle = () => {
    for (let r = 0; r < 3; r++) {
      const g = gridRef.current[r]
      paint(r, [g[2], g[1], g[0]], 2, 0)
    }
  }

  useLayoutEffect(() => {
    cellPx.current = CELL
    if (!busyRef.current) paintIdle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CELL])
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const spin = () => {
    if (busyRef.current || (!freeSpinArmed && chipVal > balance)) return
    const free = freeSpinArmed && useFreeSpin()
    const stake = free ? 25 : chipVal
    if (free) markHand('slots', stake)
    else if (!bet(stake, true, 'slots')) return
    busyRef.current = true
    setSpinning(true)
    setResult(null)
    setLastWin(null)
    setPhase('spin')
    setPulled(true)
    setTimeout(() => setPulled(false), 450)
    sfx.lever()
    sfx.spin()

    // The result is decided first (real random odds); the animation is built to end exactly on it.
    const targets: Sym[] = [randSym(), randSym(), randSym()]
    const tops: Sym[] = [randSym(), randSym(), randSym()]
    const bottoms: Sym[] = [randSym(), randSym(), randSym()]
    // Keep the outer rows from forming a matching line, so the only "line" is the highlighted middle one.
    if (tops[0] === tops[1] && tops[1] === tops[2]) tops[2] = SYMS[(SYMS.indexOf(tops[2]) + 1) % SYMS.length]
    if (bottoms[0] === bottoms[1] && bottoms[1] === bottoms[2]) bottoms[2] = SYMS[(SYMS.indexOf(bottoms[2]) + 1) % SYMS.length]

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scale = reduced ? 0.25 : quick ? 0.45 : 1
    const stops = [2.4, 3.7, 5.0].map((x) => x * scale)
    const tension = targets[0] === targets[1] // first two reels match: the last one takes its time
    if (tension) stops[2] += 1.7 * scale

    const old = gridRef.current
    const plans: ReelPlan[] = [0, 1, 2].map((r) => {
      const plan = planReel([], stops[r], scale)
      const strip: Sym[] = [old[r][2], old[r][1], old[r][0]]
      for (let i = 3; i < plan.pf - 2; i++) strip.push(randSym())
      strip[plan.pf - 2] = bottoms[r]
      strip[plan.pf - 1] = targets[r]
      strip[plan.pf] = tops[r]
      strip[plan.pf + 1] = randSym()
      return { ...plan, strip }
    })
    gridRef.current = [0, 1, 2].map((r) => [tops[r], targets[r], bottoms[r]])

    const t0 = performance.now()
    const stopped = [false, false, false]
    const lastFloor = [0, 0, 0]
    let flagged = false
    const frame = (now: number) => {
      const t = (now - t0) / 1000
      let done = true
      for (let r = 0; r < 3; r++) {
        const m = plans[r]
        const { pos, v } = positionAt(m, t)
        paint(r, m.strip, pos, Math.min(2.6, v * 0.2))
        const f = Math.floor(pos)
        if (t < m.T && v < 9 && f !== lastFloor[r] && !reduced) sfx.tick()
        lastFloor[r] = f
        if (t >= m.T && !stopped[r]) { stopped[r] = true; sfx.reelStop() }
        if (t < m.T + SETTLE) done = false
      }
      if (tension && !flagged && t >= stops[1]) { flagged = true; setPhase('anticipate'); sfx.riser() }
      if (!done) rafRef.current = requestAnimationFrame(frame)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(frame)

    // Payout runs on a timer, so it still lands if you leave the page mid-spin.
    setTimeout(() => {
      const { mult, label } = evaluateLine(targets)
      if (mult > 0) {
        const winAmt = stake * mult
        payout(winAmt, winAmt - stake)
        setLastWin(winAmt)
        setBurst((b) => b + 1)
        setPhase('win')
        if (mult >= 50) sfx.bigWin(); else sfx.win()
        setResult({ kind: 'win', title: label, detail: `${mult} to 1`, amount: winAmt - stake })
      } else {
        setPhase('idle')
        sfx.lose()
        setResult({ kind: 'lose', title: 'NO LINE', detail: 'Spin again' })
      }
      setSpinning(false)
      busyRef.current = false
    }, (stops[2] + SETTLE + 0.1) * 1000)
  }

  const bulbs = Array.from({ length: 15 }, (_, i) => i)
  const reelH = CELL * 3

  return (
    <GameShell
      screen="slots"
      side={
        <div className="mx-auto max-w-lg">
          <h3 className="font-display text-center text-xs font-bold tracking-[0.3em] text-[#b3a06b]">PAYTABLE — MIDDLE LINE</h3>
          <div className="panel-noir mt-3 rounded-lg px-4 py-3">
            <table className="w-full text-[12px] text-[#cbb98a]">
              <tbody>
                {PAYOUTS.map((p) => (
                  <tr key={p.sym} className="border-b border-[#c9a227]/10 last:border-0">
                    <td className="flex items-center gap-1 py-1">
                      {[0, 1, 2].map((i) => <span key={i} className="rounded bg-[#f7f3ea] p-0.5"><Symbol s={p.sym} size={22} /></span>)}
                    </td>
                    <td className="text-right font-display font-bold text-[#f6e27a]">{p.mult} to 1</td>
                  </tr>
                ))}
                <tr>
                  <td className="flex items-center gap-1 py-1">
                    <span className="rounded bg-[#f7f3ea] p-0.5"><Symbol s="cherry" size={22} /></span>
                    <span className="rounded bg-[#f7f3ea] p-0.5"><Symbol s="cherry" size={22} /></span>
                    <span className="text-[10px] tracking-widest text-[#8a7a4d]">+ ANYTHING</span>
                  </td>
                  <td className="text-right font-display font-bold text-[#f6e27a]">{TWO_CHERRIES_MULT} to 1</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-center text-[11px] text-[#8a7a4d]">Only the middle line (the one with the red arrows) pays. Return to player: about {(returnToPlayer() * 100).toFixed(0)}%.</p>
        </div>
      }
    >
      <div className="relative">
        <SymbolDefs />
        <GoldBurst trigger={burst} />

        <div className="mx-auto max-w-md" style={{ paddingRight: narrow ? 0 : 20 }}>
          <div className="slot-cabinet" data-phase={phase}>
            <div className="slot-body">
              <div className="slot-bulbs">{bulbs.map((i) => <span key={i} className="slot-bulb" style={{ ['--i' as string]: i }} />)}</div>
              <div className="slot-title">GRAND SLOTS</div>
              <div className="slot-bulbs">{bulbs.map((i) => <span key={i} className="slot-bulb" style={{ ['--i' as string]: i + 4 }} />)}</div>

              <div className="slot-window">
                <div className="slot-reels">
                  {[0, 1, 2].map((r) => (
                    <div key={r} className="slot-reel" data-last={r === 2} style={{ height: reelH }}>
                      <div ref={(el) => { reelRefs.current[r] = el }} style={{ position: 'absolute', inset: 0 }}>
                        {[0, 1, 2, 3].map((k) => (
                          <div
                            key={k}
                            ref={(el) => { cellRefs.current[r][k] = el }}
                            className="slot-cell"
                            data-sym={START_GRID[r][Math.max(0, Math.min(2, k - 1))]}
                            style={{ height: CELL }}
                          >
                            {SYMS.map((s) => <span key={s} className={`sym sym-${s}`}><Symbol s={s} size={CELL * 0.72} /></span>)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="slot-payline" />
                <div className="slot-winbox" style={{ top: 10 + CELL, height: CELL }} />
              </div>

              <div className="slot-display">
                <div className="slot-lcd"><div className="lbl">BET</div><div className="val">{fmt(freeSpinArmed ? 25 : chipVal)}</div></div>
                <div className="slot-lcd"><div className="lbl">LAST WIN</div><div className="val">{lastWin ? `+${fmt(lastWin)}` : '—'}</div></div>
                <div className="slot-lcd"><div className="lbl">TOP PRIZE</div><div className="val">{fmt(chipVal * 500)}</div></div>
              </div>
            </div>

            <button className={`slot-lever ${pulled ? 'pulled' : ''}`} onClick={spin} disabled={spinning} aria-label="Pull the lever to spin">
              <span className="rod" /><span className="knob" />
            </button>
          </div>
        </div>

        <div className="mt-5"><ResultStrip result={result} /></div>

        <div className="mt-4 flex flex-col items-center gap-3">
          <ChipSelector selected={chipVal} onSelect={setChipVal} max={balance} />
          <button onClick={() => setChipVal(balance)} disabled={balance < 25} className="btn-ghost-gold min-h-[38px] rounded-lg px-4 text-[10px]">BET ALL</button>
          <div className="flex w-full max-w-sm items-center gap-3">
            <button onClick={spin} disabled={spinning || (!freeSpinArmed && chipVal > balance)} className="btn-gold min-h-[52px] flex-1 rounded-xl py-3.5 text-base">
              {spinning ? 'SPINNING…' : freeSpinArmed ? 'FREE SPIN' : 'SPIN'}
            </button>
            <button
              onClick={() => { sfx.click(); setQuick((q) => !q) }}
              aria-pressed={quick}
              className={`min-h-[52px] rounded-xl border px-4 text-[11px] font-bold tracking-[0.2em] ${quick ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]' : 'border-[#c9a227]/35 text-[#8a7a4d]'}`}
            >
              QUICK
            </button>
          </div>
          {chipVal > balance && <p className="text-[12px] text-[#ff97a3]">Not enough chips for that bet. Pick a smaller chip.</p>}
        </div>
      </div>
    </GameShell>
  )
}
