import { useEffect, useMemo, useRef, useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { useSpots } from '../state/useSpots'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { ChipTray } from '../components/ChipTray'
import { ChipPile } from '../components/Chip'
import { ResultStrip, useNarrow, type ResultInfo } from './poker/shared'
import { DRAWN, MAX_PICKS, PAYTABLE, POOL, drawNumbers, hitProbability, hitRate, payMultiplier, quickPick, returnToPlayer } from '../lib/keno'

const PICKS_KEY = 'golden-felt-keno-picks'
type Phase = 'pick' | 'drawing' | 'done'
const DRAW_MS = 170

function loadPicks(): number[] {
  try {
    const p = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]')
    if (Array.isArray(p)) return [...new Set<number>(p.filter((n) => Number.isInteger(n) && n >= 1 && n <= POOL))].slice(0, MAX_PICKS)
  } catch { /* ignore */ }
  return []
}

export default function Keno() {
  const { balance, payout } = useChips()
  const narrow = useNarrow()
  const st = useSpots('golden-felt-keno-bet', 'keno')
  const [picks, setPicksState] = useState<number[]>(loadPicks)
  const [phase, setPhase] = useState<Phase>('pick')
  const [drawn, setDrawn] = useState<number[]>([])
  const [shown, setShown] = useState(0)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [burst, setBurst] = useState(0)
  const [hits, setHits] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setPicks = (next: number[]) => {
    setPicksState(next)
    try { localStorage.setItem(PICKS_KEY, JSON.stringify(next)) } catch { /* storage blocked */ }
  }
  const stake = st.total
  const revealed = useMemo(() => new Set(drawn.slice(0, shown)), [drawn, shown])
  const pickSet = useMemo(() => new Set(picks), [picks])
  const liveHits = picks.filter((p) => revealed.has(p)).length

  const toggle = (n: number) => {
    if (phase !== 'pick') return
    sfx.click()
    if (pickSet.has(n)) setPicks(picks.filter((p) => p !== n))
    else if (picks.length < MAX_PICKS) setPicks([...picks, n].sort((a, b) => a - b))
  }

  // Reveal the 20 numbers one at a time.
  useEffect(() => {
    if (phase !== 'drawing' || shown >= DRAWN) return
    timer.current = setTimeout(() => { setShown((s) => s + 1); sfx.tick() }, DRAW_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [phase, shown])

  const draw = () => {
    if (phase !== 'pick' || picks.length === 0 || stake < 25) return
    st.lock()
    const numbers = drawNumbers()
    const h = picks.filter((p) => numbers.includes(p)).length
    const mult = payMultiplier(picks.length, h)
    const win = Math.floor(stake * mult + 1e-9)
    setDrawn(numbers)
    setShown(0)
    setHits(h)
    setResult(null)
    setPhase('drawing')
    sfx.deal()
    // Settled on a timer of its own, so the payout lands even if you leave mid-draw.
    setTimeout(() => {
      if (win > 0) payout(win, win - stake)
      if (win > 0) { setBurst((b) => b + 1); if (mult >= 50) sfx.bigWin(); else sfx.win() } else sfx.lose()
      setResult(win > 0
        ? { kind: win > stake ? 'win' : 'push', title: `${h} OF ${picks.length} HIT`, detail: `Pays ${mult}×`, amount: win > stake ? win - stake : 0 }
        : { kind: 'lose', title: `${h} OF ${picks.length} HIT`, detail: 'No payout this time' })
      setPhase('done')
    }, DRAWN * DRAW_MS + 700)
  }

  const next = () => {
    st.reset()
    setPhase('pick')
    setDrawn([])
    setShown(0)
    setResult(null)
    sfx.click()
    st.restore()
  }

  const n = picks.length
  const rows = n > 0 ? Object.entries(PAYTABLE[n]).map(([h, m]) => ({ hits: Number(h), mult: m, odds: 1 / hitProbability(n, Number(h)) })) : []
  const cols = narrow ? 8 : 10

  return (
    <GameShell
      screen="keno"
      side={
        <div className="panel-noir mx-auto max-w-2xl rounded-xl p-4 sm:p-5">
          <h4 className="font-display gold-text mb-3 text-sm font-bold tracking-[0.25em]">HOW TO PLAY</h4>
          <ul className="space-y-2 text-[13px] leading-relaxed text-[#cbb98a]">
            <li>Pick <b>1 to 10 numbers</b> from the board (1 to 80), or use Quick Pick.</li>
            <li>Place your bet and press <b>DRAW</b>. The game draws <b>20 numbers</b> out of the 80.</li>
            <li>The more of your numbers are drawn, the more you win. The paytable on the right shows exactly what each result pays for the numbers you picked.</li>
            <li>Picking fewer numbers wins more often but pays less. Picking 10 is a long shot with a huge prize (the biggest payout is capped at 5,000 to 1).</li>
          </ul>
        </div>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />

        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          {/* Board */}
          <div>
            <div className="mb-2 flex items-center justify-between text-[11px] tracking-[0.25em] text-[#b3a06b]">
              <span>PICKED {n}/{MAX_PICKS}</span>
              <span>{phase === 'pick' ? 'TAP NUMBERS TO PICK' : `DRAWN ${shown}/${DRAWN} · HITS ${liveHits}`}</span>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {Array.from({ length: POOL }, (_, i) => i + 1).map((num) => {
                const picked = pickSet.has(num)
                const out = revealed.has(num)
                const hit = picked && out
                return (
                  <button
                    key={num}
                    onClick={() => toggle(num)}
                    aria-pressed={picked}
                    className={`aspect-square min-h-[34px] rounded-md border text-[12px] font-bold tabular-nums transition ${
                      hit
                        ? 'win-glow-anim border-[#f6e27a] bg-[#f6e27a] text-[#2a2105]'
                        : picked
                          ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                          : out
                            ? 'border-[#8a1020] bg-[#5c0f14] text-[#ff97a3]'
                            : 'border-[#c9a227]/25 bg-black/35 text-[#cbb98a] hover:border-[#c9a227]/70'
                    }`}
                  >
                    {num}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {[3, 5, 8, 10].map((q) => (
                <button key={q} disabled={phase !== 'pick'} onClick={() => { sfx.click(); setPicks(quickPick(q)) }} className="btn-ghost-gold min-h-[40px] rounded-lg px-3 py-1.5 text-[11px]">
                  QUICK PICK {q}
                </button>
              ))}
              <button disabled={phase !== 'pick' || n === 0} onClick={() => { sfx.click(); setPicks([]) }} className="min-h-[40px] px-2 text-[10px] tracking-widest text-[#d4002a] disabled:opacity-40">CLEAR PICKS</button>
            </div>
          </div>

          {/* Paytable */}
          <div className="panel-noir h-fit rounded-xl p-3">
            <div className="font-display text-center text-[11px] font-bold tracking-[0.3em] text-[#b3a06b]">{n > 0 ? `PAYS FOR ${n} PICK${n > 1 ? 'S' : ''}` : 'PAYTABLE'}</div>
            {n === 0 ? (
              <p className="mt-3 text-center text-[12px] text-[#8a7a4d]">Pick some numbers to see what they pay.</p>
            ) : (
              <>
                <table className="mt-2 w-full text-[12px]">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.hits} className={`border-b border-[#c9a227]/10 last:border-0 ${phase === 'done' && hits === r.hits ? 'win-glow-anim font-bold text-[#f6e27a]' : 'text-[#cbb98a]'}`}>
                        <td className="py-1">{r.hits} hit{r.hits > 1 ? 's' : ''}</td>
                        <td className="text-right font-display font-bold text-[#f6e27a]">{r.mult}×</td>
                        <td className="pl-2 text-right text-[10px] text-[#6b5f42]">1 in {r.odds >= 100 ? Math.round(r.odds).toLocaleString() : r.odds.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-center text-[10px] leading-snug text-[#6b5f42]">Wins {(hitRate(n) * 100).toFixed(0)}% of tickets · returns about {(returnToPlayer(n) * 100).toFixed(0)}%</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-4"><ResultStrip result={result} /></div>

        <div className="mt-4 flex flex-col items-center gap-3">
          {phase === 'pick' && (
            <>
              <ChipTray balance={balance} onPick={(v) => { if (st.add('main', v)) sfx.chip() }} size={narrow ? 50 : 56} />
              <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="flex items-center gap-3 text-sm text-[#b3a06b]">
                  <span className="text-[10px] tracking-[0.3em]">BET</span>
                  {stake > 0 ? <ChipPile amount={stake} /> : <span className="text-white/30">—</span>}
                  {stake > 0 && <span className="font-display text-lg font-bold tabular-nums text-[#f6e27a]">{fmt(stake)}</span>}
                  <button onClick={() => { const a = balance; if (a > 0 && st.add('main', a)) sfx.chip() }} disabled={balance <= 0} className="btn-ghost-gold min-h-[40px] rounded-lg px-3 text-[10px]">BET ALL</button>
                  {stake > 0 && <button onClick={() => { st.clear(); sfx.click() }} className="min-h-[44px] px-2 text-[10px] tracking-widest text-[#d4002a]">CLEAR</button>}
                  {stake === 0 && st.lastTotal >= 25 && balance >= st.lastTotal && (
                    <button onClick={() => { if (st.restore()) sfx.chip() }} className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-xs">REBET {fmt(st.lastTotal)}</button>
                  )}
                </div>
                <button onClick={draw} disabled={n === 0 || stake < 25} className="btn-gold min-h-[44px] rounded-lg px-10 py-2.5 text-sm">DRAW</button>
              </div>
              <p className="text-[11px] tracking-[0.2em] text-[#8a7a4d]">{st.carried ? 'SAME BET AS LAST TICKET · ' : ''}{n === 0 ? 'PICK AT LEAST ONE NUMBER' : 'TAP CHIPS TO BET · MINIMUM 25'}</p>
            </>
          )}
          {phase === 'drawing' && <div className="text-[12px] tracking-[0.3em] text-[#8a7a4d]">DRAWING…</div>}
          {phase === 'done' && <button onClick={next} className="btn-gold min-h-[48px] rounded-lg px-12 py-3 text-sm">NEW TICKET (SAME NUMBERS)</button>}
        </div>
      </div>
    </GameShell>
  )
}
