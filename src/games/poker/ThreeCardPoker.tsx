import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useChips, fmt } from '../../state/chips'
import { sfx } from '../../lib/audio'
import { freshShoe, type Card } from '../../lib/cards'
import { GameShell, GoldBurst } from '../../components/GameShell'
import { PlayingCard } from '../../components/PlayingCard'
import { Chip, CHIP_DENOMS, ChipPile } from '../../components/Chip'
import { evaluate3, dealerQualifies } from '../../lib/pokerEval'
import { ANTE_BONUS, PAIR_PLUS_PAYS, settleThreeCard } from '../../lib/threeCard'
import { ResultStrip, useNarrow, type ResultInfo } from './shared'

type Phase = 'betting' | 'decide' | 'reveal' | 'done'
type Target = 'ante' | 'pp'

const KEY = 'golden-felt-3cp-lastbets'
function loadLast(): { ante: number; pp: number } {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const ante = Number(p.ante), pp = Number(p.pp)
    return { ante: Number.isFinite(ante) && ante >= 25 ? ante : 0, pp: Number.isFinite(pp) && pp >= 0 ? pp : 0 }
  } catch { return { ante: 0, pp: 0 } }
}
function saveLast(v: { ante: number; pp: number }) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* storage blocked */ }
}

const PP_ROWS: [string, number][] = [
  ['Straight Flush', PAIR_PLUS_PAYS[5]], ['Three of a Kind', PAIR_PLUS_PAYS[4]], ['Straight', PAIR_PLUS_PAYS[3]], ['Flush', PAIR_PLUS_PAYS[2]], ['Pair', PAIR_PLUS_PAYS[1]],
]
const BONUS_ROWS: [string, number][] = [['Straight Flush', ANTE_BONUS[5]], ['Three of a Kind', ANTE_BONUS[4]], ['Straight', ANTE_BONUS[3]]]

export default function ThreeCardPoker({ nav, rules }: { nav: ReactNode; rules: ReactNode }) {
  const { balance, bet, markHand, payout, refund } = useChips()
  const narrow = useNarrow()
  const [phase, setPhase] = useState<Phase>('betting')
  const [ante, setAnte] = useState(0)
  const [pp, setPp] = useState(0)
  const [target, setTarget] = useState<Target>('ante')
  const [player, setPlayer] = useState<Card[]>([])
  const [dealer, setDealer] = useState<Card[]>([])
  const [last, setLast] = useState(loadLast)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [burst, setBurst] = useState(0)
  const [carried, setCarried] = useState(false)

  // Leaving the table before the deal gives your bets back.
  const stake = useRef({ ante: 0, pp: 0, phase: 'betting' as Phase })
  useEffect(() => { stake.current = { ante, pp, phase } }, [ante, pp, phase])
  useEffect(() => () => {
    if (stake.current.phase === 'betting' && stake.current.ante + stake.current.pp > 0) refund(stake.current.ante + stake.current.pp)
  }, [refund])

  const addChip = (v: number) => {
    if (phase !== 'betting' || v > balance) return
    if (!bet(v, false)) return
    sfx.chip()
    if (target === 'ante') setAnte((a) => a + v)
    else setPp((p) => p + v)
    setCarried(false)
  }
  const clearBets = () => {
    refund(ante + pp)
    setAnte(0)
    setPp(0)
    setCarried(false)
    sfx.click()
  }
  const betAll = () => {
    // Keep enough chips behind to make the mandatory Play bet at deal time.
    const amount = Math.floor(Math.max(0, (balance - ante) / 2))
    if (amount <= 0 || !bet(amount, false)) return
    setAnte((v) => v + amount)
    setTarget('ante')
    setCarried(false)
    sfx.chip()
  }
  const restore = () => {
    if (last.ante < 25 || balance < last.ante * 2 + last.pp) return false
    if (!bet(last.ante + last.pp, false)) return false
    setAnte(last.ante)
    setPp(last.pp)
    return true
  }

  const deal = () => {
    if (phase !== 'betting' || ante < 25) return
    if (balance < ante) return // keep enough back to make the Play bet
    const d = freshShoe(1)
    setPlayer(d.slice(0, 3))
    setDealer(d.slice(3, 6))
    setResult(null)
    setPhase('decide')
    setCarried(false)
    markHand('poker', ante + pp)
    const lb = { ante, pp }
    setLast(lb)
    saveLast(lb)
    sfx.deal()
  }

  const finish = (folded: boolean) => {
    const pe = evaluate3(player)
    const de = evaluate3(dealer)
    const s = settleThreeCard({ ante, pairPlus: pp, folded, player: pe, dealer: de })
    if (s.returned > 0) payout(s.returned, s.net)
    const parts: string[] = []
    let title: string
    if (s.outcome === 'fold') { title = 'YOU FOLDED'; parts.push(`Dealer had ${de.label}`) }
    else if (s.outcome === 'noqual') { title = 'DEALER DOES NOT QUALIFY'; parts.push('Ante pays 1 to 1, Play bet returned') }
    else if (s.outcome === 'win') { title = 'YOU WIN'; parts.push(`${pe.label} beats ${de.label}`) }
    else if (s.outcome === 'push') { title = 'PUSH'; parts.push(`Both have ${pe.label}`) }
    else { title = 'DEALER WINS'; parts.push(`${de.label} beats ${pe.label}`) }
    if (s.anteBonus > 0) parts.push(`Ante Bonus +${fmt(s.anteBonus)}`)
    if (s.pairPlusWin > 0) parts.push(`Pair Plus +${fmt(s.pairPlusWin)}`)
    else if (pp > 0) parts.push('Pair Plus lost')
    setResult({ kind: s.net > 0 ? 'win' : s.net === 0 ? 'push' : 'lose', title, detail: parts.join(' · '), amount: s.net > 0 ? s.net : 0 })
    if (s.net > 0) { setBurst((b) => b + 1); sfx.win() } else if (s.net === 0) sfx.push(); else sfx.lose()
    setPhase('done')
  }

  const decide = (play: boolean) => {
    if (phase !== 'decide') return
    if (play && !bet(ante, false)) return
    sfx.chip()
    setPhase('reveal')
    // Settles even if you navigate away during the reveal, so winnings are never lost.
    setTimeout(() => finish(!play), 1100)
  }

  const newHand = () => {
    setPhase('betting')
    setPlayer([])
    setDealer([])
    setResult(null)
    setAnte(0)
    setPp(0)
    sfx.click()
    // Keep the same bets as last hand, ready to go.
    if (restore()) setCarried(true)
  }

  const rebet = () => { if (restore()) { sfx.chip(); setCarried(true) } }

  const pe = player.length === 3 ? evaluate3(player) : null
  const showDealer = phase === 'reveal' || phase === 'done'
  const size = narrow ? 'md' : 'lg'
  const pairPlusPays = pe ? PAIR_PLUS_PAYS[pe.cat] : undefined
  const restorable = last.ante >= 25 && balance >= last.ante * 2 + last.pp

  return (
    <GameShell
      screen="poker"
      title="Three Card Poker"
      tagline="Beat the dealer · three cards · quick rounds"
      top={nav}
      side={
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="font-display text-center text-xs font-bold tracking-[0.3em] text-[#b3a06b]">PAIR PLUS (SIDE BET)</h3>
              <div className="panel-noir mt-2 rounded-lg px-5 py-3">
                {PP_ROWS.map(([n, m]) => (
                  <div key={n} className="flex justify-between py-0.5 text-[12px] text-[#a89872]"><span>{n}</span><span className="font-display font-bold tabular-nums text-[#f6e27a]">{m} to 1</span></div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-display text-center text-xs font-bold tracking-[0.3em] text-[#b3a06b]">ANTE BONUS (IF YOU PLAY)</h3>
              <div className="panel-noir mt-2 rounded-lg px-5 py-3">
                {BONUS_ROWS.map(([n, m]) => (
                  <div key={n} className="flex justify-between py-0.5 text-[12px] text-[#a89872]"><span>{n}</span><span className="font-display font-bold tabular-nums text-[#f6e27a]">{m} to 1</span></div>
                ))}
              </div>
            </div>
          </div>
          {rules}
        </div>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />

        {/* Dealer */}
        <div className="text-center text-[10px] font-bold tracking-[0.4em] text-[#b3a06b]">DEALER</div>
        <div className="flex min-h-[124px] items-center justify-center gap-2 py-3 sm:gap-3">
          {dealer.length === 0 ? (
            <span className="text-xs tracking-[0.35em] text-white/25">DEALER NEEDS QUEEN-HIGH TO QUALIFY</span>
          ) : (
            dealer.map((c, i) => <PlayingCard key={`d-${c.rank}${c.suit}`} card={c} hidden={!showDealer} size={size} dealDelay={i * 100} />)
          )}
        </div>
        {showDealer && dealer.length === 3 && (
          <p className="text-center text-[13px] text-[#e8dcb8]">
            Dealer has <b className="text-[#f6e27a]">{evaluate3(dealer).label}</b> — {dealerQualifies(evaluate3(dealer)) ? 'qualifies' : 'does not qualify'}
          </p>
        )}

        <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#c9a227]/30 to-transparent" />

        {/* Player */}
        <div className="flex min-h-[124px] items-center justify-center gap-2 py-2 sm:gap-3">
          {player.length === 0 ? (
            <span className="text-xs tracking-[0.35em] text-white/25">PLACE YOUR ANTE</span>
          ) : (
            player.map((c, i) => <PlayingCard key={`p-${c.rank}${c.suit}`} card={c} size={size} dealDelay={i * 100} />)
          )}
        </div>
        <div className="text-center text-[10px] font-bold tracking-[0.4em] text-[#b3a06b]">YOU</div>
        {pe && phase !== 'betting' && (
          <p className="mt-1 text-center text-[13px] text-[#e8dcb8]">
            You have: <b className="text-[#f6e27a]">{pe.label}</b>
            {phase === 'decide' && pairPlusPays && pp > 0 && <span className="text-[#a89872]"> — Pair Plus pays {pairPlusPays} to 1</span>}
          </p>
        )}

        <div className="mt-4"><ResultStrip result={result} /></div>

        {/* Bets */}
        <div className="mx-auto mt-4 grid max-w-xl grid-cols-2 gap-3">
          {(['ante', 'pp'] as Target[]).map((t) => {
            const amt = t === 'ante' ? ante : pp
            const sel = phase === 'betting' && target === t
            return (
              <button
                key={t}
                onClick={() => { if (phase === 'betting') { sfx.click(); setTarget(t) } }}
                className={`min-h-[96px] rounded-xl border px-3 py-2 text-center transition ${
                  sel ? 'border-[#f6e27a] bg-[#2a2105]/70 shadow-[0_0_14px_rgba(246,226,122,0.25)]' : 'border-[#c9a227]/30 bg-black/30'
                }`}
              >
                <div className="text-[10px] font-bold tracking-[0.3em] text-[#b3a06b]">{t === 'ante' ? 'ANTE' : 'PAIR PLUS'}</div>
                <div className="mt-1 flex min-h-[52px] items-end justify-center">
                  {amt > 0 ? <ChipPile amount={amt} size={30} /> : <span className="pb-3 text-white/25">{t === 'pp' ? 'optional' : '—'}</span>}
                </div>
                <div className="font-display text-sm font-bold tabular-nums text-[#f6e27a]">{amt > 0 ? fmt(amt) : ''}</div>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex min-h-[110px] flex-col items-center justify-center gap-3">
          {phase === 'betting' && (
            <>
              <p className="text-[11px] tracking-[0.2em] text-[#8a7a4d]">
                {carried ? 'SAME BETS AS LAST HAND · ' : ''}TAP CHIPS TO ADD TO: <b className="text-[#f6e27a]">{target === 'ante' ? 'ANTE' : 'PAIR PLUS'}</b>
              </p>
              <div className="flex items-end justify-center gap-3">
                {CHIP_DENOMS.map((d) => (
                  <Chip key={d.value} value={d.value} size={narrow ? 50 : 58} disabled={d.value > balance} onClick={() => addChip(d.value)} />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={betAll} disabled={balance <= ante} className="btn-ghost-gold min-h-[40px] rounded-lg px-3 text-[10px]">BET ALL</button>
                {ante + pp > 0 && (
                  <button onClick={clearBets} className="min-h-[44px] px-2 text-[10px] tracking-widest text-[#d4002a] hover:text-[#ff5470]">CLEAR</button>
                )}
                {ante + pp === 0 && restorable && (
                  <button onClick={rebet} className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-xs">
                    REBET {fmt(last.ante)}{last.pp ? ` + ${fmt(last.pp)}` : ''}
                  </button>
                )}
                <button onClick={deal} disabled={ante < 25 || balance < ante} className="btn-gold min-h-[44px] rounded-lg px-10 py-2.5 text-sm">DEAL</button>
              </div>
              {ante >= 25 && balance < ante && (
                <p className="text-center text-[12px] text-[#ff97a3]">Keep at least {fmt(ante)} chips back so you can place the Play bet.</p>
              )}
            </>
          )}
          {phase === 'decide' && (
            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              <button onClick={() => decide(false)} className="btn-crimson min-h-[48px] rounded-lg py-3 text-sm">FOLD</button>
              <button onClick={() => decide(true)} disabled={balance < ante} className="btn-gold min-h-[48px] rounded-lg py-3 text-sm">PLAY {fmt(ante)}</button>
            </div>
          )}
          {phase === 'reveal' && <div className="text-[12px] tracking-[0.3em] text-[#8a7a4d]">DEALER TURNS OVER…</div>}
          {phase === 'done' && (
            <button onClick={newHand} className="btn-gold min-h-[48px] rounded-lg px-12 py-3 text-sm">NEW HAND</button>
          )}
        </div>
      </div>
    </GameShell>
  )
}
