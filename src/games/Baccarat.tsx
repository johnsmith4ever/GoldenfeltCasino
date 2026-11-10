import { useRef, useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { useSpots } from '../state/useSpots'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { PlayingCard } from '../components/PlayingCard'
import { ChipSelector, ChipPile } from '../components/Chip'
import { ResultStrip, useNarrow, type ResultInfo } from './poker/shared'
import { handTotal, newShoe, playRound, settleBaccarat, type Outcome, type Round } from '../lib/baccarat'
import type { Card } from '../lib/cards'

type Phase = 'bet' | 'deal' | 'done'
const STEP_MS = 650
const AREAS: { key: 'player' | 'tie' | 'banker'; label: string; pays: string; tone: string }[] = [
  { key: 'player', label: 'PLAYER', pays: 'PAYS 1 TO 1', tone: '#2f6fe0' },
  { key: 'tie', label: 'TIE', pays: 'PAYS 8 TO 1', tone: '#1a9a62' },
  { key: 'banker', label: 'BANKER', pays: 'PAYS 1 TO 1 (5% COMMISSION)', tone: '#d4002a' },
]
const OUT_LABEL: Record<Outcome, string> = { player: 'PLAYER WINS', banker: 'BANKER WINS', tie: 'TIE' }

function Hand({ title, cards, tone, win, size }: { title: string; cards: Card[]; tone: string; win: boolean; size: 'sm' | 'md' }) {
  return (
    <div className={`panel-noir rounded-xl p-3 text-center ${win ? 'ring-2 ring-[#f6e27a] shadow-[0_0_22px_rgba(246,226,122,0.35)]' : ''}`}>
      <div className="font-display text-[13px] font-bold tracking-[0.3em]" style={{ color: tone }}>{title}</div>
      <div className="mt-2 flex min-h-[108px] items-center justify-center gap-1.5">
        {cards.length === 0 ? <span className="text-[11px] tracking-[0.3em] text-white/20">—</span> : cards.map((c, i) => <PlayingCard key={`${i}-${c.rank}${c.suit}`} card={c} size={size} dealDelay={0} />)}
      </div>
      <div className="mt-1 font-display text-2xl font-black tabular-nums text-[#f6e27a]">{cards.length ? handTotal(cards) : ''}</div>
    </div>
  )
}

export default function Baccarat() {
  const { balance, payout } = useChips()
  const narrow = useNarrow()
  const st = useSpots('golden-felt-bac-bets', 'baccarat')
  const [chipVal, setChipVal] = useState(25)
  const [round, setRound] = useState<Round | null>(null)
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<Phase>('bet')
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [history, setHistory] = useState<Outcome[]>([])
  const [burst, setBurst] = useState(0)
  const shoe = useRef<Card[]>([])

  const draw = (): Card => {
    if (shoe.current.length < 20) shoe.current = newShoe()
    return shoe.current.pop() as Card
  }

  const place = (key: string) => {
    if (phase !== 'bet' || st.locked) return
    if (st.add(key, chipVal)) sfx.chip()
  }

  const deal = () => {
    if (phase !== 'bet' || st.total < 25) return
    const bets = { player: st.spots.player ?? 0, banker: st.spots.banker ?? 0, tie: st.spots.tie ?? 0 }
    st.lock()
    const r = playRound(draw)
    const seq = r.player.length + r.banker.length
    setRound(r)
    setStep(0)
    setResult(null)
    setPhase('deal')
    sfx.deal()
    for (let i = 1; i <= seq; i++) setTimeout(() => { setStep(i); sfx.flip() }, i * STEP_MS)
    // Settled on its own timer so the payout still lands if you leave the table.
    setTimeout(() => {
      const s = settleBaccarat(bets, r.outcome)
      if (s.returned > 0) payout(s.returned, s.net)
      setHistory((h) => [...h, r.outcome].slice(-42))
      setResult({
        kind: s.net > 0 ? 'win' : s.net === 0 ? 'push' : 'lose',
        title: `${OUT_LABEL[r.outcome]} · ${Math.max(r.pTotal, r.bTotal)}${r.outcome === 'tie' ? '' : ` TO ${Math.min(r.pTotal, r.bTotal)}`}`,
        detail: s.net === 0 ? 'Your bets are returned' : s.net < 0 ? 'Better luck next hand' : undefined,
        amount: s.net > 0 ? s.net : 0,
      })
      if (s.net > 0) { setBurst((b) => b + 1); sfx.win() } else if (s.net === 0) sfx.push(); else sfx.lose()
      setPhase('done')
    }, (seq + 1) * STEP_MS + 500)
  }

  const next = () => {
    st.reset()
    setPhase('bet')
    setRound(null)
    setStep(0)
    setResult(null)
    sfx.click()
    st.restore()
  }

  // Which cards are face up so far (order dealt: Player, Banker, Player, Banker, then any third cards).
  const seq: ('p' | 'b')[] = round ? ['p', 'b', 'p', 'b', ...(round.player.length === 3 ? ['p' as const] : []), ...(round.banker.length === 3 ? ['b' as const] : [])] : []
  const upP = round ? round.player.slice(0, seq.slice(0, step).filter((x) => x === 'p').length) : []
  const upB = round ? round.banker.slice(0, seq.slice(0, step).filter((x) => x === 'b').length) : []
  const finished = phase === 'done' && round
  const size = narrow ? 'sm' : 'md'

  return (
    <GameShell
      screen="baccarat"
      side={
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="panel-noir rounded-xl p-4 sm:p-5">
            <h4 className="font-display gold-text mb-3 text-sm font-bold tracking-[0.25em]">HOW TO PLAY</h4>
            <ul className="space-y-2 text-[13px] leading-relaxed text-[#cbb98a]">
              <li>Bet on which hand will finish <b>closest to 9</b>: the <b>Player</b>, the <b>Banker</b>, or a <b>Tie</b>. You do not make any decisions after that. The cards play themselves by fixed rules.</li>
              <li>Card values: <b>Ace = 1</b>, 2 to 9 are face value, <b>10, J, Q, K = 0</b>. A hand is worth the last digit of its total (7 + 8 = 15 is worth 5).</li>
              <li>Each side gets two cards. A total of <b>8 or 9 (a "natural")</b> ends the hand at once. Otherwise the Player draws on 0 to 5 and stands on 6 or 7, and the Banker follows a fixed chart.</li>
              <li><b>Player pays 1 to 1. Banker pays 1 to 1 minus a 5% commission</b> (the Banker wins a little more often). <b>Tie pays 8 to 1</b>, but it is the worst bet. If the hand ties, Player and Banker bets are returned.</li>
            </ul>
          </div>
        </div>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />

        <div className="grid grid-cols-2 gap-3">
          <Hand title="PLAYER" cards={upP} tone="#6fa0ff" size={size} win={!!finished && round!.outcome === 'player'} />
          <Hand title="BANKER" cards={upB} tone="#ff6b81" size={size} win={!!finished && round!.outcome === 'banker'} />
        </div>
        {round?.natural && step >= 4 && <p className="mt-2 text-center text-[11px] font-bold tracking-[0.4em] text-[#f6e27a]">NATURAL — NO MORE CARDS</p>}

        <div className="mt-4"><ResultStrip result={result} /></div>

        {/* Bead plate */}
        {history.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
            {history.map((h, i) => (
              <span key={i} title={OUT_LABEL[h]} className="h-3.5 w-3.5 rounded-full border border-black/40" style={{ background: h === 'player' ? '#2f6fe0' : h === 'banker' ? '#d4002a' : '#1a9a62' }} />
            ))}
          </div>
        )}

        {/* Bet areas */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {AREAS.map((a) => {
            const amt = st.spots[a.key] ?? 0
            const won = !!finished && round!.outcome === a.key
            return (
              <button
                key={a.key}
                onClick={() => place(a.key)}
                disabled={phase !== 'bet'}
                className={`min-h-[120px] rounded-xl border-2 px-2 py-2 text-center transition ${won ? 'win-glow-anim border-[#f6e27a]' : 'border-[#c9a227]/35'} bg-black/40 disabled:cursor-default`}
                style={{ boxShadow: amt ? `inset 0 0 0 1px ${a.tone}` : undefined }}
              >
                <div className="font-display text-sm font-bold tracking-[0.25em]" style={{ color: a.tone }}>{a.label}</div>
                <div className="mt-0.5 text-[9px] leading-tight tracking-wider text-[#8a7a4d]">{a.pays}</div>
                <div className="mt-1 flex min-h-[48px] items-end justify-center">{amt > 0 ? <ChipPile amount={amt} size={28} /> : <span className="pb-3 text-white/20">—</span>}</div>
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
                <button onClick={() => { const a = balance; if (a > 0 && st.add('player', a)) sfx.chip() }} disabled={balance <= 0} className="btn-ghost-gold min-h-[40px] rounded-lg px-3 text-[10px]">BET ALL</button>
                {st.total > 0 && <button onClick={() => { st.clear(); sfx.click() }} className="min-h-[44px] px-2 text-[10px] tracking-widest text-[#d4002a]">CLEAR BETS</button>}
                {st.total === 0 && st.lastTotal >= 25 && balance >= st.lastTotal && (
                  <button onClick={() => { if (st.restore()) sfx.chip() }} className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-xs">REBET {fmt(st.lastTotal)}</button>
                )}
                <button onClick={deal} disabled={st.total < 25} className="btn-gold min-h-[44px] rounded-lg px-10 py-2.5 text-sm">DEAL</button>
              </div>
              <p className="text-[11px] tracking-[0.2em] text-[#8a7a4d]">{st.carried ? 'SAME BETS AS LAST HAND · ' : ''}PICK A CHIP, THEN TAP PLAYER, TIE OR BANKER</p>
            </>
          )}
          {phase === 'deal' && <div className="text-[12px] tracking-[0.3em] text-[#8a7a4d]">DEALING…</div>}
          {phase === 'done' && <button onClick={next} className="btn-gold min-h-[48px] rounded-lg px-12 py-3 text-sm">NEXT HAND</button>}
        </div>
      </div>
    </GameShell>
  )
}
