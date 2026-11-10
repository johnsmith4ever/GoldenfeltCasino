import { useRef, useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { useSpots } from '../state/useSpots'
import { sfx } from '../lib/audio'
import { GameShell, GoldBurst } from '../components/GameShell'
import { Die } from '../components/Die'
import { ChipSelector } from '../components/Chip'
import { ResultStrip, useNarrow, type ResultInfo } from './poker/shared'
import { diceTotal, isTriple, settleSicBo, spotWin, totalPays, type Dice } from '../lib/sicbo'

const ROLL_MS = 1700
const rollOne = () => 1 + Math.floor(Math.random() * 6)

function Spot({ id, label, sub, amount, win, locked, onTap, tall = false }: { id: string; label: string; sub?: string; amount: number; win: boolean; locked: boolean; onTap: (id: string) => void; tall?: boolean }) {
  return (
    <button
      data-spot={id}
      onClick={() => onTap(id)}
      disabled={locked}
      className={`relative rounded-lg border px-1 py-1.5 text-center transition disabled:cursor-default ${tall ? 'min-h-[64px]' : 'min-h-[52px]'} ${
        win ? 'win-glow-anim border-[#f6e27a] bg-[#2a2105]' : amount > 0 ? 'border-[#f6e27a]/70 bg-[#1f1a08]' : 'border-[#c9a227]/25 bg-black/35 hover:border-[#c9a227]/60'
      }`}
    >
      <div className="text-[12px] font-bold leading-tight text-[#f2e6c9]">{label}</div>
      {sub && <div className="text-[9px] leading-tight tracking-wide text-[#8a7a4d]">{sub}</div>}
      {amount > 0 && (
        <span className="absolute -right-1 -top-2 rounded-full border border-[#f6e27a] bg-[#c9a227] px-1.5 py-px text-[10px] font-bold tabular-nums text-[#2a2105] shadow">{fmt(amount)}</span>
      )}
    </button>
  )
}

export default function SicBo() {
  const { balance, payout } = useChips()
  const narrow = useNarrow()
  const st = useSpots('golden-felt-sicbo-bets', 'sicbo')
  const [chipVal, setChipVal] = useState(25)
  const [dice, setDice] = useState<Dice>([2, 4, 5])
  const [rolling, setRolling] = useState(false)
  const [rolled, setRolled] = useState(false)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [burst, setBurst] = useState(0)
  const [recent, setRecent] = useState<Dice[]>([])
  const flicker = useRef<ReturnType<typeof setInterval> | null>(null)

  const betting = !rolling && !st.locked
  const winning = (key: string) => rolled && !rolling && spotWin(key, dice) > 0 && (st.spots[key] ?? 0) > 0

  const tap = (key: string) => {
    if (!betting) return
    if (st.add(key, chipVal)) sfx.chip()
  }

  const roll = () => {
    if (!betting || st.total < 25) return
    const bets = { ...st.spots }
    st.lock()
    const final: Dice = [rollOne(), rollOne(), rollOne()]
    setRolling(true)
    setRolled(false)
    setResult(null)
    sfx.dice()
    flicker.current = setInterval(() => setDice([rollOne(), rollOne(), rollOne()]), 110)
    // Settled on its own timer so the payout still lands if you leave the table mid-roll.
    setTimeout(() => {
      if (flicker.current) clearInterval(flicker.current)
      setDice(final)
      setRolling(false)
      setRolled(true)
      const s = settleSicBo(bets, final)
      if (s.returned > 0) payout(s.returned, s.net)
      setRecent((r) => [...r, final].slice(-10))
      const total = diceTotal(final)
      const wins = Object.keys(bets).filter((k) => spotWin(k, final) > 0).length
      setResult({
        kind: s.net > 0 ? 'win' : s.net === 0 ? 'push' : 'lose',
        title: `TOTAL ${total}${isTriple(final) ? ' · TRIPLE' : ''}`,
        detail: `${wins} of your ${Object.keys(bets).length} bet${Object.keys(bets).length > 1 ? 's' : ''} won`,
        amount: s.net > 0 ? s.net : 0,
      })
      if (s.net > 0) { setBurst((b) => b + 1); sfx.win() } else if (s.net === 0) sfx.push(); else sfx.lose()
    }, ROLL_MS)
  }

  const next = () => {
    st.reset()
    setRolled(false)
    setResult(null)
    sfx.click()
    st.restore()
  }

  const dieSize = narrow ? 56 : 72
  const spotsRows = (keys: string[], label: (k: string) => string, sub?: (k: string) => string) =>
    keys.map((k) => <Spot key={k} id={k} label={label(k)} sub={sub?.(k)} amount={st.spots[k] ?? 0} win={winning(k)} locked={!betting} onTap={tap} />)

  return (
    <GameShell
      screen="sicbo"
      side={
        <div className="panel-noir mx-auto max-w-2xl rounded-xl p-4 sm:p-5">
          <h4 className="font-display gold-text mb-3 text-sm font-bold tracking-[0.25em]">HOW TO PLAY</h4>
          <ul className="space-y-2 text-[13px] leading-relaxed text-[#cbb98a]">
            <li>Three dice are rolled. You bet on what will come up, and you can place as many bets as you like: pick a chip, then tap the bets on the board.</li>
            <li><b>Small</b> wins on a total of 4 to 10, <b>Big</b> on 11 to 17 (both pay 1 to 1). <b>A triple (all three dice the same) loses both Small and Big.</b></li>
            <li><b>Single number</b>: pays 1 to 1 if one die shows it, 2 to 1 if two do, 3 to 1 if all three do.</li>
            <li><b>Double</b> (two dice the same number) pays 10 to 1. <b>Triple</b> of a chosen number pays 180 to 1. <b>Any Triple</b> pays 30 to 1.</li>
            <li><b>Total</b>: bet on the exact sum of the dice. Rarer totals pay more (4 and 17 pay 60 to 1, 9 to 12 pay 6 to 1).</li>
          </ul>
        </div>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />

        <div className="flex items-center justify-center gap-4 py-2">
          {dice.map((v, i) => <Die key={i} value={v} size={dieSize} rolling={rolling} delay={i * 90} />)}
        </div>
        {recent.length > 0 && (
          <p className="text-center text-[11px] tracking-[0.2em] text-[#6b5f42]">RECENT TOTALS: {recent.map((d) => diceTotal(d)).join(' · ')}</p>
        )}

        <div className="mt-3"><ResultStrip result={result} /></div>

        {/* Board */}
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Spot id="small" label="SMALL" sub="4–10 · 1 TO 1" amount={st.spots.small ?? 0} win={winning('small')} locked={!betting} onTap={tap} tall />
            <Spot id="any3" label="ANY TRIPLE" sub="30 TO 1" amount={st.spots.any3 ?? 0} win={winning('any3')} locked={!betting} onTap={tap} tall />
            <Spot id="big" label="BIG" sub="11–17 · 1 TO 1" amount={st.spots.big ?? 0} win={winning('big')} locked={!betting} onTap={tap} tall />
          </div>

          <div>
            <div className="mb-1 text-[10px] tracking-[0.25em] text-[#8a7a4d]">SINGLE NUMBER · 1:1, 2:1 OR 3:1</div>
            <div className="grid grid-cols-6 gap-1.5">{spotsRows([1, 2, 3, 4, 5, 6].map((n) => `n${n}`), (k) => k.slice(1))}</div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-[0.25em] text-[#8a7a4d]">DOUBLE · 10 TO 1</div>
            <div className="grid grid-cols-6 gap-1.5">{spotsRows([1, 2, 3, 4, 5, 6].map((n) => `d${n}`), (k) => `${k.slice(1)}-${k.slice(1)}`)}</div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-[0.25em] text-[#8a7a4d]">SPECIFIC TRIPLE · 180 TO 1</div>
            <div className="grid grid-cols-6 gap-1.5">{spotsRows([1, 2, 3, 4, 5, 6].map((n) => `tr${n}`), (k) => `${k.slice(2)}-${k.slice(2)}-${k.slice(2)}`)}</div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-[0.25em] text-[#8a7a4d]">TOTAL OF THE THREE DICE</div>
            <div className="grid grid-cols-7 gap-1.5">
              {spotsRows(Array.from({ length: 14 }, (_, i) => `sum${i + 4}`), (k) => k.slice(3), (k) => `${totalPays(Number(k.slice(3)))}:1`)}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3">
          {betting && (
            <>
              <ChipSelector selected={chipVal} onSelect={setChipVal} max={balance} />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="text-[11px] tracking-[0.25em] text-[#b3a06b]">ON THE TABLE <b className="font-display text-lg text-[#f6e27a] tabular-nums">{fmt(st.total)}</b></span>
                <button onClick={() => { const a = balance; if (a > 0 && st.add('big', a)) sfx.chip() }} disabled={balance <= 0} className="btn-ghost-gold min-h-[40px] rounded-lg px-3 text-[10px]">BET ALL</button>
                {st.total > 0 && <button onClick={() => { st.clear(); sfx.click() }} className="min-h-[44px] px-2 text-[10px] tracking-widest text-[#d4002a]">CLEAR BETS</button>}
                {st.total === 0 && st.lastTotal >= 25 && balance >= st.lastTotal && (
                  <button onClick={() => { if (st.restore()) sfx.chip() }} className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-xs">REBET {fmt(st.lastTotal)}</button>
                )}
                <button onClick={roll} disabled={st.total < 25} className="btn-gold min-h-[44px] rounded-lg px-10 py-2.5 text-sm">ROLL</button>
              </div>
              <p className="text-[11px] tracking-[0.2em] text-[#8a7a4d]">{st.carried ? 'SAME BETS AS LAST ROLL · ' : ''}PICK A CHIP, THEN TAP THE BETS YOU WANT</p>
            </>
          )}
          {rolling && <div className="text-[12px] tracking-[0.3em] text-[#8a7a4d]">ROLLING…</div>}
          {rolled && !rolling && <button onClick={next} className="btn-gold min-h-[48px] rounded-lg px-12 py-3 text-sm">NEXT ROLL</button>}
        </div>
      </div>
    </GameShell>
  )
}
