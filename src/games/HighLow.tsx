import { useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { useSpots } from '../state/useSpots'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { PlayingCard } from '../components/PlayingCard'
import { ChipTray } from '../components/ChipTray'
import { ChipPile } from '../components/Chip'
import { ResultStrip, useNarrow, type ResultInfo } from './poker/shared'
import { cashOutValue, judge, newRound, oddsFor } from '../lib/highlow'
import type { Card } from '../lib/cards'

type Phase = 'bet' | 'play' | 'done'
interface Step { card: Card; dir: 'higher' | 'lower' | 'skip'; ok: boolean | null }

const key = (c: Card) => c.rank + c.suit

export default function HighLow() {
  const { balance, payout } = useChips()
  const narrow = useNarrow()
  const st = useSpots('golden-felt-hl-bet', 'highlow')
  const [phase, setPhase] = useState<Phase>('bet')
  const [deck, setDeck] = useState<Card[]>([])
  const [current, setCurrent] = useState<Card | null>(null)
  const [pending, setPending] = useState<Card | null>(null) // the card being turned over
  const [cum, setCum] = useState(1)
  const [streak, setStreak] = useState(0)
  const [history, setHistory] = useState<Step[]>([])
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [burst, setBurst] = useState(0)

  const stake = st.total
  const busy = pending !== null
  const odds = current && phase === 'play' ? oddsFor(deck, current) : null
  const cardSize = narrow ? 'md' : 'lg'

  const deal = () => {
    if (stake < 25 || phase !== 'bet') return
    st.lock()
    const r = newRound()
    setDeck(r.deck)
    setCurrent(r.current)
    setCum(1)
    setStreak(0)
    setHistory([])
    setResult(null)
    setPhase('play')
    sfx.deal()
  }

  const finishWin = (mult: number) => {
    const value = cashOutValue(stake, mult)
    payout(value, value - stake)
    setBurst((b) => b + 1)
    if (mult >= 5) sfx.bigWin(); else sfx.win()
    setResult({ kind: value > stake ? 'win' : 'push', title: 'CASHED OUT', detail: `${streak} correct · ×${mult.toFixed(2)}`, amount: value > stake ? value - stake : 0 })
    setPhase('done')
  }

  const guess = (dir: 'higher' | 'lower') => {
    if (!current || !odds || busy || odds[dir].count === 0) return
    const d = [...deck]
    const next = d.pop() as Card
    setDeck(d)
    setPending(next)
    sfx.flip()
    const mult = odds[dir].mult
    setTimeout(() => {
      const ok = judge(current, next, dir)
      setHistory((h) => [...h, { card: current, dir, ok }])
      setPending(null)
      setCurrent(next)
      if (ok) {
        const c = cum * mult
        setCum(c)
        setStreak((s) => s + 1)
        sfx.coin()
        if (d.length < 3) {
          // the deck is nearly empty: bank the win rather than run out of cards
          const value = cashOutValue(stake, c)
          payout(value, value - stake)
          setBurst((b) => b + 1)
          setResult({ kind: 'win', title: 'DECK EXHAUSTED', detail: 'Paid out automatically', amount: value - stake })
          setPhase('done')
        }
      } else {
        sfx.lose()
        setResult({ kind: 'lose', title: next && current && next.rank === current.rank ? 'A TIE LOSES' : 'WRONG GUESS', detail: `${next.rank} is not ${dir} than ${current.rank}` })
        setPhase('done')
      }
    }, 650)
  }

  const skip = () => {
    if (!current || busy || deck.length < 10) return
    const d = [...deck]
    const next = d.pop() as Card
    setHistory((h) => [...h, { card: current, dir: 'skip', ok: null }])
    setDeck(d)
    setCurrent(next)
    sfx.flip()
  }

  const newRoundClick = () => {
    st.reset()
    setPhase('bet')
    setCurrent(null)
    setPending(null)
    setResult(null)
    setHistory([])
    sfx.click()
    st.restore()
  }

  const pot = cashOutValue(stake, cum)

  return (
    <GameShell
      screen="highlow"
      side={
        <div className="panel-noir mx-auto max-w-2xl rounded-xl p-4 sm:p-5">
          <h4 className="font-display gold-text mb-3 text-sm font-bold tracking-[0.25em]">HOW TO PLAY</h4>
          <ul className="space-y-2 text-[13px] leading-relaxed text-[#cbb98a]">
            <li>A card is turned up. Guess whether the <b>next</b> card is <b>higher</b> or <b>lower</b>. Ace is high.</li>
            <li><b>A tie loses</b>, so only cards that are strictly higher or lower count.</li>
            <li>Every correct guess multiplies your payout. The price comes from the cards <b>still in the deck</b>: a likely guess pays a little, a long shot pays a lot (always 97% of the fair price).</li>
            <li>Cash out any time after a win, or keep going. A wrong guess loses the lot, so a long streak is a big risk.</li>
            <li><b>Skip</b> turns over a new card for free, as many times as you like (until the deck runs low).</li>
          </ul>
        </div>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />

        {/* History */}
        <div className="flex min-h-[64px] flex-wrap items-center justify-center gap-1.5">
          {history.slice(-8).map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <PlayingCard card={h.card} size="xs" />
              <span className={`text-[10px] font-bold ${h.ok === true ? 'text-[#7dffb0]' : h.ok === false ? 'text-[#ff97a3]' : 'text-[#8a7a4d]'}`}>
                {h.dir === 'skip' ? 'SKIP' : h.dir === 'higher' ? '▲' : '▼'}
              </span>
            </div>
          ))}
        </div>

        {/* Cards */}
        <div className="my-4 flex min-h-[150px] items-center justify-center gap-4 sm:gap-8">
          {current ? <PlayingCard key={key(current)} card={current} size={cardSize} dealDelay={0} /> : <span className="text-xs tracking-[0.35em] text-white/25">PLACE YOUR BET</span>}
          {phase === 'play' && (
            pending ? <PlayingCard key={`n-${key(pending)}`} card={pending} size={cardSize} dealDelay={0} /> : <PlayingCard card={{ rank: 'A', suit: '♠' }} hidden size={cardSize} />
          )}
        </div>

        {phase === 'play' && (
          <p className="text-center text-[12px] tracking-[0.3em] text-[#b3a06b]">
            STREAK {streak} · MULTIPLIER ×{cum.toFixed(2)} · POT {fmt(pot)}
          </p>
        )}

        <div className="mt-4"><ResultStrip result={result} /></div>

        <div className="mt-5 flex flex-col items-center gap-3">
          {phase === 'play' && odds && (
            <>
              <div className="grid w-full max-w-lg grid-cols-2 gap-3">
                {(['higher', 'lower'] as const).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => guess(dir)}
                    disabled={busy || odds[dir].count === 0}
                    className="btn-gold min-h-[64px] rounded-xl px-3 py-2"
                  >
                    <div className="text-sm font-bold tracking-[0.2em]">{dir === 'higher' ? '▲ HIGHER' : '▼ LOWER'}</div>
                    <div className="text-[11px] font-semibold tracking-wider opacity-80">
                      {odds[dir].count === 0 ? 'IMPOSSIBLE' : `×${odds[dir].mult.toFixed(2)} · ${Math.round(odds[dir].chance * 100)}% CHANCE`}
                    </div>
                  </button>
                ))}
              </div>
              <div className="grid w-full max-w-lg grid-cols-2 gap-3">
                <button onClick={() => finishWin(cum)} disabled={busy || streak === 0} className="btn-crimson min-h-[48px] rounded-lg px-3 py-2 text-[12px]">
                  CASH OUT {streak > 0 ? fmt(pot) : ''}
                </button>
                <button onClick={skip} disabled={busy || deck.length < 10} className="btn-ghost-gold min-h-[48px] rounded-lg px-3 py-2 text-[12px]">
                  SKIP CARD (FREE)
                </button>
              </div>
            </>
          )}

          {phase === 'bet' && (
            <>
              <ChipTray balance={balance} onPick={(v) => { if (st.add('main', v)) sfx.chip() }} size={narrow ? 50 : 58} />
              <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="flex items-center gap-3 text-sm text-[#b3a06b]">
                  <span className="text-[10px] tracking-[0.3em]">BET</span>
                  {stake > 0 ? <ChipPile amount={stake} /> : <span className="text-white/30">—</span>}
                  {stake > 0 && <span className="font-display text-lg font-bold tabular-nums text-[#f6e27a]">{fmt(stake)}</span>}
                  <button onClick={() => { const a = balance; if (a > 0 && st.add('main', a)) sfx.chip() }} disabled={balance <= 0} className="btn-ghost-gold min-h-[40px] rounded-lg px-3 text-[10px]">BET ALL</button>
                  {stake > 0 && <button onClick={() => { st.clear(); sfx.click() }} className="min-h-[44px] px-2 text-[10px] tracking-widest text-[#d4002a] hover:text-[#ff5470]">CLEAR</button>}
                  {stake === 0 && st.lastTotal >= 25 && balance >= st.lastTotal && (
                    <button onClick={() => { if (st.restore()) sfx.chip() }} className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-xs">REBET {fmt(st.lastTotal)}</button>
                  )}
                </div>
                <button onClick={deal} disabled={stake < 25} className="btn-gold min-h-[44px] rounded-lg px-10 py-2.5 text-sm">DEAL</button>
              </div>
              <p className="text-[11px] tracking-[0.2em] text-[#8a7a4d]">{st.carried ? 'SAME BET AS LAST ROUND · ' : ''}TAP CHIPS TO BET · MINIMUM 25</p>
            </>
          )}

          {phase === 'done' && <button onClick={newRoundClick} className="btn-gold min-h-[48px] rounded-lg px-12 py-3 text-sm">NEW ROUND</button>}
        </div>
      </div>
    </GameShell>
  )
}
