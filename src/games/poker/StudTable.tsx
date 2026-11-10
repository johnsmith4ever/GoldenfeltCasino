import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useChips, fmt } from '../../state/chips'
import { sfx } from '../../lib/audio'
import { GameShell, GoldBurst } from '../../components/GameShell'
import { PlayingCard } from '../../components/PlayingCard'
import { Chip } from '../../components/Chip'
import {
  STREET_NAME, STUD_STAKES, describePartial, newStudHand, studAct, studBetSize, studBotDecide, studEquity, studLegal, studMaxExposure, studSuggest,
  type StudAdvice, type StudHand, type StudSeat, type StudStakes,
} from '../../lib/studEngine'
import type { Action } from '../../lib/holdemEngine'
import { describeHand } from '../../lib/pokerEval'
import { ResultStrip, useNarrow, type ResultInfo } from './shared'
import type { Card } from '../../lib/cards'

const key = (c: Card) => c.rank + c.suit
const BLANK: Card = { rank: 'A', suit: '♠' }

function Seat({ seat, h, hi, myTurn }: { seat: StudSeat; h: StudHand | null; hi: Set<string> | null; myTurn: boolean }) {
  const active = !!h && h.toAct === seat.id && !h.result
  const showdown = !!h?.result?.showdown
  const reveal = showdown && !seat.folded
  const ev = h?.result?.evs[seat.id]
  const win = h?.result?.winners.find((w) => w.seat === seat.id)
  const showing = seat.up.length ? describePartial(seat.up) : ''
  const status = win ? `WINS ${fmt(win.amount)}` : seat.folded ? 'FOLDED' : active && !myTurn ? 'THINKING…' : (seat.last ?? '')
  return (
    <div className={`panel-noir rounded-xl p-2 text-center transition sm:p-3 ${active ? 'shadow-[0_0_18px_rgba(246,226,122,0.35)] ring-1 ring-[#f6e27a]' : ''} ${win ? 'ring-2 ring-[#f6e27a]' : ''} ${seat.folded ? 'opacity-50' : ''}`}>
      <div className="font-display text-[13px] font-bold tracking-wider text-[#f2e6c9]">{seat.name}</div>
      <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">{seat.tag.toUpperCase()}</div>
      <div className="mt-1.5 flex min-h-[52px] justify-center">
        {seat.up.map((c, i) => (
          <div key={`${seat.id}u-${key(c)}`} className={i > 0 ? '-ml-4' : ''}><PlayingCard card={c} size="xs" dealDelay={0} dim={showdown && !seat.folded && !!hi && !hi.has(key(c))} /></div>
        ))}
        {seat.up.length === 0 && <span className="self-center text-white/20">—</span>}
      </div>
      <div className="mt-1 flex min-h-[52px] justify-center">
        {seat.down.map((c, i) => (
          <div key={`${seat.id}d-${key(c)}`} className={i > 0 ? '-ml-4' : ''}><PlayingCard card={c} size="xs" hidden={!reveal} dealDelay={0} dim={reveal && !!hi && !hi.has(key(c))} /></div>
        ))}
      </div>
      <div className={`mt-1 min-h-[16px] text-[11px] font-semibold tracking-wide ${win ? 'text-[#f6e27a]' : 'text-[#b3a06b]'}`}>{status}</div>
      <div className="text-[10px] leading-tight text-[#e8dcb8]">{reveal && ev ? describeHand(ev) : seat.folded ? '' : showing}</div>
      {h && <div className="mt-0.5 text-[10px] tabular-nums text-[#6b5f42]">IN: {fmt(seat.paid)}</div>}
    </div>
  )
}

export default function StudTable({ nav, rules }: { nav: ReactNode; rules: ReactNode }) {
  const { balance, bet, markHand, payout, hintActive, consumeHint } = useChips()
  const narrow = useNarrow()
  const [stakesId, setStakesId] = useState(STUD_STAKES[0].id)
  const [hand, setHand] = useState<StudHand | null>(null)
  const [fresh, setFresh] = useState(false)
  const [coach, setCoach] = useState(true)
  const [tokenHint, setTokenHint] = useState(false)
  const [burst, setBurst] = useState(0)
  const [startButton] = useState(() => Math.floor(Math.random() * 4))
  const stakes: StudStakes = STUD_STAKES.find((s) => s.id === stakesId) ?? STUD_STAKES[0]

  const inHand = !!hand && !hand.result
  const iFolded = !!hand?.seats[0].folded
  const speed = iFolded ? 0.2 : 1

  const settle = (h: StudHand) => {
    const w = h.result?.winners.find((x) => x.seat === 0)
    if (w) {
      payout(w.amount, w.amount - h.seats[0].paid)
      if (w.amount > h.seats[0].paid) { setBurst((b) => b + 1); sfx.win() } else sfx.push()
    } else if (!h.seats[0].folded) sfx.lose()
  }

  const apply = (a: Action) => {
    if (!hand || hand.result) return
    const next = studAct(hand, a)
    const delta = next.seats[0].paid - hand.seats[0].paid
    if (delta > 0) bet(delta, false)
    setHand(next)
    if (next.street !== hand.street) { setFresh(true); sfx.deal() }
    if (a === 'fold' || a === 'check') sfx.click(); else sfx.chip()
    if (next.result) settle(next)
  }
  const applyRef = useRef(apply)
  useEffect(() => { applyRef.current = apply })

  const deal = () => {
    if (inHand || balance < studMaxExposure(stakes)) return
    const btn = hand ? (hand.button + 1) % 4 : startButton
    const h = newStudHand(stakes, btn)
    const cost = h.seats[0].paid
    if (cost > 0 && !bet(cost, false)) return
    markHand('poker', cost)
    setHand(h)
    setFresh(true)
    sfx.deal()
  }

  useEffect(() => {
    if (hintActive && inHand && consumeHint()) setTokenHint(true)
    if (!inHand && hand?.result) setTokenHint(false)
  }, [hintActive, inHand, hand?.result, consumeHint])

  // Bots act after a short pause (a little longer right after new cards are dealt).
  useEffect(() => {
    if (!hand || hand.result || hand.toAct === null || hand.seats[hand.toAct].human) return
    const t = setTimeout(() => { setFresh(false); applyRef.current(studBotDecide(hand)) }, (650 + Math.random() * 650) * speed + (fresh ? 900 * speed : 0) + 30)
    return () => clearTimeout(t)
  }, [hand, speed, fresh])

  const myTurn = !!hand && !hand.result && hand.toAct === 0
  const legal = myTurn && hand ? studLegal(hand) : null

  const [coachNote, setCoachNote] = useState<{ forHand: StudHand; advice: StudAdvice } | null>(null)
  useEffect(() => {
    if (!(coach || tokenHint) || !myTurn || !hand) return
    const t = setTimeout(() => setCoachNote({ forHand: hand, advice: studSuggest(hand, 0, studEquity(hand, 0, 150)) }), 30)
    return () => clearTimeout(t)
  }, [coach, tokenHint, myTurn, hand])
  const advice = (coach || tokenHint) && myTurn && coachNote && coachNote.forHand === hand ? coachNote.advice : null

  const winnerCards = useMemo(() => {
    const r = hand?.result
    if (!r?.showdown) return null
    const set = new Set<string>()
    for (const w of r.winners) for (const c of r.evs[w.seat].cards) set.add(key(c))
    return set
  }, [hand])

  const me = hand?.seats[0]
  const myAll = me ? [...me.down, ...me.up] : []
  const myLabel = me && !me.folded && myAll.length ? describePartial(myAll) : ''

  const result: ResultInfo | null = useMemo(() => {
    const r = hand?.result
    if (!hand || !r) return null
    const mine = r.winners.find((w) => w.seat === 0)
    const paid = hand.seats[0].paid
    if (mine) {
      const net = mine.amount - paid
      return { kind: net > 0 ? 'win' : 'push', title: r.winners.length > 1 ? 'SPLIT POT' : 'YOU WIN THE POT', detail: r.showdown ? describeHand(r.evs[0]) : 'Everyone else folded', amount: net > 0 ? net : 0 }
    }
    const w = r.winners[0]
    return { kind: 'lose', title: hand.seats[0].folded ? 'YOU FOLDED' : 'HAND LOST', detail: `${hand.seats[w.seat].name} wins ${fmt(w.amount)}${r.showdown ? ' with ' + describeHand(r.evs[w.seat]) : ''}` }
  }, [hand])

  const mySize = narrow ? 'sm' : 'md'
  const canSit = balance >= studMaxExposure(stakes)
  const waitingFor = hand && hand.toAct !== null && !hand.result ? hand.seats[hand.toAct] : null
  const blanks: StudSeat[] = [1, 2, 3].map((i) => ({ id: i, name: ['Victor', 'Maya', 'Dex'][i - 1], tag: ['Cautious', 'Balanced', 'Aggressive'][i - 1], human: false, style: null, down: [], up: [], folded: false, paid: 0, street: 0, acted: false, last: null }))

  return (
    <GameShell screen="poker" title="Seven-Card Stud" tagline="Seven cards each · some face up, some hidden" top={nav} side={<div className="mx-auto max-w-3xl space-y-4">{rules}</div>}>
      <div className="relative">
        <GoldBurst trigger={burst} />

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] tracking-[0.2em] text-[#b3a06b]">
          <span>{stakes.name.toUpperCase()} · ANTE {fmt(stakes.ante)} · BRING-IN {fmt(stakes.bringIn)} · BETS {fmt(stakes.small)}/{fmt(stakes.big)}</span>
          <button onClick={() => { sfx.click(); setCoach((c) => !c) }} className={`min-h-[36px] rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.25em] ${coach ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]' : 'border-[#c9a227]/30 text-[#8a7a4d]'}`}>
            COACH {coach ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {(hand ? hand.seats.slice(1) : blanks).map((s) => <Seat key={s.id} seat={s} h={hand} hi={winnerCards} myTurn={myTurn} />)}
        </div>

        <div className="my-4 flex flex-col items-center gap-2">
          <div className="text-[10px] font-bold tracking-[0.4em] text-[#b3a06b]">
            {hand ? STREET_NAME[hand.street] : 'READY TO DEAL'}
            {hand && inHand ? <span className="text-[#6b5f42]"> · BET SIZE {fmt(studBetSize(hand))}</span> : null}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#c9a227]/40 bg-black/45 py-1 pl-1.5 pr-4">
            <Chip value={100} size={24} label="" />
            <span className="text-[10px] tracking-[0.3em] text-[#8a7a4d]">POT</span>
            <span className="font-display text-lg font-bold tabular-nums text-[#f6e27a]">{fmt(hand?.pot ?? 0)}</span>
          </div>
        </div>

        <ResultStrip result={result} />

        <div className={`panel-noir mt-4 rounded-xl p-3 sm:p-4 ${myTurn ? 'shadow-[0_0_18px_rgba(246,226,122,0.3)] ring-1 ring-[#f6e27a]' : ''}`}>
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
            <span className="font-display text-[13px] font-bold tracking-wider text-[#f2e6c9]">YOU</span>
            {hand && <span className="text-[10px] tabular-nums text-[#6b5f42]">IN: {fmt(me?.paid ?? 0)}</span>}
            {me?.folded && <span className="text-[11px] font-semibold tracking-wide text-[#b3a06b]">FOLDED</span>}
          </div>
          <div className={`space-y-2 ${me?.folded ? 'opacity-45' : ''}`}>
            <div>
              <div className="mb-1 text-center text-[9px] tracking-[0.3em] text-[#8a7a4d]">YOUR HIDDEN CARDS (ONLY YOU CAN SEE THESE)</div>
              <div className="flex min-h-[74px] items-center justify-center gap-2">
                {me?.down.length ? me.down.map((c) => <PlayingCard key={key(c)} card={c} size={mySize} dealDelay={0} dim={!!winnerCards && !winnerCards.has(key(c))} held={!!winnerCards && winnerCards.has(key(c))} heldLabel={null} />) : <span className="text-xs tracking-[0.35em] text-white/25">DEAL TO START</span>}
              </div>
            </div>
            <div>
              <div className="mb-1 text-center text-[9px] tracking-[0.3em] text-[#8a7a4d]">FACE UP (EVERYONE SEES THESE)</div>
              <div className="flex min-h-[74px] items-center justify-center gap-2">
                {me?.up.map((c) => <PlayingCard key={key(c)} card={c} size={mySize} dealDelay={0} dim={!!winnerCards && !winnerCards.has(key(c))} held={!!winnerCards && winnerCards.has(key(c))} heldLabel={null} />)}
              </div>
            </div>
          </div>
          {myLabel && <p className="mt-2 text-center text-[13px] text-[#e8dcb8]">You have: <b className="text-[#f6e27a]">{myLabel}</b></p>}

          {advice && (
            <p className="mx-auto mt-2 max-w-md rounded-lg border border-[#c9a227]/25 bg-black/30 px-3 py-2 text-center text-[12px] leading-snug text-[#cbb98a]">
              <b className="tracking-[0.2em] text-[#f6e27a]">{tokenHint ? 'HINT TOKEN' : 'COACH'}: {advice.action.toUpperCase()}.</b> {advice.why}
            </p>
          )}

          <div className="mt-3 flex min-h-[56px] flex-col items-center justify-center gap-2">
            {myTurn && legal && hand && (
              <>
                <div className="text-[11px] tracking-[0.2em] text-[#8a7a4d]">{legal.toCall > 0 ? `TO CALL ${fmt(legal.toCall)}` : 'NO BET TO YOU'} · POT {fmt(hand.pot)}</div>
                <div className="grid w-full max-w-lg grid-cols-3 gap-2">
                  <button onClick={() => apply('fold')} className="btn-crimson min-h-[48px] rounded-lg px-2 py-2 text-[12px]">FOLD</button>
                  <button onClick={() => apply(legal.canCheck ? 'check' : 'call')} className="btn-ghost-gold min-h-[48px] rounded-lg px-2 py-2 text-[12px]">{legal.canCheck ? 'CHECK' : `CALL ${fmt(legal.toCall)}`}</button>
                  <button onClick={() => apply('raise')} disabled={!legal.canRaise} className="btn-gold min-h-[48px] rounded-lg px-2 py-2 text-[12px]">
                    {!legal.canRaise ? 'CAPPED' : legal.completes ? `COMPLETE ${fmt(legal.raiseCost)}` : hand.level === 0 ? `BET ${fmt(legal.raiseCost)}` : `RAISE ${fmt(legal.raiseCost)}`}
                  </button>
                </div>
              </>
            )}
            {inHand && !myTurn && !iFolded && <div className="text-[12px] tracking-[0.25em] text-[#8a7a4d]">{waitingFor && !waitingFor.human ? `${waitingFor.name.toUpperCase()} IS THINKING…` : ''}</div>}
            {inHand && iFolded && <div className="text-[12px] tracking-[0.25em] text-[#8a7a4d]">PLAYING OUT THE HAND…</div>}

            {!inHand && (
              <div className="flex w-full flex-col items-center gap-3">
                <div className="flex flex-wrap items-stretch justify-center gap-2">
                  {STUD_STAKES.map((st) => {
                    const ok = balance >= studMaxExposure(st)
                    return (
                      <button key={st.id} onClick={() => { sfx.click(); setStakesId(st.id) }} disabled={!ok} className={`min-h-[52px] rounded-lg border px-3 py-1.5 text-left transition disabled:opacity-35 ${stakesId === st.id ? 'border-[#f6e27a] bg-[#2a2105]' : 'border-[#c9a227]/30 bg-black/30'}`}>
                        <div className="text-[11px] font-bold tracking-[0.15em] text-[#f2e6c9]">{st.name.toUpperCase()} {st.small}/{st.big}</div>
                        <div className="text-[10px] text-[#8a7a4d]">most you can lose in a hand: {fmt(studMaxExposure(st))}</div>
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => { const affordable = STUD_STAKES.filter((st) => balance >= studMaxExposure(st)); if (affordable.length) setStakesId(affordable[affordable.length - 1].id) }} disabled={balance < studMaxExposure(STUD_STAKES[0])} className="btn-ghost-gold min-h-[48px] rounded-lg px-5 py-3 text-[10px]">BET ALL · MAX STAKES</button>
                <button onClick={deal} disabled={!canSit} className="btn-gold min-h-[48px] rounded-lg px-12 py-3 text-sm">{hand ? 'DEAL NEXT HAND' : 'DEAL ME IN'}</button>
                {!canSit && <p className="text-center text-[12px] text-[#ff97a3]">You need at least {fmt(studMaxExposure(stakes))} chips to play {stakes.name}. Pick lower stakes, or claim your daily gift in the shop.</p>}
              </div>
            )}
          </div>
          {inHand && <p className="mt-2 text-center text-[10px] tracking-[0.2em] text-[#6b5f42]">LEAVING THE TABLE MID-HAND FORFEITS YOUR BETS</p>}
        </div>
      </div>
    </GameShell>
  )
}
void BLANK
