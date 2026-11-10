import { useState } from 'react'
import VideoPoker from './poker/VideoPoker'
import CommunityTable from './poker/CommunityTable'
import ThreeCardPoker from './poker/ThreeCardPoker'
import StudTable from './poker/StudTable'
import { HandRankings, MiniCards, Primer, Rules, VARIANTS, type VariantId } from './poker/shared'
import { sfx } from '../lib/audio'

const STORE = 'golden-felt-poker-variant'

function loadVariant(): VariantId {
  try {
    const v = localStorage.getItem(STORE)
    if (v === 'video' || v === 'holdem' || v === 'omaha' || v === 'stud' || v === 'three') return v
  } catch { /* storage blocked */ }
  return 'holdem'
}

function ThreeCardRankings() {
  const rows: { name: string; cards: string }[] = [
    { name: 'Straight Flush', cards: '9h 8h 7h' },
    { name: 'Three of a Kind', cards: '7s 7h 7d' },
    { name: 'Straight', cards: 'Qc Kh As' },
    { name: 'Flush', cards: 'Ad 9d 4d' },
    { name: 'Pair', cards: 'Js Jh 5d' },
    { name: 'High Card', cards: 'As 9h 3d' },
  ]
  return (
    <div className="panel-noir rounded-xl p-4">
      <h4 className="font-display gold-text mb-3 text-sm font-bold tracking-[0.25em]">3-CARD HANDS, BEST TO WORST</h4>
      <ol className="grid gap-2 sm:grid-cols-2">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
            <span className="font-display w-5 text-center text-[13px] font-bold text-[#8a7a4d]">{i + 1}</span>
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#f2e6c9]">{r.name}</span>
            <MiniCards cards={r.cards} />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-[#8a7a4d]">With only 3 cards a straight is harder to make than a flush, so it ranks higher. A-2-3 is the lowest straight; Q-K-A the highest.</p>
    </div>
  )
}

export default function Poker() {
  const [variant, setVariant] = useState<VariantId>(loadVariant)

  const choose = (v: VariantId) => {
    if (v === variant) return
    sfx.click()
    setVariant(v)
    try { localStorage.setItem(STORE, v) } catch { /* storage blocked */ }
  }

  const nav = (
    <div role="tablist" aria-label="Poker games" className="mx-auto grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {VARIANTS.map((v) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={variant === v.id}
          onClick={() => choose(v.id)}
          className={`min-h-[56px] rounded-xl border px-3 py-2 text-center transition ${
            variant === v.id ? 'border-[#f6e27a] bg-[#2a2105] shadow-[0_0_14px_rgba(246,226,122,0.25)]' : 'border-[#c9a227]/30 bg-black/30 hover:border-[#c9a227]/60'
          }`}
        >
          <div className={`font-display text-[13px] font-bold tracking-[0.12em] ${variant === v.id ? 'text-[#f6e27a]' : 'text-[#cbb98a]'}`}>{v.name.toUpperCase()}</div>
          <div className="text-[10px] tracking-[0.15em] text-[#8a7a4d]">{v.blurb} · {v.how}</div>
        </button>
      ))}
    </div>
  )

  const rules = (
    <>
      <Primer />
      <Rules variant={variant} />
      {variant === 'three' ? <ThreeCardRankings /> : <HandRankings />}
    </>
  )

  if (variant === 'video') return <VideoPoker key="video" nav={nav} rules={rules} />
  if (variant === 'stud') return <StudTable key="stud" nav={nav} rules={rules} />
  if (variant === 'three') return <ThreeCardPoker key="three" nav={nav} rules={rules} />
  return <CommunityTable key={variant} variant={variant} nav={nav} rules={rules} />
}
