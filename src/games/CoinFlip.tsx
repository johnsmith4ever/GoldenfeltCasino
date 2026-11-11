import { useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { Coins, Sparkles, Crown } from 'lucide-react'

type CoinSide = 'heads' | 'tails'

const PRESET_BETS = [25, 100, 500, 1000, 5000, 25000]

function CoinGraphic({ side, flipping }: { side: CoinSide; flipping: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ perspective: '800px' }}>
      <div
        className={`relative h-32 w-32 rounded-full border-4 border-[#f6e27a] bg-gradient-to-tr from-[#78350f] via-[#d97706] to-[#fbbf24] shadow-[0_10px_30px_rgba(245,158,11,0.5)] ${
          flipping ? 'coin-flip-anim' : ''
        }`}
      >
        {/* Inner Coin Rim */}
        <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full border-2 border-dashed border-[#fef08a] bg-gradient-to-b from-[#b45309] to-[#78350f]">
          {side === 'heads' ? (
            <div className="flex flex-col items-center justify-center">
              <Crown size={38} className="text-[#fef08a] drop-shadow-md" />
              <span className="font-display mt-1 text-[11px] font-black tracking-widest text-[#fef08a]">
                HEADS
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <span className="text-3xl drop-shadow-md">⚜️</span>
              <span className="font-display mt-1 text-[11px] font-black tracking-widest text-[#fef08a]">
                TAILS
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CoinFlip() {
  const { balance, bet, payout, recordLoss, markHand } = useChips()
  const [wager, setWager] = useState(25)
  const [choice, setChoice] = useState<CoinSide>('heads')
  const [flipping, setFlipping] = useState(false)
  const [coinSide, setCoinSide] = useState<CoinSide>('heads')
  const [streak, setStreak] = useState(0)
  const [lastResult, setLastResult] = useState<{
    won: boolean
    outcome: CoinSide
    winAmount: number
    profit: number
  } | null>(null)
  const [history, setHistory] = useState<{ outcome: CoinSide; won: boolean }[]>([
    { outcome: 'heads', won: true },
    { outcome: 'tails', won: false },
    { outcome: 'heads', won: true },
    { outcome: 'heads', won: true },
    { outcome: 'tails', won: false },
  ])
  const [burst, setBurst] = useState(0)

  const handleAddBet = (amt: number) => {
    if (flipping) return
    setWager((w) => Math.min(balance, w + amt))
    sfx.chip()
  }

  const handleBetAll = () => {
    if (flipping || balance <= 0) return
    setWager(balance)
    sfx.chip()
  }

  const handleClearBet = () => {
    if (flipping) return
    setWager(25)
    sfx.click()
  }

  const flipCoin = () => {
    if (flipping) return
    if (wager < 25 || wager > balance) return

    // Deduct bet immediately
    if (!bet(wager, true, 'coinflip')) return
    markHand('coinflip', wager)

    setFlipping(true)
    setLastResult(null)
    sfx.flip()

    // 50% exact probability
    const nextSide: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails'

    setTimeout(() => {
      setCoinSide(nextSide)
      setFlipping(false)

      const isWin = nextSide === choice

      if (isWin) {
        // 1.95x total return
        const winTotal = Math.floor(wager * 1.95)
        const profit = winTotal - wager
        payout(winTotal, profit)
        setBurst((b) => b + 1)
        sfx.win()
        setStreak((s) => s + 1)
        setLastResult({ won: true, outcome: nextSide, winAmount: winTotal, profit })
        setHistory((h) => [{ outcome: nextSide, won: true }, ...h].slice(0, 10))
      } else {
        recordLoss()
        sfx.lose()
        setStreak(0)
        setLastResult({ won: false, outcome: nextSide, winAmount: 0, profit: -wager })
        setHistory((h) => [{ outcome: nextSide, won: false }, ...h].slice(0, 10))
      }
    }, 1300)
  }

  return (
    <GameShell
      screen="coinflip"
      side={
        <div className="flex items-center justify-between text-[11px] tracking-[0.25em] text-[#8a7a4d]">
          <span>ADMIN PRE-RELEASE · GOLDEN FELT LABS</span>
          <span>HIGH ROLLER COIN FLIP · 1.95X PAYOUT · 50% ODDS</span>
        </div>
      }
    >
      <div className="relative mx-auto w-full max-w-4xl px-2">
        <GoldBurst trigger={burst} />

        {/* History Ticker */}
        <div className="mb-4 flex items-center justify-between gap-2 overflow-x-auto rounded-xl border border-[#c9a227]/25 bg-black/50 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-widest text-[#8a7a4d] uppercase shrink-0 pl-1">
              RECENT FLIPS:
            </span>
            <div className="flex items-center gap-2">
              {history.map((h, i) => (
                <span
                  key={i}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wider shadow-sm ${
                    h.won
                      ? 'border border-[#10b981]/50 bg-[#064e3b]/70 text-[#a7f3d0]'
                      : 'border border-[#ef4444]/40 bg-[#450a0a]/60 text-[#fca5a5]'
                  }`}
                >
                  {h.outcome} {h.won ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
          {streak > 1 && (
            <div className="shrink-0 rounded-lg border border-[#f59e0b]/50 bg-[#d97706]/20 px-2.5 py-1 text-[10px] font-black text-[#fde047]">
              STREAK: {streak}🔥
            </div>
          )}
        </div>

        {/* Central Coin Arena Stage */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#c9a227]/40 bg-gradient-to-b from-[#140e04] via-[#090703] to-black p-6 sm:p-8 shadow-2xl">
          {/* Top Admin Badge */}
          <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 rounded-full border border-[#f59e0b]/50 bg-black/70 px-2.5 py-1 text-[9px] font-black tracking-wider text-[#fef08a]">
            <Coins size={12} className="text-[#f59e0b]" />
            <span>ADMIN PRE-RELEASE · COIN FLIP V1.0</span>
          </div>

          <div className="flex flex-col items-center justify-center py-6">
            {/* The 3D Animated Coin */}
            <CoinGraphic side={coinSide} flipping={flipping} />

            {/* Selected Target Badge */}
            <div className="mt-5 flex items-center gap-2 rounded-full border border-[#c9a227]/30 bg-black/60 px-4 py-1.5 text-[11px]">
              <span className="text-[#a89872]">YOUR PREDICTION:</span>
              <span className="font-display font-black uppercase text-[#f6e27a] tracking-wider">
                {choice}
              </span>
            </div>

            {/* Result Announcement */}
            {lastResult && (
              <div className="mt-5 text-center animate-bounce">
                {lastResult.won ? (
                  <div className="rounded-xl border border-[#10b981]/50 bg-[#064e3b]/80 px-6 py-2.5 shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                    <div className="text-[11px] font-black tracking-[0.25em] text-[#86efac] uppercase">
                      LANDED ON {lastResult.outcome} · YOU WON!
                    </div>
                    <div className="font-display text-2xl font-black text-[#fef08a]">
                      +{fmt(lastResult.winAmount)} CHIPS WON!
                    </div>
                    <div className="text-[10px] text-[#bbf7d0]">
                      Bet: {fmt(wager)} chips × 1.95 = {fmt(lastResult.winAmount)} chips (+{fmt(lastResult.profit)} profit)
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#ef4444]/50 bg-[#450a0a]/80 px-6 py-2.5 shadow-[0_0_25px_rgba(239,68,68,0.4)]">
                    <div className="text-[11px] font-black tracking-[0.25em] text-[#fca5a5] uppercase">
                      LANDED ON {lastResult.outcome} · MISSED
                    </div>
                    <div className="font-display text-xl font-black text-[#fee2e2]">
                      -{fmt(wager)} CHIPS LOST
                    </div>
                    <div className="text-[10px] text-[#f87171]">Flip again to win it back!</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side Selector (Heads or Tails, 50% each) */}
          <div className="mt-2 border-t border-[#c9a227]/20 pt-4">
            <div className="mb-2 text-center text-[10px] font-bold tracking-[0.25em] text-[#a89872]">
              SELECT COIN FACE (1.95x PAYOUT):
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <button
                onClick={() => {
                  if (flipping) return
                  setChoice('heads')
                  sfx.click()
                }}
                disabled={flipping}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 transition-all ${
                  choice === 'heads'
                    ? 'border-[#f6e27a] bg-gradient-to-b from-[#d97706]/40 to-[#b45309]/50 shadow-[0_0_20px_rgba(246,226,122,0.4)] scale-[1.03]'
                    : 'border-[#c9a227]/25 bg-black/40 hover:border-[#c9a227]/50'
                } disabled:opacity-40`}
              >
                <Crown size={28} className={choice === 'heads' ? 'text-[#fef08a]' : 'text-[#a89872]'} />
                <span className={`font-display mt-1 text-base font-black tracking-wider ${choice === 'heads' ? 'text-[#fef08a]' : 'text-[#f2e6c9]'}`}>
                  HEADS
                </span>
                <span className="text-[9px] text-[#a89872]">Imperial Crown · 50%</span>
              </button>

              <button
                onClick={() => {
                  if (flipping) return
                  setChoice('tails')
                  sfx.click()
                }}
                disabled={flipping}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 transition-all ${
                  choice === 'tails'
                    ? 'border-[#f6e27a] bg-gradient-to-b from-[#d97706]/40 to-[#b45309]/50 shadow-[0_0_20px_rgba(246,226,122,0.4)] scale-[1.03]'
                    : 'border-[#c9a227]/25 bg-black/40 hover:border-[#c9a227]/50'
                } disabled:opacity-40`}
              >
                <span className="text-2xl">⚜️</span>
                <span className={`font-display mt-1 text-base font-black tracking-wider ${choice === 'tails' ? 'text-[#fef08a]' : 'text-[#f2e6c9]'}`}>
                  TAILS
                </span>
                <span className="text-[9px] text-[#a89872]">Golden Fleur · 50%</span>
              </button>
            </div>
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
                    disabled={flipping || balance < val}
                    className="rounded-lg border border-[#c9a227]/30 bg-black/50 px-3 py-1.5 text-[11px] font-bold text-[#f2e6c9] hover:border-[#f6e27a] disabled:opacity-30"
                  >
                    +{fmt(val)}
                  </button>
                ))}
                <button
                  onClick={handleBetAll}
                  disabled={flipping || balance <= 0}
                  className="rounded-lg border border-[#f59e0b]/50 bg-[#d97706]/20 px-3.5 py-1.5 text-[10px] font-black text-[#fde047] hover:bg-[#d97706]/40 disabled:opacity-30"
                >
                  BET ALL
                </button>
                <button
                  onClick={handleClearBet}
                  disabled={flipping}
                  className="rounded-lg border border-[#ef4444]/40 bg-black/40 px-3 py-1.5 text-[10px] font-bold text-[#fca5a5] hover:border-[#ef4444] disabled:opacity-30"
                >
                  RESET
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#c9a227]/25 bg-black/40 px-3 py-2 text-[11px]">
                <span className="text-[#8a7a4d]">Potential Payout (1.95x):</span>
                <span className="font-display font-bold text-[#86efac]">
                  +{fmt(Math.floor(wager * 1.95))} chips (+{fmt(Math.floor(wager * 0.95))} net)
                </span>
              </div>
            </div>

            {/* Right Action Button */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <button
                onClick={flipCoin}
                disabled={flipping || balance < wager || wager < 25}
                className="btn-gold min-h-[64px] w-full rounded-2xl text-base font-black tracking-widest shadow-[0_0_25px_rgba(201,162,39,0.4)] hover:brightness-110 active:scale-95 disabled:opacity-40"
              >
                {flipping ? (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles size={18} className="animate-spin text-[#140b02]" />
                    COIN IN THE AIR…
                  </span>
                ) : (
                  `FLIP COIN (${fmt(wager)} CHIPS)`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}

