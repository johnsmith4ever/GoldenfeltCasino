import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useChips } from '../state/chips'
import { sfx } from '../lib/audio'
import { GameShell, ResultBanner, GoldBurst } from '../components/GameShell'
import { ChipSelector, BetStack } from '../components/Chip'

/* European wheel order, clockwise starting at 0 */
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const SEG = 360 / 37

function pocketColor(n: number): string {
  if (n === 0) return '#0e5c3a'
  return REDS.has(n) ? '#a3001f' : '#141419'
}

/* ---------- Spin animation ---------- */

const BOX = 340                       // wheel box in px (SVG viewBox is 400)
const SCALE = BOX / 400
const R_TRACK = 190 * SCALE           // ball runs on the outer rim
const R_POCKET = 170 * SCALE          // ball rests in the outer part of a pocket
const mod = (a: number, n: number) => ((a % n) + n) % n
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)

/** Ball distance from the centre over the spin: launch, orbit, then drop and bounce into the pocket. */
function ballRadius(p: number): number {
  if (p < 0.04) return R_POCKET + (R_TRACK - R_POCKET) * (p / 0.04)
  if (p < 0.62) return R_TRACK
  if (p < 0.84) {
    const s = (p - 0.62) / 0.22
    return R_TRACK + (R_POCKET - R_TRACK) * s * s + 7 * (1 - s) * Math.abs(Math.sin(s * Math.PI * 3))
  }
  return R_POCKET
}

/** Small sideways rattle while the ball hops over the pocket dividers. */
function ballJitter(p: number): number {
  if (p < 0.62 || p >= 0.84) return 0
  const s = (p - 0.62) / 0.22
  return 9 * (1 - s) * Math.sin(s * Math.PI * 5)
}

function placeWheelAndBall(wheel: SVGSVGElement | null, ball: HTMLDivElement | null, wheelDeg: number, ballRelDeg: number, r: number) {
  if (wheel) wheel.style.transform = `rotate(${wheelDeg}deg)`
  if (ball) {
    const a = ((wheelDeg + ballRelDeg) * Math.PI) / 180
    ball.style.transform = `translate(${BOX / 2 + r * Math.sin(a)}px, ${BOX / 2 - r * Math.cos(a)}px)`
  }
}

/* ---------- Wheel SVG ---------- */

function Wheel({ highlight, wheelRef, ballRef }: { highlight: number | null; wheelRef: RefObject<SVGSVGElement | null>; ballRef: RefObject<HTMLDivElement | null> }) {
  const cx = 200, cy = 200
  const pockets = WHEEL.map((n, i) => {
    const a0 = (i * SEG - SEG / 2 - 90) * (Math.PI / 180)
    const a1 = (i * SEG + SEG / 2 - 90) * (Math.PI / 180)
    const r0 = 118, r1 = 182
    const p = (r: number, a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    const mid = (i * SEG - 90) * (Math.PI / 180)
    const tx = cx + 150 * Math.cos(mid)
    const ty = cy + 150 * Math.sin(mid)
    const rot = (i * SEG) % 360
    const hl = highlight === n
    return (
      <g key={n}>
        <path
          d={`M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`}
          fill={hl ? '#f6e27a' : pocketColor(n)}
          stroke="#c9a227"
          strokeWidth="0.8"
          opacity={highlight !== null && !hl ? 0.55 : 1}
          style={{ transition: 'opacity 400ms, fill 400ms' }}
        />
        <text
          x={tx} y={ty}
          textAnchor="middle" dominantBaseline="central"
          fill={hl ? '#1a1405' : '#f2e6c9'}
          fontSize="13" fontWeight="700" fontFamily="'Cinzel', serif"
          transform={`rotate(${rot} ${tx} ${ty})`}
        >
          {n}
        </text>
      </g>
    )
  })

  return (
    <div className="relative mx-auto" style={{ width: BOX, height: BOX }}>
      {/* pointer */}
      <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
        <div
          className="h-0 w-0 border-l-[9px] border-r-[9px] border-t-[16px] border-l-transparent border-r-transparent"
          style={{ borderTopColor: '#f6e27a', filter: 'drop-shadow(0 0 6px rgba(246,226,122,0.8))' }}
        />
      </div>
      <svg ref={wheelRef} viewBox="0 0 400 400" className="roulette-wheel h-full w-full">
        <defs>
          <radialGradient id="rim" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#f6e27a" />
            <stop offset="55%" stopColor="#c9a227" />
            <stop offset="100%" stopColor="#6e5313" />
          </radialGradient>
          <radialGradient id="cone" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="#3a3230" />
            <stop offset="70%" stopColor="#211c1e" />
            <stop offset="100%" stopColor="#121013" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="197" fill="url(#rim)" stroke="#4a3808" strokeWidth="2" />
        <circle cx="200" cy="200" r="186" fill="#0d0b0e" />
        {pockets}
        <circle cx="200" cy="200" r="118" fill="url(#cone)" stroke="#c9a227" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="118" fill="none" stroke="#c9a227" strokeWidth="0.6" strokeDasharray="2 5" opacity="0.7" />
        {/* turret */}
        <circle cx="200" cy="200" r="30" fill="url(#rim)" stroke="#4a3808" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="10" fill="#121013" stroke="#f6e27a" strokeWidth="1" />
        {[0, 90, 180, 270].map((a) => (
          <rect key={a} x="197" y="76" width="6" height="50" rx="3" fill="url(#rim)" stroke="#4a3808" strokeWidth="0.8"
            transform={`rotate(${a} 200 200)`} />
        ))}
        <text x="200" y="206" textAnchor="middle" fill="#f6e27a" fontSize="11" fontFamily="'Cinzel', serif" fontWeight="700">GF</text>
      </svg>
      <div ref={ballRef} className="roulette-ball" aria-hidden="true" />
    </div>
  )
}

/* ---------- Betting board helpers ---------- */

type Bets = Record<string, number>

interface BetDef { label: string; nums: number[]; mult: number }

function betDef(id: string): BetDef {
  if (id.startsWith('n')) return { label: `Straight ${id.slice(1)}`, nums: [parseInt(id.slice(1))], mult: 35 }
  if (id === 'red') return { label: 'Red', nums: [...REDS], mult: 1 }
  if (id === 'black') return { label: 'Black', nums: Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => !REDS.has(n)), mult: 1 }
  if (id === 'even') return { label: 'Even', nums: Array.from({ length: 18 }, (_, i) => (i + 1) * 2), mult: 1 }
  if (id === 'odd') return { label: 'Odd', nums: Array.from({ length: 18 }, (_, i) => i * 2 + 1), mult: 1 }
  if (id === 'low') return { label: '1–18', nums: Array.from({ length: 18 }, (_, i) => i + 1), mult: 1 }
  if (id === 'high') return { label: '19–36', nums: Array.from({ length: 18 }, (_, i) => i + 19), mult: 1 }
  if (id.startsWith('dz')) {
    const d = parseInt(id.slice(2))
    return { label: `Dozen ${d}`, nums: Array.from({ length: 12 }, (_, i) => (d - 1) * 12 + i + 1), mult: 2 }
  }
  if (id.startsWith('col')) {
    const c = parseInt(id.slice(3))
    const nums: number[] = []
    for (let r = 0; r < 12; r++) nums.push(r * 3 + c)
    return { label: `Column ${c}`, nums, mult: 2 }
  }
  return { label: id, nums: [], mult: 0 }
}

/* ---------- Component ---------- */

export default function Roulette() {
  const { balance, bet, markHand, payout, refund } = useChips()
  const [chipVal, setChipVal] = useState(25)
  const [bets, setBets] = useState<Bets>({})
  const [spinning, setSpinning] = useState(false)
  const [landed, setLanded] = useState<number | null>(null)
  const [result, setResult] = useState<{ kind: 'win' | 'lose' | 'push'; title: string; detail?: string; amount?: number } | null>(null)
  const [burst, setBurst] = useState(0)
  const rotRef = useRef(0)            // wheel angle at rest (deg)
  const ballIdxRef = useRef(0)        // pocket index the ball currently rests in
  const wheelRef = useRef<SVGSVGElement>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  useLayoutEffect(() => {
    placeWheelAndBall(wheelRef.current, ballRef.current, rotRef.current, ballIdxRef.current * SEG, R_POCKET)
  }, [])
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const totalBet = useMemo(() => Object.values(bets).reduce((a, b) => a + b, 0), [bets])

  const place = (id: string, amount = chipVal) => {
    const stake = Math.floor(Math.min(amount, balance))
    if (spinning || stake <= 0) return
    if (!bet(stake, false)) return
    sfx.chip()
    setBets((b) => ({ ...b, [id]: (b[id] ?? 0) + stake }))
  }
  const betAll = () => place('red', balance)

  const clearBets = () => {
    if (spinning) return
    refund(totalBet)
    setBets({})
    setResult(null)
    sfx.click()
  }

  const spin = () => {
    if (spinning || totalBet < 25) return
    setSpinning(true)
    setResult(null)
    setLanded(null)
    markHand('roulette', totalBet)
    sfx.spin()

    const win = WHEEL[Math.floor(Math.random() * 37)]
    const idx = WHEEL.indexOf(win)
    // The result is decided first; the animation is built to end exactly on it.
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const T = reduced ? 1400 : 6200
    const w0 = rotRef.current
    const prevIdx = ballIdxRef.current
    // Wheel turns clockwise and slows to a stop with the winning pocket under the top pointer.
    const wTotal = 360 * (reduced ? 1 : 3 + Math.floor(Math.random() * 2)) + mod(-(w0 + idx * SEG), 360)
    // Ball orbits the other way (relative to the wheel), starting from where it was resting.
    const r0 = 360 * (reduced ? 1 : 6 + Math.floor(Math.random() * 2)) + mod((prevIdx - idx) * SEG, 360)
    const K = 2.4
    const start = performance.now()
    cancelAnimationFrame(rafRef.current)
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / T)
      const rel = idx * SEG + r0 * Math.pow(1 - p, K) + ballJitter(p)
      placeWheelAndBall(wheelRef.current, ballRef.current, w0 + wTotal * easeOutCubic(p), rel, ballRadius(p))
      if (p < 1) rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    rotRef.current = w0 + wTotal
    ballIdxRef.current = idx

    setTimeout(() => {
      setLanded(win)
      sfx.reelStop()
      let back = 0
      let wonDetail: string[] = []
      for (const [id, stake] of Object.entries(bets)) {
        const def = betDef(id)
        if (def.nums.includes(win)) {
          back += stake * (def.mult + 1)
          wonDetail.push(`${def.label}`)
        }
      }
      const profit = back - totalBet
      setTimeout(() => {
        if (back > 0) {
          payout(back, profit)
          setBurst((b) => b + 1)
          if (back >= totalBet * 5) sfx.bigWin()
          else sfx.win()
          setResult({
            kind: 'win',
            title: `${win} ${win === 0 ? 'ZERO' : REDS.has(win) ? 'RED' : 'BLACK'}`,
            detail: wonDetail.slice(0, 3).join(' · ') + (wonDetail.length > 3 ? ` +${wonDetail.length - 3} more` : ''),
            amount: profit,
          })
        } else {
          sfx.lose()
          setResult({
            kind: 'lose',
            title: `${win} ${win === 0 ? 'ZERO' : REDS.has(win) ? 'RED' : 'BLACK'}`,
            detail: 'No winning spots covered',
          })
        }
        setBets({})
        setSpinning(false)
      }, 900)
    }, T)
  }

  /* board cells */
  const NumCell = ({ n }: { n: number }) => {
    const stake = bets[`n${n}`]
    return (
      <div
        onClick={() => place(`n${n}`)}
        className="bet-spot relative flex h-11 items-center justify-center rounded-sm border border-[#c9a227]/30 font-display text-sm font-bold sm:h-12"
        style={{ background: pocketColor(n), color: '#f2e6c9' }}
      >
        {n}
        {stake !== undefined && (
          <span className="chip-place-anim absolute -top-2 left-1/2 z-10 -translate-x-1/2">
            <BetStack amount={stake} size={30} />
          </span>
        )}
      </div>
    )
  }

  const OutCell = ({ id, label, className = '', red = false }: { id: string; label: string; className?: string; red?: boolean }) => {
    const stake = bets[id]
    return (
      <div
        onClick={() => place(id)}
        className={`bet-spot relative flex items-center justify-center rounded-sm border border-[#c9a227]/30 font-display text-[11px] font-bold tracking-widest text-[#f2e6c9] ${className}`}
        style={{ background: red ? '#a3001f' : id === 'black' ? '#141419' : 'rgba(0,0,0,0.45)' }}
      >
        {label}
        {stake !== undefined && (
          <span className="chip-place-anim absolute -top-2 left-1/2 z-10 -translate-x-1/2">
            <BetStack amount={stake} size={30} />
          </span>
        )}
      </div>
    )
  }

  return (
    <GameShell
      screen="roulette"
      side={
        <p className="text-center text-[11px] tracking-[0.25em] text-[#8a7a4d]">
          STRAIGHT UP 35:1 · DOZENS &amp; COLUMNS 2:1 · EVEN CHANCES 1:1
        </p>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />
        <ResultBanner result={result} />

        <div className="grid gap-8 lg:grid-cols-[auto_1fr]">
          {/* Wheel */}
          <div className="flex flex-col items-center gap-4">
            <Wheel highlight={landed} wheelRef={wheelRef} ballRef={ballRef} />
            <div className="text-center">
              {landed !== null ? (
                <div className="ball-settle-anim font-display text-xl font-bold text-[#f6e27a]">
                  {landed} · {landed === 0 ? 'ZERO' : REDS.has(landed) ? 'RED' : 'BLACK'}
                </div>
              ) : (
                <div className="text-[11px] tracking-[0.3em] text-[#8a7a4d]">
                  {spinning ? 'NO MORE BETS…' : 'PLACE YOUR BETS'}
                </div>
              )}
            </div>
          </div>

          {/* Board */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-[430px] select-none">
              <div className="flex gap-1">
                {/* zero */}
                <div
                  onClick={() => place('n0')}
                  className="bet-spot relative flex w-11 items-center justify-center rounded-sm border border-[#c9a227]/30 font-display text-sm font-bold text-[#f2e6c9] sm:w-12"
                  style={{ background: '#0e5c3a' }}
                >
                  0
                  {bets['n0'] !== undefined && (
                    <span className="chip-place-anim absolute -top-2 left-1/2 z-10 -translate-x-1/2">
                      <BetStack amount={bets['n0']} size={30} />
                    </span>
                  )}
                </div>
                <div className="grid flex-1 grid-rows-3 gap-1">
                  {[3, 2, 1].map((col) => (
                    <div key={col} className="grid grid-cols-12 gap-1">
                      {Array.from({ length: 12 }, (_, r) => (
                        <NumCell key={r * 3 + col} n={r * 3 + col} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="grid w-14 grid-rows-3 gap-1 sm:w-16">
                  {[3, 2, 1].map((c) => (
                    <OutCell key={c} id={`col${c}`} label="2:1" />
                  ))}
                </div>
              </div>
              <div className="ml-12 mr-16 mt-1 grid grid-cols-3 gap-1 sm:ml-12 sm:mr-[68px]">
                {[1, 2, 3].map((d) => (
                  <OutCell key={d} id={`dz${d}`} label={`${d === 1 ? '1st' : d === 2 ? '2nd' : '3rd'} 12`} className="h-9" />
                ))}
              </div>
              <div className="ml-12 mr-16 mt-1 grid grid-cols-6 gap-1 sm:ml-12 sm:mr-[68px]">
                <OutCell id="low" label="1–18" className="h-9" />
                <OutCell id="even" label="EVEN" className="h-9" />
                <OutCell id="red" label="◆" red className="h-9 text-base" />
                <OutCell id="black" label="◆" className="h-9 text-base" />
                <OutCell id="odd" label="ODD" className="h-9" />
                <OutCell id="high" label="19–36" className="h-9" />
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <ChipSelector selected={chipVal} onSelect={setChipVal} max={balance} />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={betAll} disabled={spinning || balance <= 0} className="btn-ghost-gold min-h-[40px] rounded-lg px-3 text-[10px]">BET ALL</button>
                <span className="flex items-center gap-2 text-sm text-[#b3a06b]">
                  ON THE TABLE
                  {totalBet > 0 ? <BetStack amount={totalBet} /> : <span className="text-white/30">—</span>}
                </span>
                <button onClick={clearBets} disabled={spinning || totalBet === 0} className="btn-ghost-gold rounded-lg px-4 py-2 text-xs">
                  CLEAR
                </button>
                <button onClick={spin} disabled={spinning || totalBet < 25} className="btn-crimson rounded-lg px-10 py-2.5 text-sm">
                  {spinning ? 'SPINNING…' : 'SPIN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
