import { useRef, useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { useSpots } from '../state/useSpots'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { PlayingCard } from '../components/PlayingCard'
import { ChipSelector, ChipPile } from '../components/Chip'
import { ResultStrip, useNarrow, type ResultInfo } from './poker/shared'
import { freshShoe, type Card } from '../lib/cards'
import { compare, settleWar, TIE_BET_PAYS, type Cmp } from '../lib/war'

type Phase = 'bet' | 'deal' | 'tie' | 'war' | 'done'
const AREAS = [
  { key: 'ante', label: 'ANTE', pays: 'PAYS 1 TO 1' },
  { key: 'tie', label: 'TIE BET (OPTIONAL)', pays: `PAYS ${TIE_BET_PAYS} TO 1 ON A TIE` },
] as const

export default function War() {
  const { balance, bet, payout } = useChips()
  const narrow = useNarrow()
  const st = useSpots('golden-felt-war-bets', 'war')
  const [chipVal, setChipVal] = useState(25)
  const [phase, setPhase] = useState<Phase>('bet')
  const [player, setPlayer] = useState<Card | null>(null)
  const [dealer, setDealer] = useState<Card | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [burn, setBurn] = useState(false)
  const [warP, setWarP] = useState<Card | null>(null)
  const [warD, setWarD] = useState<Card | null>(null)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [burst, setBurst] = useState(0)
  const shoe = useRef<Card[]>([])
  const stakes = useRef({ ante: 0, tie: 0 })
  const [locked, setLocked] = useState({ ante: 0, tie: 0 })

  const ante = st.spots.ante ?? 0
  const size = narrow ? 'md' : 'lg'

  const settle = (arg: { first: Cmp; choice?: 'surrender' | 'war'; second?: Cmp }) => {
    const { ante: a, tie: t } = stakes.current
    const s = settleWar({ ante: a, tieBet: t, ...arg })
    if (s.returned > 0) payout(s.returned, s.net)
    let title: string
    if (arg.first === 'win') title = 'YOU WIN'
    else if (arg.first === 'lose') title = 'DEALER WINS'
    else if (arg.choice === 'surrender') title = 'YOU SURRENDERED'
    else title = arg.second === 'lose' ? 'LOST THE WAR' : 'WON THE WAR'
    const parts: string[] = []
    if (arg.first === 'tie' && t > 0) parts.push(`Tie bet +${fmt(t * TIE_BET_PAYS)}`)
    if (arg.choice === 'surrender') parts.push('Half your ante returned')
    if (arg.choice === 'war' && arg.second === 'tie') parts.push('Tied again — you win the war')
    setResult({ kind: s.net > 0 ? 'win' : s.net === 0 ? 'push' : 'lose', title, detail: parts.join(' · ') || undefined, amount: s.net > 0 ? s.net : 0 })
    if (s.net > 0) { setBurst((b) => b + 1); sfx.win() } else if (s.net === 0) sfx.push(); else sfx.lose()
    setPhase('done')
  }

  const place = (key: string) => {
    if (phase !== 'bet' || st.locked) return
    if (st.add(key, chipVal)) sfx.chip()
  }

  const deal = () => {
    if (phase !== 'bet' || ante < 25) return
    stakes.current = { ante, tie: st.spots.tie ?? 0 }
    setLocked(stakes.current)
    st.lock()
    shoe.current = freshShoe(6)
    const p = shoe.current.pop() as Card
    const d = shoe.current.pop() as Card
    setPlayer(p); setDealer(d); setRevealed(false); setWarP(null); setWarD(null); setBurn(false); setResult(null)
    setPhase('deal')
    sfx.deal()
    const first = compare(p, d)
    setTimeout(() => {
      setRevealed(true)
      sfx.flip()
      if (first === 'tie') setPhase('tie')
      else settle({ first })
    }, 900)
  }

  const surrender = () => { if (phase === 'tie') settle({ first: 'tie', choice: 'surrender' }) }

  const goToWar = () => {
    if (phase !== 'tie' || balance < stakes.current.ante) return
    if (!bet(stakes.current.ante, false)) return
    sfx.chip()
    setPhase('war')
    setBurn(true)
    const d = shoe.current
    d.pop(); d.pop(); d.pop() // three burn cards
    const wp = d.pop() as Card
    const wd = d.pop() as Card
    setTimeout(() => { setWarP(wp); setWarD(wd); sfx.flip() }, 1000)
    setTimeout(() => settle({ first: 'tie', choice: 'war', second: compare(wp, wd) }), 1900)
  }

  const next = () => {
    st.reset()
    setPhase('bet'); setPlayer(null); setDealer(null); setWarP(null); setWarD(null); setBurn(false); setResult(null)
    sfx.click()
    st.restore()
  }

  const dummy: Card = { rank: 'A', suit: '♠' }

  return (
    <GameShell
      screen="war"
      side={
        <div className="panel-noir mx-auto max-w-2xl rounded-xl p-4 sm:p-5">
          <h4 className="font-display gold-text mb-3 text-sm font-bold tracking-[0.25em]">HOW TO PLAY</h4>
          <ul className="space-y-2 text-[13px] leading-relaxed text-[#cbb98a]">
            <li>Place an <b>Ante</b>. You and the dealer each get <b>one card</b>. The higher card wins (Ace is high) and your Ante pays 1 to 1.</li>
            <li>If the cards are <b>the same rank, it is War</b>. You choose: <b>Surrender</b> (lose half your Ante) or <b>Go to War</b> by adding a bet equal to your Ante.</li>
            <li>In a war, three cards are burned and you each get one more card. If yours is <b>higher or the same</b>, you win: your Ante pays 1 to 1 and your war bet is returned. If it is lower, you lose both.</li>
            <li>The optional <b>Tie Bet</b> pays {TIE_BET_PAYS} to 1 whenever the first two cards tie. Casino War is a game of pure luck: there is no strategy except to go to war on a tie.</li>
          </ul>
        </div>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="font-display text-[13px] font-bold tracking-[0.3em] text-[#ff6b81]">DEALER</div>
            <div className="mt-2 flex min-h-[130px] items-center justify-center gap-2">
              {dealer ? <PlayingCard key={`d${dealer.rank}${dealer.suit}`} card={dealer} hidden={!revealed} size={size} /> : <span className="text-white/20">—</span>}
              {burn && <div className="flex -space-x-8">{[0, 1, 2].map((i) => <PlayingCard key={i} card={dummy} hidden size="xs" />)}</div>}
              {warD && <PlayingCard card={warD} size={size} />}
            </div>
          </div>
          <div className="text-center">
            <div className="font-display text-[13px] font-bold tracking-[0.3em] text-[#6fa0ff]">YOU</div>
            <div className="mt-2 flex min-h-[130px] items-center justify-center gap-2">
              {player ? <PlayingCard key={`p${player.rank}${player.suit}`} card={player} hidden={!revealed} size={size} /> : <span className="text-white/20">—</span>}
              {burn && <div className="w-[60px]" />}
              {warP && <PlayingCard card={warP} size={size} />}
            </div>
          </div>
        </div>

        {phase === 'tie' && (
          <div className="mt-4 text-center">
            <p className="font-display text-xl font-bold tracking-[0.3em] text-[#f6e27a]">WAR!</p>
            <p className="mt-1 text-[12px] text-[#cbb98a]">The cards tie. Go to war by matching your ante ({fmt(locked.ante)}), or surrender and lose half of it.</p>
            <div className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-3">
              <button onClick={surrender} className="btn-ghost-gold min-h-[48px] rounded-lg py-3 text-sm">SURRENDER</button>
              <button onClick={goToWar} disabled={balance < locked.ante} className="btn-crimson min-h-[48px] rounded-lg py-3 text-sm">GO TO WAR · {fmt(locked.ante)}</button>
            </div>
            {balance < locked.ante && <p className="mt-2 text-[12px] text-[#ff97a3]">You do not have enough chips to go to war, so you can only surrender.</p>}
          </div>
        )}

        <div className="mt-4"><ResultStrip result={result} /></div>

        <div className="mx-auto mt-4 grid max-w-xl grid-cols-2 gap-3">
          {AREAS.map((a) => {
            const amt = st.spots[a.key] ?? 0
            return (
              <button key={a.key} onClick={() => place(a.key)} disabled={phase !== 'bet'} className="min-h-[104px] rounded-xl border-2 border-[#c9a227]/35 bg-black/40 px-2 py-2 text-center disabled:cursor-default">
                <div className="font-display text-[12px] font-bold tracking-[0.2em] text-[#f2e6c9]">{a.label}</div>
                <div className="text-[9px] tracking-wider text-[#8a7a4d]">{a.pays}</div>
                <div className="mt-1 flex min-h-[44px] items-end justify-center">{amt > 0 ? <ChipPile amount={amt} size={28} /> : <span className="pb-3 text-white/20">—</span>}</div>
                <div className="font-display text-sm font-bold tabular-nums text-[#f6e27a]">{amt > 0 ? fmt(amt) : ''}</div>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
          {phase === 'bet' && (
            <>
              <ChipSelector selected={chipVal} onSelect={setChipVal} max={balance} />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => { const a = balance; if (a > 0 && st.add('ante', a)) sfx.chip() }} disabled={balance <= 0} className="btn-ghost-gold min-h-[40px] rounded-lg px-3 text-[10px]">BET ALL</button>
                {st.total > 0 && <button onClick={() => { st.clear(); sfx.click() }} className="min-h-[44px] px-2 text-[10px] tracking-widest text-[#d4002a]">CLEAR BETS</button>}
                {st.total === 0 && st.lastTotal >= 25 && balance >= st.lastTotal && (
                  <button onClick={() => { if (st.restore()) sfx.chip() }} className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-xs">REBET {fmt(st.lastTotal)}</button>
                )}
                <button onClick={deal} disabled={ante < 25 || balance < 0} className="btn-gold min-h-[44px] rounded-lg px-10 py-2.5 text-sm">DEAL</button>
              </div>
              <p className="text-[11px] tracking-[0.2em] text-[#8a7a4d]">{st.carried ? 'SAME BETS AS LAST HAND · ' : ''}PICK A CHIP, THEN TAP ANTE (REQUIRED) OR TIE BET</p>
              {ante >= 25 && balance < ante && <p className="text-[12px] text-[#ff97a3]">Keep {fmt(ante)} back if you may need to go to war.</p>}
            </>
          )}
          {phase === 'deal' && <div className="text-[12px] tracking-[0.3em] text-[#8a7a4d]">DEALING…</div>}
          {phase === 'war' && <div className="text-[12px] tracking-[0.3em] text-[#8a7a4d]">THREE CARDS BURNED… WAR CARDS…</div>}
          {phase === 'done' && <button onClick={next} className="btn-gold min-h-[48px] rounded-lg px-12 py-3 text-sm">NEW HAND</button>}
        </div>
      </div>
    </GameShell>
  )
}
