import { Chip, CHIP_DENOMS } from './Chip'

/** Row of chips. Tapping one calls onPick with its value (add to the bet) or selects it, depending on the game. */
export function ChipTray({ balance, onPick, selected, size = 56 }: { balance: number; onPick: (v: number) => void; selected?: number; size?: number }) {
  return (
    <div className="flex items-end justify-center gap-3">
      {CHIP_DENOMS.map((d) => (
        <Chip key={d.value} value={d.value} size={size} selected={selected === d.value} disabled={d.value > balance} onClick={() => onPick(d.value)} />
      ))}
    </div>
  )
}
