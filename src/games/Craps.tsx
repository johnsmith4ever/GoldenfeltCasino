import { useEffect, useRef, useState } from 'react'
import { useChips } from '../state/chips'
import { sfx } from '../lib/audio'
import { GameShell, ResultBanner, GoldBurst } from '../components/GameShell'
import { ChipSelector, BetStack } from '../components/Chip'
import { Die } from '../components/Die'

interface RollLog { d1: number; d2: number; note: string }

export default function Craps() {
  const { balance, bet, markHand, payout, refund } = useChips()
  const [chipVal, setChipVal] = useState(25)
  const [passBet, setPassBet] = useState(0)
  const [fieldBet, setFieldBet] = useState(0)
  const [point, setPoint] = useState<number | null>(null)
  const [dice, setDice] = useState<[number, number]>([3, 4])
  const [rolling, setRolling] = useState(false)
  const [log, setLog] = useState<RollLog[]>([])
  const [result, setResult] = useState<{ kind: 'win' | 'lose' | 'push'; title: string; detail?: string; amount?: number } | null>(null)
  const [burst, setBurst] = useState(0)
  const busyRef = useRef(false)

  const addPass = () => {
    if (point !== null || rolling || chipVal > balance) return
    if (!bet(chipVal, false)) return
    sfx.chip()
    setResult(null)
    setPassBet((b) => b + chipVal)
  }

  const addField = () => {
    if (rolling || chipVal > balance) return
    if (!bet(chipVal, false)) return
    sfx.chip()
    setResult(null)
    setFieldBet((b) => b + chipVal)
  }

  const betAll = () => {
    if (rolling || balance <= 0) return
    const amount = balance
    const target = point === null ? 'pass' : 'field'
    if (!bet(amount, false)) return
    sfx.chip()
    setResult(null)
    if (target === 'pass') {
      setPassBet((b) => b + amount)
    } else {
      setFieldBet((b) => b + amount)
    }
  }

  // CLEAR takes your chips back AND dismisses the last result. Once a point is set the pass line stays locked,
  // but the one-roll Field bet can still come down.
  const clearBets = () => {
    if (rolling) return
    setResult(null)
    sfx.click()
    const back = (point === null ? passBet : 0) + fieldBet
    if (back > 0) refund(back)
    if (point === null) setPassBet(0)
    setFieldBet(0)
  }

  // Leaving the table before the dice are thrown gives your chips back.
  const resting = useRef({ pass: 0, field: 0, open: true })
  useEffect(() => { resting.current = { pass: passBet, field: fieldBet, open: point === null && !rolling } }, [passBet, fieldBet, point, rolling])
  useEffect(() => () => {
    const r = resting.current
    if (r.open && r.pass + r.field > 0) refund(r.pass + r.field)
  }, [refund])

  const roll = () => {
    if (rolling || busyRef.current) return
    if (passBet + fieldBet < 25) return
    busyRef.current = true
    setRolling(true)
    setResult(null)
    markHand('craps', passBet + fieldBet)
    sfx.dice()

    const d1 = 1 + Math.floor(Math.random() * 6)
    const d2 = 1 + Math.floor(Math.random() * 6)
    const total = d1 + d2

    // cycle random faces during tumble for flavor
    const flicker = setInterval(() => {
      setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])
    }, 120)

    setTimeout(() => {
      clearInterval(flicker)
      setDice([d1, d2])
      setRolling(false)

      let note = ''
      let newPoint = point
      let newPass = passBet
      let fieldNote = ''

      // Field — one roll
      if (fieldBet > 0) {
        const fieldWins: Record<number, number> = { 2: 2, 3: 1, 4: 1, 9: 1, 10: 1, 11: 1, 12: 2 }
        const m = fieldWins[total]
        if (m) {
          payout(fieldBet * (m + 1), fieldBet * m)
          fieldNote = `Field pays ${m === 2 ? '2:1' : '1:1'}`
          sfx.coin()
        } else {
          fieldNote = 'Field loses'
        }
        setFieldBet(0)
      }

      // Pass line
      if (passBet > 0) {
        if (point === null) {
          if (total === 7 || total === 11) {
            payout(passBet * 2, passBet)
            setBurst((b) => b + 1)
            sfx.win()
            note = total === 7 ? 'Natural seven — pass line wins!' : 'Yo-leven — pass line wins!'
            newPass = 0
            setResult({ kind: 'win', title: 'PASS LINE WINS', detail: `${total} on the come-out`, amount: passBet })
          } else if (total === 2 || total === 3 || total === 12) {
            sfx.lose()
            note = `Craps ${total} — pass line loses`
            newPass = 0
            setResult({ kind: 'lose', title: 'CRAPS OUT', detail: `${total} on the come-out` })
          } else {
            newPoint = total
            note = `The point is ${total}`
            sfx.push()
          }
        } else {
          if (total === point) {
            payout(passBet * 2, passBet)
            setBurst((b) => b + 1)
            sfx.win()
            note = `Hit the point ${total} — pass line wins!`
            newPass = 0
            newPoint = null
            setResult({ kind: 'win', title: 'POINT MADE', detail: `${total} before seven`, amount: passBet })
          } else if (total === 7) {
            sfx.lose()
            note = 'Seven out — pass line loses'
            newPass = 0
            newPoint = null
            setResult({ kind: 'lose', title: 'SEVEN OUT', detail: 'The dice pass to the next shooter' })
          } else {
            note = `Rolled ${total} — still chasing ${point}`
          }
        }
      } else if (fieldNote) {
        note = fieldNote
        fieldNote = ''
        if (fieldWinsNote(total)) {
          // handled above via payout; just display
        }
      }

      if (fieldNote && note) note = `${note} · ${fieldNote}`
      else if (fieldNote) note = fieldNote

      function fieldWinsNote(t: number) { return [2, 3, 4, 9, 10, 11, 12].includes(t) }

      setLog((l) => [{ d1, d2, note }, ...l].slice(0, 6))
      setPoint(newPoint)
      setPassBet(newPass)
      busyRef.current = false
    }, 950)
  }

  const ON_NUMBERS = [4, 5, 6, 8, 9, 10]

  return (
    <GameShell
      screen="craps"
      side={
        <p className="text-center text-[11px] tracking-[0.25em] text-[#8a7a4d]">
          PASS LINE: 7/11 WINS ON COME-OUT · FIELD: 2 &amp; 12 PAY 2:1, 3-4-9-10-11 PAY 1:1
        </p>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />
        <ResultBanner result={result} />

        {/* Point tracker */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="text-[10px] tracking-[0.35em] text-[#b3a06b]">POINT</span>
          {ON_NUMBERS.map((n) => (
            <span
              key={n}
              className={`flex h-9 w-9 items-center justify-center rounded-full border font-display text-sm font-bold transition-all ${
                point === n
                  ? 'border-[#f6e27a] bg-[#f6e27a] text-[#1a1405] shadow-[0_0_14px_rgba(246,226,122,0.7)]'
                  : 'border-[#c9a227]/25 bg-black/40 text-[#8a7a4d]'
              }`}
            >
              {n}
            </span>
          ))}
          <span
            className={`ml-2 rounded-full border px-3 py-1 font-display text-[10px] font-bold tracking-[0.2em] ${
              point === null ? 'border-[#f6e27a]/70 text-[#f6e27a]' : 'border-white/15 text-white/25'
            }`}
          >
            {point === null ? 'COME-OUT' : 'ON'}
          </span>
        </div>

        {/* Dice area */}
        <div className="mx-auto flex min-h-[140px] max-w-md items-center justify-center gap-6 rounded-xl border border-[#c9a227]/30 bg-black/40 py-8">
          <Die value={dice[0]} rolling={rolling} />
          <div className="text-center">
            <div className="font-display text-3xl font-black text-[#f6e27a] tabular-nums">{dice[0] + dice[1]}</div>
            <div className="text-[9px] tracking-[0.3em] text-[#8a7a4d]">TOTAL</div>
          </div>
          <Die value={dice[1]} rolling={rolling} delay={60} />
        </div>

        {/* Betting spots */}
        <div className="mx-auto mt-5 grid max-w-2xl grid-cols-2 gap-3">
          <button
            onClick={addPass}
            disabled={point !== null || rolling || chipVal > balance}
            className="bet-spot relative flex h-20 flex-col items-center justify-center rounded-lg border-2 border-[#c9a227]/50 bg-black/45"
          >
            <span className="font-display text-sm font-bold tracking-[0.2em] text-[#f2e6c9]">PASS LINE</span>
            <span className="mt-0.5 text-[10px] tracking-widest text-[#8a7a4d]">PAYS 1:1</span>
            {passBet > 0 && (
              <span className="chip-place-anim absolute -top-3 right-2"><BetStack amount={passBet} size={36} /></span>
            )}
          </button>
          <button
            onClick={addField}
            disabled={rolling || chipVal > balance}
            className="bet-spot relative flex h-20 flex-col items-center justify-center rounded-lg border-2 border-[#c9a227]/50 bg-black/45"
          >
            <span className="font-display text-sm font-bold tracking-[0.2em] text-[#f2e6c9]">FIELD</span>
            <span className="mt-0.5 text-[10px] tracking-widest text-[#8a7a4d]">2·3·4·9·10·11·12 — ONE ROLL</span>
            {fieldBet > 0 && (
              <span className="chip-place-anim absolute -top-3 right-2"><BetStack amount={fieldBet} size={36} /></span>
            )}
          </button>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <ChipSelector selected={chipVal} onSelect={setChipVal} max={balance} />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={betAll} disabled={rolling || balance <= 0} className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-[10px]">BET ALL</button>
            <button
              onClick={clearBets}
              disabled={rolling || (passBet + fieldBet === 0 && !result) || (point !== null && fieldBet === 0 && !result)}
              className="btn-ghost-gold min-h-[44px] rounded-lg px-4 py-2 text-xs"
            >
              CLEAR
            </button>
            <button onClick={roll} disabled={rolling || passBet + fieldBet < 25} className="btn-gold rounded-lg px-12 py-3 text-sm">
              {rolling ? 'ROLLING…' : point !== null ? `ROLL FOR ${point}` : 'ROLL'}
            </button>
          </div>
          {point !== null && (
            <p className="text-[11px] tracking-[0.2em] text-[#b3a06b]">PASS LINE LOCKED — ROLL {point} BEFORE 7</p>
          )}
        </div>

        {/* Roll log */}
        {log.length > 0 && (
          <div className="mx-auto mt-6 max-w-md">
            <div className="divider-gold mb-3" />
            <div className="space-y-1.5">
              {log.map((r, i) => (
                <div key={i} className="flex items-center justify-center gap-3 text-[12px]" style={{ opacity: 1 - i * 0.16 }}>
                  <span className="font-display font-bold text-[#f6e27a] tabular-nums">{r.d1} + {r.d2} = {r.d1 + r.d2}</span>
                  <span className="text-[#a89872]">{r.note}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GameShell>
  )
}
