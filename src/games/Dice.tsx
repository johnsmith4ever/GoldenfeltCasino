import { useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { Die } from '../components/Die'
import { Dices, Sparkles } from 'lucide-react'

type BetChoice = 'low' | 'high' | 'odd' | 'even'

const PRESET_BETS = [25, 100, 500, 1000, 5000, 25000]

export default function DiceGame() {
  const { balance, bet, payout, recordLoss, markHand } = useChips()
  const [wager, setWager] = useState(25)
  const [choice, setChoice] = useState<BetChoice>('high')
  const [rolling, setRolling] = useState(false)
  const [diceVal, setDiceVal] = useState(6)
  const [lastResult, setLastResult] = useState<{
    won: boolean
    roll: number
    winAmount: number
    profit: number
    choiceLabel: string
  } | null>(null)
  const [history, setHistory] = useState<{ roll: number; won: boolean; choice: BetChoice }[]>([
    { roll: 5, won: true, choice: 'high' },
    { roll: 2, won: false, choice: 'high' },
    { roll: 4, won: true, choice: 'even' },
    { roll: 6, won: true, choice: 'high' },
    { roll: 1, won: false, choice: 'odd' },
  ])
  const [burst, setBurst] = useState(0)

  const handleAddBet = (amt: number) => {
    if (rolling) return
    setWager((w) => Math.min(balance, w + amt))
    sfx.chip()
  }

  const handleBetAll = () => {
    if (rolling || balance <= 0) return
    setWager(balance)
    sfx.chip()
  }

  const handleClearBet = () => {
    if (rolling) return
    setWager(25)
    sfx.click()
  }

  const checkWin = (roll: number, selected: BetChoice): boolean => {
    if (selected === 'low') return roll >= 1 && roll <= 3
    if (selected === 'high') return roll >= 4 && roll <= 6
    if (selected === 'odd') return roll % 2 === 1
    if (selected === 'even') return roll % 2 === 0
    return false
  }

  const getChoiceTitle = (c: BetChoice) => {
    switch (c) {
      case 'low': return 'LOW (1, 2, 3)'
      case 'high': return 'HIGH (4, 5, 6)'
      case 'odd': return 'ODD (1, 3, 5)'
      case 'even': return 'EVEN (2, 4, 6)'
    }
  }

  const rollDice = () => {
    if (rolling) return
    if (wager < 25 || wager > balance) return

    // Deduct bet immediately
    if (!bet(wager, true, 'dice')) return
    markHand('dice', wager)

    setRolling(true)
    setLastResult(null)
    sfx.dice()

    // Random roll between 1 and 6 (exact 50% win probability for Low/High and Odd/Even)
    const nextRoll = Math.floor(Math.random() * 6) + 1

    setTimeout(() => {
      setDiceVal(nextRoll)
      setRolling(false)

      const isWin = checkWin(nextRoll, choice)

      if (isWin) {
        // 1.95x total return (original bet + 0.95x net profit)
        const winTotal = Math.floor(wager * 1.95)
        const profit = winTotal - wager
        payout(winTotal, profit)
        setBurst((b) => b + 1)
        sfx.win()
        setLastResult({
          won: true,
          roll: nextRoll,
          winAmount: winTotal,
          profit,
          choiceLabel: getChoiceTitle(choice),
        })
        setHistory((h) => [{ roll: nextRoll, won: true, choice }, ...h].slice(0, 10))
      } else {
        recordLoss()
        sfx.lose()
        setLastResult({
          won: false,
          roll: nextRoll,
          winAmount: 0,
          profit: -wager,
          choiceLabel: getChoiceTitle(choice),
        })
        setHistory((h) => [{ roll: nextRoll, won: false, choice }, ...h].slice(0, 10))
      }
    }, 1100)
  }

  return (
    <GameShell
      screen="dice"
      side={
        <div className="flex items-center justify-between text-[11px] tracking-[0.25em] text-[#8a7a4d]">
          <span>ADMIN PRE-RELEASE · GOLDEN FELT LABS</span>
          <span>CASINO DICE DUEL · 1.95X PAYOUT · 50% ODDS</span>
        </div>
      }
    >
      <div className="relative mx-auto w-full max-w-4xl px-2">
        <GoldBurst trigger={burst} />

        {/* History Ticker */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto rounded-xl border border-[#c9a227]/25 bg-black/50 p-2.5">
          <span className="text-[9px] font-bold tracking-widest text-[#8a7a4d] uppercase shrink-0 pl-1">
            RECENT ROLLS:
          </span>
          <div className="flex items-center gap-2">
            {history.map((h, i) => (
              <span
                key={i}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-black tabular-nums shadow-sm ${
                  h.won
                    ? 'border border-[#10b981]/50 bg-[#064e3b]/70 text-[#a7f3d0]'
                    : 'border border-[#ef4444]/40 bg-[#450a0a]/60 text-[#fca5a5]'
                }`}
              >
                [{h.roll}] {h.won ? 'WIN (1.95x)' : 'LOSS'}
              </span>
            ))}
          </div>
        </div>

        {/* Central Dice Table Stage */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#c9a227]/40 bg-gradient-to-b from-[#180a0d] via-[#100709] to-black p-6 sm:p-8 shadow-2xl">
          {/* Top Admin Badge */}
          <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 rounded-full border border-[#f59e0b]/50 bg-black/70 px-2.5 py-1 text-[9px] font-black tracking-wider text-[#fef08a]">
            <Dices size={12} className="text-[#f59e0b]" />
            <span>ADMIN PRE-RELEASE · LUCKY DICE V1.0</span>
          </div>

          <div className="flex flex-col items-center justify-center py-6">
            {/* The Animated Die */}
            <div className="relative flex h-36 w-36 items-center justify-center">
              <div className="absolute inset-0 rounded-3xl bg-[#f59e0b]/10 blur-xl" />
              <Die value={diceVal} size={110} rolling={rolling} />
            </div>

            {/* Selected Target Badge */}
            <div className="mt-4 flex items-center gap-2 rounded-full border border-[#c9a227]/30 bg-black/60 px-4 py-1.5 text-[11px]">
              <span className="text-[#a89872]">YOUR BET:</span>
              <span className="font-display font-black text-[#f6e27a] tracking-wider">
                {getChoiceTitle(choice)}
              </span>
            </div>

            {/* Result Announcement */}
            {lastResult && (
              <div className="mt-5 text-center animate-bounce">
                {lastResult.won ? (
                  <div className="rounded-xl border border-[#10b981]/50 bg-[#064e3b]/80 px-6 py-2.5 shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                    <div className="text-[11px] font-black tracking-[0.25em] text-[#86efac]">
                      ROLLED {lastResult.roll} · MATCHED {lastResult.choiceLabel}!
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
                    <div className="text-[11px] font-black tracking-[0.25em] text-[#fca5a5]">
                      ROLLED {lastResult.roll} · MISSED {lastResult.choiceLabel}
                    </div>
                    <div className="font-display text-xl font-black text-[#fee2e2]">
                      -{fmt(wager)} CHIPS LOST
                    </div>
                    <div className="text-[10px] text-[#f87171]">Try again on the next roll!</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Outcome Choice Selector (50% probability each option) */}
          <div className="mt-2 border-t border-[#c9a227]/20 pt-4">
            <div className="mb-2 text-center text-[10px] font-bold tracking-[0.25em] text-[#a89872]">
              SELECT YOUR OUTCOME PREDICTION (EACH PAYS 1.95x):
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { id: 'low' as BetChoice, label: 'LOW', sub: '1, 2, or 3' },
                { id: 'high' as BetChoice, label: 'HIGH', sub: '4, 5, or 6' },
                { id: 'odd' as BetChoice, label: 'ODD', sub: '1, 3, or 5' },
                { id: 'even' as BetChoice, label: 'EVEN', sub: '2, 4, or 6' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (rolling) return
                    setChoice(opt.id)
                    sfx.click()
                  }}
                  disabled={rolling}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 transition-all ${
                    choice === opt.id
                      ? 'border-[#f6e27a] bg-gradient-to-b from-[#d97706]/40 to-[#b45309]/50 shadow-[0_0_15px_rgba(246,226,122,0.4)] scale-[1.03]'
                      : 'border-[#c9a227]/25 bg-black/40 hover:border-[#c9a227]/50'
                  } disabled:opacity-40`}
                >
                  <span className={`font-display text-sm font-black tracking-wider ${choice === opt.id ? 'text-[#fef08a]' : 'text-[#f2e6c9]'}`}>
                    {opt.label}
                  </span>
                  <span className="mt-0.5 text-[9px] text-[#a89872]">{opt.sub}</span>
                </button>
              ))}
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
                    disabled={rolling || balance < val}
                    className="rounded-lg border border-[#c9a227]/30 bg-black/50 px-3 py-1.5 text-[11px] font-bold text-[#f2e6c9] hover:border-[#f6e27a] disabled:opacity-30"
                  >
                    +{fmt(val)}
                  </button>
                ))}
                <button
                  onClick={handleBetAll}
                  disabled={rolling || balance <= 0}
                  className="rounded-lg border border-[#f59e0b]/50 bg-[#d97706]/20 px-3.5 py-1.5 text-[10px] font-black text-[#fde047] hover:bg-[#d97706]/40 disabled:opacity-30"
                >
                  BET ALL
                </button>
                <button
                  onClick={handleClearBet}
                  disabled={rolling}
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
                onClick={rollDice}
                disabled={rolling || balance < wager || wager < 25}
                className="btn-gold min-h-[64px] w-full rounded-2xl text-base font-black tracking-widest shadow-[0_0_25px_rgba(201,162,39,0.4)] hover:brightness-110 active:scale-95 disabled:opacity-40"
              >
                {rolling ? (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles size={18} className="animate-spin text-[#140b02]" />
                    ROLLING THE DIE…
                  </span>
                ) : (
                  `ROLL DICE (${fmt(wager)} CHIPS)`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}

