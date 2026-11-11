import { useEffect, useRef, useState, useCallback } from 'react'
import { useChips, fmt } from '../state/chips'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { Rocket as RocketIcon } from 'lucide-react'

type GamePhase = 'betting' | 'countdown' | 'flying' | 'crashed' | 'cashedOut'

// Generate crash point with ~96% RTP (house edge ~4%)
function generateCrashMultiplier(): number {
  const r = Math.random()
  // Instant crash ~4% of the time at 1.00x
  if (r < 0.04) return 1.0
  // Standard exponential distribution for multiplier
  const mult = 0.96 / (1 - r)
  // Clamp between 1.01 and 250.00x
  return Math.max(1.01, Math.min(250.0, Math.floor(mult * 100) / 100))
}

const PRESET_BETS = [25, 100, 500, 1000, 5000, 25000]

export default function Rocket() {
  const { balance, bet, payout, refund, markHand } = useChips()
  const [wager, setWager] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('betting')
  const [multiplier, setMultiplier] = useState(1.0)
  const [history, setHistory] = useState<number[]>([1.84, 3.42, 1.15, 12.5, 2.05, 1.02, 5.14, 1.45])
  const [autoCashOut, setAutoCashOut] = useState<string>('2.00')
  const [autoCashEnabled, setAutoCashEnabled] = useState(false)
  const [winAmount, setWinAmount] = useState(0)
  const [burst, setBurst] = useState(0)
  const [countdown, setCountdown] = useState(3)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const crashPointRef = useRef<number>(1.0)
  const phaseRef = useRef<GamePhase>('betting')
  const wagerRef = useRef<number>(0)
  const autoCashRef = useRef<{ enabled: boolean; val: number }>({ enabled: false, val: 2.0 })
  const multiplierRef = useRef(1.0)

  phaseRef.current = phase
  wagerRef.current = wager
  autoCashRef.current = {
    enabled: autoCashEnabled,
    val: parseFloat(autoCashOut) || 2.0,
  }

  // Clean up bet if unmounted while chips are resting before flight
  useEffect(() => () => {
    if (phaseRef.current === 'betting' && wagerRef.current > 0) {
      refund(wagerRef.current)
    }
    cancelAnimationFrame(animRef.current)
  }, [refund])

  const addBet = (amount: number) => {
    if (phase !== 'betting') return
    if (amount <= 0 || amount > balance) return
    if (bet(amount, false)) {
      setWager((w) => w + amount)
      sfx.chip()
    }
  }

  const clearBet = () => {
    if (phase !== 'betting' || wager <= 0) return
    refund(wager)
    setWager(0)
    sfx.click()
  }

  const betAll = () => {
    if (phase !== 'betting' || balance <= 0) return
    const total = balance
    if (bet(total, false)) {
      setWager((w) => w + total)
      sfx.chip()
    }
  }

  const handleCashOut = useCallback(() => {
    if (phaseRef.current !== 'flying' || wagerRef.current <= 0) return
    cancelAnimationFrame(animRef.current)
    phaseRef.current = 'cashedOut'
    setPhase('cashedOut')
    const currentMult = multiplierRef.current
    const winnings = Math.floor(wagerRef.current * currentMult)
    payout(winnings, winnings - wagerRef.current)
    setWinAmount(winnings)
    setBurst((b) => b + 1)
    sfx.win()
  }, [payout])

  // Launch rocket countdown & flight loop
  const handleLaunch = () => {
    if (phase !== 'betting') return
    if (wager < 25) {
      // Place minimum bet automatically if none placed
      if (balance >= 25 && bet(25, false)) {
        setWager(25)
      } else {
        return
      }
    }

    const currentWager = wager >= 25 ? wager : 25
    markHand('rocket', currentWager)
    const nextCrash = generateCrashMultiplier()
    crashPointRef.current = nextCrash
    setPhase('countdown')
    setCountdown(3)
    sfx.click()

    let count = 3
    const timer = setInterval(() => {
      count--
      if (count > 0) {
        setCountdown(count)
        sfx.tick()
      } else {
        clearInterval(timer)
        startFlight(nextCrash)
      }
    }, 800)
  }

  const startFlight = (targetCrash: number) => {
    cancelAnimationFrame(animRef.current)
    phaseRef.current = 'flying'
    setPhase('flying')
    setMultiplier(1.0)
    multiplierRef.current = 1.0
    startTimeRef.current = performance.now()
    sfx.riser()

    const animate = (time: number) => {
      const elapsed = (time - startTimeRef.current) / 1000
      const currentMult = Math.floor(Math.exp(0.068 * elapsed) * 100) / 100
      multiplierRef.current = currentMult
      setMultiplier(currentMult)

      drawCanvas(currentMult, elapsed, false)

      if (
        autoCashRef.current.enabled &&
        currentMult >= autoCashRef.current.val &&
        phaseRef.current === 'flying'
      ) {
        handleCashOut()
      }

      if (currentMult >= targetCrash) {
        phaseRef.current = 'crashed'
        setPhase('crashed')
        setMultiplier(targetCrash)
        drawCanvas(targetCrash, elapsed, true)
        setHistory((h) => [targetCrash, ...h].slice(0, 10))
        sfx.lose()
        return
      }

      if (phaseRef.current === 'flying') {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    animRef.current = requestAnimationFrame(animate)
  }

  // Draw rocket space trajectory on Canvas
  const drawCanvas = (_mult: number, elapsed: number, exploded: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear background
    ctx.fillStyle = '#060508'
    ctx.fillRect(0, 0, width, height)

    // Draw space starfield grid
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.08)'
    ctx.lineWidth = 1
    const gridSize = 40
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Trajectory curve
    const startX = 60
    const startY = height - 50
    const progress = Math.min(1.0, elapsed / 18)
    const endX = startX + (width - 140) * progress
    const endY = startY - (height - 110) * Math.pow(progress, 0.85)

    // Gradient curve line
    const curveGrad = ctx.createLinearGradient(startX, startY, endX, endY)
    curveGrad.addColorStop(0, 'rgba(234, 179, 8, 0.2)')
    curveGrad.addColorStop(0.5, '#f59e0b')
    curveGrad.addColorStop(1, exploded ? '#ef4444' : '#10b981')

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.quadraticCurveTo(startX + (endX - startX) * 0.4, startY, endX, endY)
    ctx.strokeStyle = curveGrad
    ctx.lineWidth = 4
    ctx.shadowColor = exploded ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)'
    ctx.shadowBlur = 14
    ctx.stroke()
    ctx.shadowBlur = 0

    // Fill underneath the curve
    ctx.lineTo(endX, height - 50)
    ctx.lineTo(startX, height - 50)
    ctx.fillStyle = exploded ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'
    ctx.fill()

    if (exploded) {
      // Draw explosion particles
      ctx.fillStyle = '#ef4444'
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist = 10 + Math.random() * 35
        const px = endX + Math.cos(angle) * dist
        const py = endY + Math.sin(angle) * dist
        ctx.beginPath()
        ctx.arc(px, py, 2 + Math.random() * 4, 0, Math.PI * 2)
        ctx.fillStyle = i % 2 === 0 ? '#f59e0b' : '#ef4444'
        ctx.fill()
      }
    } else {
      // Draw Rocket
      ctx.save()
      ctx.translate(endX, endY)
      // Angle tangent to curve
      const angle = -0.55
      ctx.rotate(angle)

      // Thruster flame
      ctx.fillStyle = '#f97316'
      ctx.beginPath()
      ctx.moveTo(-16, -4)
      ctx.lineTo(-28 - Math.random() * 10, 0)
      ctx.lineTo(-16, 4)
      ctx.closePath()
      ctx.fill()

      // Inner flame core
      ctx.fillStyle = '#fde047'
      ctx.beginPath()
      ctx.moveTo(-16, -2)
      ctx.lineTo(-24 - Math.random() * 6, 0)
      ctx.lineTo(-16, 2)
      ctx.closePath()
      ctx.fill()

      // Rocket fuselage (solid silver/gold body)
      ctx.fillStyle = '#f2e6c9'
      ctx.beginPath()
      ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2)
      ctx.fill()

      // Cockpit window
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(4, 0, 3.5, 0, Math.PI * 2)
      ctx.fill()

      // Fins
      ctx.fillStyle = '#d97706'
      ctx.beginPath()
      ctx.moveTo(-10, -6)
      ctx.lineTo(-16, -12)
      ctx.lineTo(-8, -6)
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(-10, 6)
      ctx.lineTo(-16, 12)
      ctx.lineTo(-8, 6)
      ctx.fill()

      ctx.restore()
    }
  }

  // Handle resetting back to betting phase
  const handleNextFlight = () => {
    cancelAnimationFrame(animRef.current)
    setPhase('betting')
    phaseRef.current = 'betting'
    setMultiplier(1.0)
    multiplierRef.current = 1.0
    setWinAmount(0)
    setWager(0)
    wagerRef.current = 0
    // Clear canvas
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
    sfx.click()
  }

  return (
    <GameShell
      screen="rocket"
      side={
        <div className="flex items-center justify-between text-[11px] tracking-[0.25em] text-[#8a7a4d]">
          <span>ADMIN PRE-RELEASE · GOLDEN FELT LABS</span>
          <span>FLIGHT MULTIPLIER ASCENT · CASHOUT BEFORE CRASH</span>
        </div>
      }
    >
      <div className="relative mx-auto w-full max-w-4xl px-2">
        <GoldBurst trigger={burst} />

        {/* History Ticker */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto rounded-xl border border-[#c9a227]/25 bg-black/50 p-2.5">
          <span className="text-[9px] font-bold tracking-widest text-[#8a7a4d] uppercase shrink-0 pl-1">
            RECENT FLIGHTS:
          </span>
          <div className="flex items-center gap-2">
            {history.map((h, i) => (
              <span
                key={i}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-black tabular-nums shadow-sm ${
                  h >= 10.0
                    ? 'border border-[#a855f7]/60 bg-[#581c87]/70 text-[#f3e8ff]'
                    : h >= 2.0
                    ? 'border border-[#10b981]/50 bg-[#064e3b]/60 text-[#a7f3d0]'
                    : 'border border-white/10 bg-black/40 text-[#9ca3af]'
                }`}
              >
                {h.toFixed(2)}x
              </span>
            ))}
          </div>
        </div>

        {/* Space Flight Launch Stage */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#c9a227]/40 bg-gradient-to-b from-[#09080c] via-[#050406] to-black shadow-2xl">
          {/* Top Admin Badge */}
          <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 rounded-full border border-[#f59e0b]/50 bg-black/70 px-2.5 py-1 text-[9px] font-black tracking-wider text-[#fef08a]">
            <RocketIcon size={12} className="text-[#f59e0b]" />
            <span>ADMIN PRE-RELEASE · V2.4</span>
          </div>

          {/* Central Flight Canvas */}
          <canvas
            ref={canvasRef}
            width={800}
            height={380}
            className="h-[320px] sm:h-[380px] w-full block"
          />

          {/* Large Multiplier Display Overlay */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {phase === 'countdown' && (
              <div className="text-center animate-bounce">
                <div className="text-[12px] font-black tracking-[0.3em] text-[#f59e0b]">LIFTOFF IN</div>
                <div className="font-display text-7xl font-black text-[#fef08a]">{countdown}</div>
              </div>
            )}

            {phase === 'flying' && (
              <div className="text-center">
                <div className="font-display text-6xl sm:text-7xl font-black tracking-tight text-[#f2e6c9] drop-shadow-[0_0_25px_rgba(246,226,122,0.8)] tabular-nums">
                  {multiplier.toFixed(2)}x
                </div>
                {wager > 0 && (
                  <div className="mt-1 font-display text-lg font-bold text-[#86efac] drop-shadow">
                    Payout: {fmt(Math.floor(wager * multiplier))} chips
                  </div>
                )}
              </div>
            )}

            {phase === 'crashed' && (
              <div className="text-center animate-[shake_0.4s_ease-in-out]">
                <div className="text-[12px] font-black tracking-[0.3em] text-[#ef4444]">CRASHED AT</div>
                <div className="font-display text-6xl sm:text-7xl font-black text-[#ef4444] drop-shadow-[0_0_30px_rgba(239,68,68,0.9)] tabular-nums">
                  {multiplier.toFixed(2)}x
                </div>
                <div className="text-[12px] font-bold text-[#fca5a5] mt-1">Flight exploded before cash out</div>
              </div>
            )}

            {phase === 'cashedOut' && (
              <div className="text-center">
                <div className="text-[15px] sm:text-[18px] font-black tracking-[0.25em] text-[#10b981] drop-shadow-[0_0_15px_rgba(16,185,129,0.9)] animate-pulse">
                  CASHED OUT AT {multiplier.toFixed(2)}x
                </div>
                <div className="font-display text-5xl sm:text-6xl font-black text-[#86efac] drop-shadow-[0_0_25px_rgba(16,185,129,0.9)] tabular-nums mt-1">
                  +{fmt(winAmount)} CHIPS
                </div>
                <div className="mt-1 inline-block rounded-full border border-[#10b981]/50 bg-black/70 px-3 py-1 text-[11px] font-bold text-[#bbf7d0]">
                  {fmt(wager)} chips × {multiplier.toFixed(2)} = {fmt(winAmount)} chips
                </div>
              </div>
            )}

            {phase === 'betting' && (
              <div className="text-center">
                <RocketIcon size={48} className="mx-auto text-[#c9a227]/40 mb-2" />
                <div className="font-display text-xl font-bold tracking-widest text-[#a89872]">
                  PLACE YOUR BET &amp; PREPARE FOR LIFTOFF
                </div>
                <div className="text-[11px] text-[#6b5f42] mt-1">
                  Multiplier climbs into the cosmos · Bail out before the rocket explodes
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Flight Controls & Bet Placement */}
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
                    onClick={() => addBet(val)}
                    disabled={phase !== 'betting' || balance < val}
                    className="rounded-lg border border-[#c9a227]/30 bg-black/50 px-3 py-1.5 text-[11px] font-bold text-[#f2e6c9] hover:border-[#f6e27a] disabled:opacity-30"
                  >
                    +{fmt(val)}
                  </button>
                ))}
                <button
                  onClick={betAll}
                  disabled={phase !== 'betting' || balance <= 0}
                  className="rounded-lg border border-[#f59e0b]/50 bg-[#d97706]/20 px-3.5 py-1.5 text-[10px] font-black text-[#fde047] hover:bg-[#d97706]/40 disabled:opacity-30"
                >
                  BET ALL
                </button>
                {wager > 0 && phase === 'betting' && (
                  <button
                    onClick={clearBet}
                    className="rounded-lg border border-[#ef4444]/40 bg-black/40 px-3 py-1.5 text-[10px] font-bold text-[#fca5a5] hover:border-[#ef4444]"
                  >
                    CLEAR
                  </button>
                )}
              </div>

              {/* Auto Cashout Controls */}
              <div className="flex items-center gap-3 pt-1 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-[#cbb98a]">
                  <input
                    type="checkbox"
                    checked={autoCashEnabled}
                    onChange={(e) => setAutoCashEnabled(e.target.checked)}
                    disabled={phase === 'flying'}
                    className="h-4 w-4 rounded border-[#c9a227]/40 bg-black text-[#f59e0b] focus:ring-0"
                  />
                  <span>Auto Cash Out at:</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    min="1.1"
                    max="100"
                    value={autoCashOut}
                    onChange={(e) => setAutoCashOut(e.target.value)}
                    disabled={phase === 'flying'}
                    className="w-20 rounded border border-[#c9a227]/40 bg-black/60 px-2 py-1 text-center font-bold text-[#f6e27a] outline-none"
                  />
                  <span className="font-bold text-[#f6e27a]">x</span>
                </div>
              </div>
            </div>

            {/* Right Action Button */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              {phase === 'flying' ? (
                <button
                  onClick={handleCashOut}
                  disabled={wager <= 0}
                  className="btn-gold min-h-[64px] w-full rounded-2xl bg-gradient-to-r from-[#059669] via-[#10b981] to-[#34d399] text-base font-black tracking-widest text-[#022c22] shadow-[0_0_30px_rgba(16,185,129,0.6)] animate-pulse hover:brightness-110 active:scale-95"
                >
                  CASH OUT ({fmt(Math.floor(wager * multiplier))} CHIPS)
                </button>
              ) : phase === 'countdown' ? (
                <button
                  disabled
                  className="min-h-[64px] w-full rounded-2xl border border-[#f59e0b]/40 bg-black/60 font-display text-lg font-black tracking-widest text-[#fde047] opacity-80"
                >
                  IGNITING ENGINES…
                </button>
              ) : phase === 'crashed' || phase === 'cashedOut' ? (
                <button
                  onClick={handleNextFlight}
                  className="btn-gold min-h-[64px] w-full rounded-2xl text-base font-black tracking-widest shadow-xl hover:brightness-110 active:scale-95"
                >
                  PREPARE NEXT FLIGHT
                </button>
              ) : (
                <button
                  onClick={handleLaunch}
                  disabled={balance < 25 && wager < 25}
                  className="btn-gold min-h-[64px] w-full rounded-2xl text-base font-black tracking-widest shadow-[0_0_25px_rgba(201,162,39,0.4)] hover:brightness-110 active:scale-95 disabled:opacity-40"
                >
                  {wager > 0 ? `LAUNCH ROCKET (${fmt(wager)})` : 'LAUNCH ROCKET (MIN 25)'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}

