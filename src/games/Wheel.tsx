import { useState, useRef } from 'react'
import { useChips, fmt } from '../state/chips'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { Disc, Sparkles } from 'lucide-react'

// 20 segments wheel with high suspense:
// 15x 0x (75% of the wheel is loss/zeros!)
// 1x 10x (Jackpot!)
// 1x 5x (Big Win!)
// 1x 2x (Double)
// 1x 1.5x (1.5x)
// 1x 0.5x (Consolation)
// Expected Value (RTP) = (10 + 5 + 2 + 1.5 + 0.5) / 20 = 19 / 20 = 0.95 (95% RTP / 5% house edge)
const NUM_SEGMENTS = 20
const SEGMENT_ANGLE = 360 / NUM_SEGMENTS // exactly 18 degrees per segment

interface SegmentDef {
  index: number
  mult: number
  label: string
  sublabel?: string
  bg: string
  text: string
  border: string
  highlight?: boolean
}

const SEGMENTS: SegmentDef[] = [
  { index: 0,  mult: 10,  label: '10x',  sublabel: 'JACKPOT', bg: '#6b21a8', text: '#fde047', border: '#eab308', highlight: true },
  { index: 1,  mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 2,  mult: 0,   label: '0x',   bg: '#3f1118', text: '#fca5a5', border: '#5c1421' },
  { index: 3,  mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 4,  mult: 2,   label: '2x',   sublabel: 'DOUBLE',  bg: '#065f46', text: '#a7f3d0', border: '#10b981' },
  { index: 5,  mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 6,  mult: 0,   label: '0x',   bg: '#3f1118', text: '#fca5a5', border: '#5c1421' },
  { index: 7,  mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 8,  mult: 1.5, label: '1.5x', bg: '#854d0e', text: '#fef08a', border: '#eab308' },
  { index: 9,  mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 10, mult: 5,   label: '5x',   sublabel: 'BIG WIN', bg: '#b45309', text: '#fef08a', border: '#f59e0b', highlight: true },
  { index: 11, mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 12, mult: 0,   label: '0x',   bg: '#3f1118', text: '#fca5a5', border: '#5c1421' },
  { index: 13, mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 14, mult: 0.5, label: '0.5x', sublabel: 'HALF',    bg: '#1e3a8a', text: '#93c5fd', border: '#3b82f6' },
  { index: 15, mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 16, mult: 0,   label: '0x',   bg: '#3f1118', text: '#fca5a5', border: '#5c1421' },
  { index: 17, mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 18, mult: 0,   label: '0x',   bg: '#18181b', text: '#ef4444', border: '#3f3f46' },
  { index: 19, mult: 0,   label: '0x',   bg: '#3f1118', text: '#fca5a5', border: '#5c1421' },
]

const PRESET_BETS = [25, 100, 500, 1000, 5000, 25000]

export default function Wheel() {
  const { balance, bet, payout, recordLoss, markHand } = useChips()
  const [wager, setWager] = useState(25)
  const [spinning, setSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [lastResult, setLastResult] = useState<{ mult: number; won: boolean; winAmount: number; profit: number; label: string } | null>(null)
  const [history, setHistory] = useState<{ mult: number; won: boolean }[]>([
    { mult: 0, won: false },
    { mult: 1.5, won: true },
    { mult: 0, won: false },
    { mult: 0, won: false },
    { mult: 5, won: true },
  ])
  const [burst, setBurst] = useState(0)
  const currentRotationRef = useRef(0)

  const handleAddBet = (amt: number) => {
    if (spinning) return
    setWager((w) => Math.min(balance, w + amt))
    sfx.chip()
  }

  const handleBetAll = () => {
    if (spinning || balance <= 0) return
    setWager(balance)
    sfx.chip()
  }

  const handleClearBet = () => {
    if (spinning) return
    setWager(25)
    sfx.click()
  }

  const spinWheel = () => {
    if (spinning) return
    if (wager < 25 || wager > balance) return

    // Deduct bet immediately
    if (!bet(wager, true, 'wheel')) return
    markHand('wheel', wager)

    setSpinning(true)
    setLastResult(null)
    sfx.spin()

    // 1 in 20 chance for each physical segment on the wheel
    // Exactly 15 out of 20 (75%) land on 0x!
    const targetSegmentIndex = Math.floor(Math.random() * NUM_SEGMENTS)
    const targetSegment = SEGMENTS[targetSegmentIndex]

    // Pointer is at TOP (12 o'clock / -90 deg in trigonometry)
    // Segment i starts at (i * 18 - 90) and ends at ((i + 1) * 18 - 90)
    // Relative to 12 o'clock, segment i center is at (i * 18 + 9) degrees clockwise
    // Wheel rotates clockwise by R degrees. For segment center to be at 12 o'clock:
    // (i * 18 + 9 + R) % 360 == 0  =>  R % 360 == (360 - (i * 18 + 9)) % 360
    const segmentCenterRelToTop = targetSegment.index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2
    const targetWheelAngle = (360 - segmentCenterRelToTop + 360) % 360

    // Ensure the wheel ALWAYS rotates forward by multiple full rotations
    const currentAngle = currentRotationRef.current
    const currentNormalized = currentAngle % 360
    let delta = targetWheelAngle - currentNormalized
    if (delta < 0) delta += 360

    // Add 6 full spins (2160 deg) for dramatic deceleration
    const finalAngle = currentAngle + 360 * 6 + delta
    currentRotationRef.current = finalAngle
    setWheelRotation(finalAngle)

    // Tick audio as pegs fly past the top flapper
    let tickCount = 0
    const tickInterval = setInterval(() => {
      tickCount++
      if (tickCount < 32) {
        sfx.tick()
      } else {
        clearInterval(tickInterval)
      }
    }, 85)

    // Settle animation duration is 3.8s
    setTimeout(() => {
      clearInterval(tickInterval)
      setSpinning(false)

      const mult = targetSegment.mult
      if (mult > 0) {
        const winTotal = Math.floor(wager * mult)
        const profit = winTotal - wager
        payout(winTotal, profit)
        setBurst((b) => b + 1)

        if (mult >= 5) {
          sfx.bigWin()
        } else if (mult >= 1) {
          sfx.win()
        } else {
          sfx.coin()
        }

        setLastResult({
          mult,
          won: mult >= 1,
          winAmount: winTotal,
          profit,
          label: targetSegment.label,
        })
        setHistory((h) => [{ mult, won: mult >= 1 }, ...h].slice(0, 10))
      } else {
        recordLoss()
        sfx.lose()
        setLastResult({
          mult: 0,
          won: false,
          winAmount: 0,
          profit: -wager,
          label: '0x',
        })
        setHistory((h) => [{ mult: 0, won: false }, ...h].slice(0, 10))
      }
    }, 3800)
  }

  // Generate SVG path for a circular pie segment
  const makeSegmentPath = (index: number) => {
    const startAngle = (index * SEGMENT_ANGLE - 90) * (Math.PI / 180)
    const endAngle = ((index + 1) * SEGMENT_ANGLE - 90) * (Math.PI / 180)
    const r = 180
    const cx = 200
    const cy = 200

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)

    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`
  }

  return (
    <GameShell
      screen="wheel"
      side={
        <div className="flex items-center justify-between text-[11px] tracking-[0.25em] text-[#8a7a4d]">
          <span>ADMIN PRE-RELEASE · GOLDEN FELT LABS</span>
          <span>HIGH VOLATILITY MULTIPLIER WHEEL · 10X JACKPOT</span>
        </div>
      }
    >
      <div className="relative mx-auto w-full max-w-4xl px-2">
        <GoldBurst trigger={burst} />

        {/* History Ticker */}
        <div className="mb-4 flex items-center justify-between gap-2 overflow-x-auto rounded-xl border border-[#c9a227]/25 bg-black/50 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-widest text-[#8a7a4d] uppercase shrink-0 pl-1">
              RECENT SPINS:
            </span>
            <div className="flex items-center gap-1.5">
              {history.map((h, i) => (
                <span
                  key={i}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black tabular-nums shadow-sm ${
                    h.mult >= 5
                      ? 'border border-[#a855f7]/70 bg-[#581c87]/80 text-[#f3e8ff]'
                      : h.mult > 0
                      ? 'border border-[#10b981]/50 bg-[#064e3b]/70 text-[#a7f3d0]'
                      : 'border border-[#ef4444]/40 bg-[#450a0a]/60 text-[#fca5a5]'
                  }`}
                >
                  {h.mult > 0 ? `${h.mult}x` : '0x'}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-[10px] text-[#a89872]">
            <span>Odds: 15 Zeros · 10x · 5x · 2x · 1.5x · 0.5x</span>
          </div>
        </div>

        {/* Central Wheel Stage */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#c9a227]/40 bg-gradient-to-b from-[#140e06] via-[#09070a] to-black p-6 shadow-2xl">
          {/* Top Admin Badge */}
          <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 rounded-full border border-[#f59e0b]/50 bg-black/70 px-2.5 py-1 text-[9px] font-black tracking-wider text-[#fef08a]">
            <Disc size={12} className="text-[#f59e0b]" />
            <span>ADMIN PRE-RELEASE · MULTIPLIER WHEEL</span>
          </div>

          <div className="relative mx-auto flex flex-col items-center justify-center pt-4">
            {/* Pointer / Flapper at top (points directly down to winning segment) */}
            <div className="relative z-20 -mb-5 flex flex-col items-center">
              <div className="h-0 w-0 border-x-[15px] border-x-transparent border-t-[28px] border-t-[#ef4444] drop-shadow-[0_4px_12px_rgba(239,68,68,0.9)] filter" />
              <div className="-mt-1.5 h-4 w-4 rounded-full border-2 border-[#f6e27a] bg-[#ef4444] shadow-md" />
            </div>

            {/* The Rotating Wheel */}
            <div className="relative p-2">
              <svg
                width="390"
                height="390"
                viewBox="0 0 400 400"
                className="max-h-[330px] max-w-[330px] sm:max-h-[390px] sm:max-w-[390px] drop-shadow-[0_0_40px_rgba(201,162,39,0.35)]"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: spinning ? 'transform 3.8s cubic-bezier(0.12, 0.8, 0.32, 1)' : 'none',
                }}
              >
                {/* Outer Rim */}
                <circle cx="200" cy="200" r="196" fill="#18150c" stroke="#c9a227" strokeWidth="6" />
                <circle cx="200" cy="200" r="186" fill="none" stroke="#f6e27a" strokeWidth="2" strokeDasharray="5 3" />

                {/* 20 Wheel Segments */}
                {SEGMENTS.map((seg) => {
                  const midAngle = (seg.index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2 - 90) * (Math.PI / 180)
                  const textR = 130
                  const tx = 200 + textR * Math.cos(midAngle)
                  const ty = 200 + textR * Math.sin(midAngle)
                  const textRotation = seg.index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2

                  return (
                    <g key={seg.index}>
                      <path
                        d={makeSegmentPath(seg.index)}
                        fill={seg.bg}
                        stroke="#c9a227"
                        strokeWidth="1.2"
                      />
                      {/* Peg at divider */}
                      <circle
                        cx={200 + 180 * Math.cos((seg.index * SEGMENT_ANGLE - 90) * (Math.PI / 180))}
                        cy={200 + 180 * Math.sin((seg.index * SEGMENT_ANGLE - 90) * (Math.PI / 180))}
                        r="2.5"
                        fill="#fef08a"
                      />
                      {/* Segment Text */}
                      <text
                        x={tx}
                        y={ty}
                        fill={seg.text}
                        fontSize={seg.mult >= 10 ? '14' : seg.mult > 0 ? '13' : '12'}
                        fontWeight="900"
                        fontFamily="'Cinzel', serif"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))' }}
                      >
                        {seg.label}
                      </text>
                    </g>
                  )
                })}

                {/* Center Brass Hub */}
                <circle cx="200" cy="200" r="44" fill="#18150c" stroke="#c9a227" strokeWidth="4" />
                <circle cx="200" cy="200" r="34" fill="#2d2207" stroke="#f6e27a" strokeWidth="1.5" />
                <circle cx="200" cy="200" r="10" fill="#f6e27a" />
              </svg>

              {/* Center Logo */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="font-display text-[9px] font-black tracking-widest text-[#f6e27a]">
                  GOLDEN
                </span>
              </div>
            </div>

            {/* Result Announcement */}
            {lastResult && (
              <div className="mt-4 text-center animate-bounce">
                {lastResult.mult > 0 ? (
                  <div className={`rounded-xl border px-6 py-2.5 shadow-2xl ${
                    lastResult.mult >= 5
                      ? 'border-[#a855f7]/70 bg-gradient-to-r from-[#581c87]/90 to-[#7e22ce]/90 shadow-[0_0_30px_rgba(168,85,247,0.6)]'
                      : 'border-[#10b981]/50 bg-[#064e3b]/85 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                  }`}>
                    <div className="text-[11px] font-black tracking-[0.25em] text-[#fef08a]">
                      {lastResult.mult >= 10 ? '🎉 ULTRA JACKPOT 10X LANDED! 🎉' : lastResult.mult >= 5 ? '⭐ BIG WIN 5X LANDED! ⭐' : `WHEEL LANDED ON ${lastResult.label}!`}
                    </div>
                    <div className="font-display text-2xl font-black text-[#fef08a] mt-0.5">
                      +{fmt(lastResult.winAmount)} CHIPS!
                    </div>
                    <div className="text-[10px] text-[#bbf7d0]">
                      Bet: {fmt(wager)} chips × {lastResult.mult} = {fmt(lastResult.winAmount)} chips ({lastResult.profit >= 0 ? `+${fmt(lastResult.profit)} profit` : `${fmt(lastResult.profit)} net`})
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#ef4444]/50 bg-[#450a0a]/85 px-6 py-2.5 shadow-[0_0_25px_rgba(239,68,68,0.4)]">
                    <div className="text-[11px] font-black tracking-[0.25em] text-[#fca5a5]">
                      WHEEL LANDED ON ZERO (0x)
                    </div>
                    <div className="font-display text-xl font-black text-[#fee2e2] mt-0.5">
                      -{fmt(wager)} CHIPS
                    </div>
                    <div className="text-[10px] text-[#f87171]">75% of the wheel is zero — spin again to strike the 10x jackpot!</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wheel Payout Guide */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-[#c9a227]/20 pt-3 text-[10px]">
            <span className="font-bold text-[#8a7a4d]">SLOTS:</span>
            <span className="rounded bg-[#581c87]/70 px-2 py-0.5 font-bold text-[#fde047] border border-[#a855f7]/50">10x Jackpot (1/20)</span>
            <span className="rounded bg-[#b45309]/70 px-2 py-0.5 font-bold text-[#fef08a] border border-[#f59e0b]/50">5x Big Win (1/20)</span>
            <span className="rounded bg-[#065f46]/70 px-2 py-0.5 font-bold text-[#a7f3d0] border border-[#10b981]/50">2x Double (1/20)</span>
            <span className="rounded bg-[#854d0e]/70 px-2 py-0.5 font-bold text-[#fef08a] border border-[#eab308]/50">1.5x (1/20)</span>
            <span className="rounded bg-[#1e3a8a]/70 px-2 py-0.5 font-bold text-[#93c5fd] border border-[#3b82f6]/50">0.5x Half (1/20)</span>
            <span className="rounded bg-[#450a0a]/70 px-2 py-0.5 font-bold text-[#fca5a5] border border-[#ef4444]/50">0x Miss (15/20)</span>
          </div>
        </div>

        {/* Controls & Bet Placement */}
        <div className="mt-5 rounded-2xl border border-[#c9a227]/30 bg-black/60 p-5 shadow-xl">
          <div className="grid gap-5 lg:grid-cols-12 items-center">
            {/* Left Controls: Bet Selector */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.25em] text-[#8a7a4d] font-bold">WAGER AMOUNT</span>
                <span className="text-[11px] text-[#cbb98a]">
                  Balance: <b className="text-[#f6e27a] tabular-nums">{fmt(balance)}</b> chips
                </span>
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-2">
                {PRESET_BETS.map((val) => (
                  <button
                    key={val}
                    onClick={() => handleAddBet(val)}
                    disabled={spinning || balance < val}
                    className="rounded-lg border border-[#c9a227]/30 bg-black/50 px-3 py-1.5 text-[11px] font-bold text-[#f2e6c9] hover:border-[#f6e27a] disabled:opacity-30"
                  >
                    +{fmt(val)}
                  </button>
                ))}
                <button
                  onClick={handleBetAll}
                  disabled={spinning || balance <= 0}
                  className="rounded-lg border border-[#f59e0b]/50 bg-[#d97706]/20 px-3.5 py-1.5 text-[10px] font-black text-[#fde047] hover:bg-[#d97706]/40 disabled:opacity-30"
                >
                  BET ALL
                </button>
                <button
                  onClick={handleClearBet}
                  disabled={spinning}
                  className="rounded-lg border border-[#ef4444]/40 bg-black/40 px-3 py-1.5 text-[10px] font-bold text-[#fca5a5] hover:border-[#ef4444] disabled:opacity-30"
                >
                  RESET
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#c9a227]/25 bg-black/40 px-3 py-2 text-[11px]">
                <span className="text-[#8a7a4d]">Jackpot Win (10x):</span>
                <span className="font-display font-black text-[#fde047]">
                  +{fmt(wager * 10)} chips
                </span>
              </div>
            </div>

            {/* Right Action Button */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <button
                onClick={spinWheel}
                disabled={spinning || balance < wager || wager < 25}
                className="btn-gold min-h-[64px] w-full rounded-2xl text-base font-black tracking-widest shadow-[0_0_25px_rgba(201,162,39,0.4)] hover:brightness-110 active:scale-95 disabled:opacity-40"
              >
                {spinning ? (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles size={18} className="animate-spin text-[#140b02]" />
                    SPINNING THE WHEEL…
                  </span>
                ) : (
                  `SPIN WHEEL (${fmt(wager)} CHIPS)`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
