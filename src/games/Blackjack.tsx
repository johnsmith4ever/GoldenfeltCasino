import { useCallback, useEffect, useRef, useState } from 'react'
import { freshShoe, bjValue, isBlackjack, type Card } from '../lib/cards'
import { useChips, fmt } from '../state/chips'
import { sfx } from '../lib/audio'
import { GameShell, ResultBanner, GoldBurst } from '../components/GameShell'
import { PlayingCard } from '../components/PlayingCard'
import { Chip, CHIP_DENOMS, ChipPile } from '../components/Chip'

type Phase = 'betting' | 'player' | 'dealer' | 'done'

/** The last bet is remembered, even if you leave the table and come back. */
const LAST_BET_KEY = 'golden-felt-bj-lastbet'
function loadLastBet(): number {
  try {
    const n = Number(localStorage.getItem(LAST_BET_KEY))
    return Number.isFinite(n) && n >= 25 ? n : 0
  } catch { return 0 }
}
function saveLastBet(n: number) {
  try { localStorage.setItem(LAST_BET_KEY, String(n)) } catch { /* storage blocked */ }
}
interface Result { kind: 'win' | 'lose' | 'push'; title: string; detail?: string; amount?: number }

export default function Blackjack() {
  const { balance, bet, markHand, payout, refund } = useChips()
  const [phase, setPhase] = useState<Phase>('betting')
  const [wager, setWager] = useState(0)
  const [lastBet, setLastBet] = useState(loadLastBet)
  const [carried, setCarried] = useState(false)
  const [shoe, setShoe] = useState<Card[]>([])
  const [player, setPlayer] = useState<Card[]>([])
  const [dealer, setDealer] = useState<Card[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [burst, setBurst] = useState(0)
  const dealingRef = useRef(false)

  const pv = bjValue(player)
  const dv = bjValue(dealer)
  const hideHole = phase === 'player'

  // Tapping a chip adds it to the bet. Each tap counts, so 3 taps on a 25 chip is a bet of 75.
  const addChip = (v: number) => {
    if (phase !== 'betting' || v > balance) return
    if (!bet(v, false)) return
    sfx.chip()
    setWager((w) => w + v)
    setCarried(false)
  }

  const clearBet = () => {
    refund(wager)
    setWager(0)
    setCarried(false)
    sfx.click()
  }

  /** Put last hand's bet back on the table (or as much of it as the balance allows). */
  const restoreBet = () => {
    const target = Math.floor(Math.min(lastBet, balance) / 25) * 25
    if (target < 25 || !bet(target, false)) return false
    setWager(target)
    return true
  }
  const rebet = () => {
    if (restoreBet()) { sfx.chip(); setCarried(true) }
  }
  const betAll = () => {
    const amount = balance
    if (amount <= 0 || !bet(amount, false)) return
    setWager((w) => w + amount)
    setCarried(false)
    sfx.chip()
  }

  // If you walk away from the table while chips are sitting on the bet, give them back.
  const wagerRef = useRef(0)
  const phaseRef = useRef<Phase>('betting')
  useEffect(() => { wagerRef.current = wager; phaseRef.current = phase }, [wager, phase])
  useEffect(() => () => {
    if (phaseRef.current === 'betting' && wagerRef.current > 0) refund(wagerRef.current)
  }, [refund])

  const deal = () => {
    if (wager < 25 || dealingRef.current) return
    dealingRef.current = true
    saveLastBet(wager)
    setLastBet(wager)
    setCarried(false)
    markHand('blackjack', wager)
    const s = freshShoe()
    const p = [s[0], s[2]]
    const d = [s[1], s[3]]
    setShoe(s.slice(4))
    setPlayer(p)
    setDealer(d)
    setResult(null)
    sfx.deal()
    setPhase('player')

    // immediate blackjack checks
    const pBJ = isBlackjack(p)
    const dBJ = isBlackjack(d)
    if (pBJ || dBJ) {
      setTimeout(() => {
        setPhase('done')
        settle(p, d, wager, true)
        dealingRef.current = false
      }, 900)
    } else {
      dealingRef.current = false
    }
  }

  const settle = useCallback((p: Card[], d: Card[], w: number, instant = false) => {
    const pt = bjValue(p).total
    const dt = bjValue(d).total
    const pBJ = isBlackjack(p)
    const dBJ = isBlackjack(d)

    let r: Result
    if (pBJ && dBJ) {
      refund(w)
      r = { kind: 'push', title: 'PUSH', detail: 'Two blackjacks — wager returned' }
      sfx.push()
    } else if (pBJ) {
      const win = Math.floor(w * 2.5)
      payout(win, win - w)
      setBurst((b) => b + 1)
      r = { kind: 'win', title: 'BLACKJACK', detail: 'Pays 3 to 2', amount: win - w }
      sfx.bigWin()
    } else if (dBJ) {
      r = { kind: 'lose', title: 'DEALER BLACKJACK', detail: 'The house takes it' }
      sfx.lose()
    } else if (pt > 21) {
      r = { kind: 'lose', title: 'BUST', detail: `${pt} — over twenty-one` }
      sfx.lose()
    } else if (dt > 21) {
      payout(w * 2, w)
      setBurst((b) => b + 1)
      r = { kind: 'win', title: 'DEALER BUSTS', detail: `Dealer ${dt} — you win`, amount: w }
      sfx.win()
    } else if (pt > dt) {
      payout(w * 2, w)
      setBurst((b) => b + 1)
      r = { kind: 'win', title: 'YOU WIN', detail: `${pt} beats ${dt}`, amount: w }
      sfx.win()
    } else if (pt < dt) {
      r = { kind: 'lose', title: 'DEALER WINS', detail: `${dt} beats ${pt}` }
      sfx.lose()
    } else {
      refund(w)
      r = { kind: 'push', title: 'PUSH', detail: `Both ${pt} — wager returned` }
      sfx.push()
    }
    if (instant) setResult(r)
    else setTimeout(() => setResult(r), 500)
  }, [payout, refund])

  const hit = () => {
    if (phase !== 'player') return
    const [card, ...rest] = shoe
    const np = [...player, card]
    setShoe(rest)
    setPlayer(np)
    sfx.deal()
    const v = bjValue(np).total
    if (v > 21) {
      setPhase('done')
      setDealer((d) => d) // reveal
      settle(np, dealer, wager)
    } else if (v === 21) {
      stand(np, rest)
    }
  }

  const stand = (pHand: Card[] = player, shoeIn: Card[] = shoe) => {
    if (phase !== 'player') return
    setPhase('dealer')
    sfx.flip()
    let d = [...dealer]
    let s = [...shoeIn]
    const drawStep = () => {
      const cur = bjValue(d).total
      if (cur < 17) {
        const [c, ...rest] = s
        d = [...d, c]
        s = rest
        setDealer([...d])
        sfx.deal()
        setTimeout(drawStep, 650)
      } else {
        setPhase('done')
        settle(pHand, d, wager)
      }
    }
    setTimeout(drawStep, 700)
  }

  const double = () => {
    if (phase !== 'player' || player.length !== 2 || balance < wager) return
    if (!bet(wager, false)) return
    sfx.chip()
    const newWager = wager * 2
    setWager(newWager)
    const [card, ...rest] = shoe
    const np = [...player, card]
    setShoe(rest)
    setPlayer(np)
    sfx.deal()
    const v = bjValue(np).total
    if (v > 21) {
      setPhase('done')
      settle(np, dealer, newWager)
    } else {
      setPhase('dealer')
      setTimeout(() => {
        let d = [...dealer]
        let s = [...rest]
        const drawStep = () => {
          if (bjValue(d).total < 17) {
            const [c, ...r2] = s
            d = [...d, c]
            s = r2
            setDealer([...d])
            sfx.deal()
            setTimeout(drawStep, 650)
          } else {
            setPhase('done')
            settle(np, d, newWager)
          }
        }
        setTimeout(drawStep, 700)
      }, 400)
    }
  }

  const newRound = () => {
    setPhase('betting')
    setPlayer([])
    setDealer([])
    setWager(0)
    setResult(null)
    sfx.click()
    // Keep the same bet as last hand so you can just hit DEAL again.
    setCarried(restoreBet())
  }

  const canDouble = phase === 'player' && player.length === 2 && balance >= wager

  return (
    <GameShell
      screen="blackjack"
      side={
        <p className="text-center text-[11px] tracking-[0.25em] text-[#8a7a4d]">
          BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17 · DOUBLE ON ANY TWO CARDS
        </p>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />
        <ResultBanner result={result} />

        {/* Dealer */}
        <div className="flex flex-col items-center">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-[10px] tracking-[0.35em] text-[#b3a06b]">DEALER</span>
            {dealer.length > 0 && (
              <span className="rounded-full border border-[#c9a227]/40 bg-black/50 px-2.5 py-0.5 font-display text-xs font-bold text-[#f6e27a] tabular-nums">
                {hideHole ? bjValue([dealer[0]]).total : dv.total}
              </span>
            )}
          </div>
          <div className="flex min-h-[96px] gap-2">
            {dealer.map((c, i) => (
              <PlayingCard key={`d-${i}`} card={c} hidden={hideHole && i === 1} dealDelay={i * 120} />
            ))}
            {dealer.length === 0 && <div className="text-xs tracking-[0.3em] text-white/20 self-center">AWAITING DEAL</div>}
          </div>
        </div>

        <div className="divider-gold my-6" />

        {/* Player */}
        <div className="flex flex-col items-center">
          <div className="flex min-h-[96px] gap-2">
            {player.map((c, i) => (
              <PlayingCard key={`p-${i}`} card={c} dealDelay={i * 120 + 60} />
            ))}
            {player.length === 0 && <div className="text-xs tracking-[0.3em] text-white/20 self-center">PLACE YOUR BET</div>}
          </div>
          <div className="mt-2 flex items-center gap-3">
            {player.length > 0 && (
              <span className="rounded-full border border-[#c9a227]/40 bg-black/50 px-2.5 py-0.5 font-display text-xs font-bold text-[#f6e27a] tabular-nums">
                {pv.soft && pv.total <= 21 ? `${pv.total - 10} / ${pv.total}` : pv.total}
              </span>
            )}
            <span className="text-[10px] tracking-[0.35em] text-[#b3a06b]">YOU</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 flex min-h-[92px] flex-col items-center justify-center gap-3">
          {phase === 'betting' && (
            <>
              <div className="flex items-end justify-center gap-3">
                {CHIP_DENOMS.map((d) => (
                  <Chip key={d.value} value={d.value} size={58} disabled={d.value > balance} onClick={() => addChip(d.value)} />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-3 text-sm text-[#b3a06b]">
                  <span className="text-[10px] tracking-[0.3em]">WAGER</span>
                  {wager > 0 ? <ChipPile amount={wager} /> : <span className="text-white/30">—</span>}
                  {wager > 0 && (
                    <span className="font-display text-lg font-bold tabular-nums text-[#f6e27a]">{fmt(wager)}</span>
                  )}
                  <button onClick={betAll} disabled={balance <= 0} className="btn-ghost-gold min-h-[44px] rounded-lg px-3 text-[10px] tracking-widest">BET ALL</button>
                  {wager > 0 && (
                    <button onClick={clearBet} className="min-h-[44px] px-2 text-[10px] tracking-widest text-[#d4002a] hover:text-[#ff5470]">CLEAR</button>
                  )}
                  {wager === 0 && lastBet >= 25 && balance >= 25 && (
                    <button onClick={rebet} className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-xs">
                      REBET {fmt(Math.floor(Math.min(lastBet, balance) / 25) * 25)}
                    </button>
                  )}
                </div>
                <button onClick={deal} disabled={wager < 25} className="btn-gold min-h-[44px] rounded-lg px-10 py-2.5 text-sm">
                  DEAL
                </button>
              </div>
            </>
          )}
          {phase === 'player' && (
            <div className="flex gap-3">
              <button onClick={hit} className="btn-gold rounded-lg px-8 py-2.5 text-sm">HIT</button>
              <button onClick={() => stand()} className="btn-crimson rounded-lg px-8 py-2.5 text-sm">STAND</button>
              <button onClick={double} disabled={!canDouble} className="btn-ghost-gold rounded-lg px-8 py-2.5 text-sm">
                DOUBLE
              </button>
            </div>
          )}
          {phase === 'dealer' && (
            <div className="text-xs tracking-[0.35em] text-[#b3a06b] pulse-soft">DEALER PLAYS…</div>
          )}
          {phase === 'done' && (
            <button onClick={newRound} className="btn-gold rounded-lg px-10 py-2.5 text-sm">NEW HAND</button>
          )}
        </div>

        {phase === 'betting' && balance < 25 && wager === 0 && (
          <p className="text-center text-xs text-[#d4002a]">Out of chips — claim a free refill up top.</p>
        )}
        {phase === 'betting' && wager > 0 && (
          <p className="mt-1 text-center text-[11px] tracking-[0.2em] text-[#8a7a4d]">
            {carried ? 'SAME BET AS LAST HAND · TAP CHIPS TO RAISE IT, OR CLEAR' : `TAP CHIPS TO ADD · TABLE MINIMUM ${fmt(25)}`}
          </p>
        )}
        {phase === 'betting' && wager === 0 && balance >= 25 && (
          <p className="mt-1 text-center text-[11px] tracking-[0.2em] text-[#8a7a4d]">TAP A CHIP TO PLACE YOUR BET</p>
        )}
      </div>
    </GameShell>
  )
}
