import { useState, useEffect, useMemo } from 'react'
import { PROPERTY_DEFS, type PropertyId, fmt } from '../state/chips'
import { sfx } from '../lib/audio'
import { Sparkles, Coins, Zap, Eye, RotateCw } from 'lucide-react'

interface PropertyState {
  level: number
  lastCollectedAt: number
}

interface PropertyShowcase3DProps {
  properties: Record<PropertyId, PropertyState>
  pendingAmounts: Record<PropertyId, number>
  balance: number
  onCollect: (id: PropertyId) => void
  onUpgrade: (id: PropertyId) => void
  now: number
}

// 3D Isometric architectural models / icons for each property
const ISOMETRIC_BUILDINGS: Record<PropertyId, {
  emoji: string
  roofColor: string
  wallColor: string
  accentColor: string
  glowColor: string
  label: string
  subtext: string
}> = {
  apartment: {
    emoji: '🏢',
    roofColor: '#3b82f6',
    wallColor: '#1e3a8a',
    accentColor: '#60a5fa',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    label: 'Studio Units',
    subtext: 'Downtown District',
  },
  lounge: {
    emoji: '🏙️',
    roofColor: '#8b5cf6',
    wallColor: '#4c1d95',
    accentColor: '#c084fc',
    glowColor: 'rgba(139, 92, 246, 0.45)',
    label: 'Skyline Tower',
    subtext: 'Billionaire Penthouse',
  },
  bar: {
    emoji: '🍸',
    roofColor: '#f43f5e',
    wallColor: '#881337',
    accentColor: '#fb7185',
    glowColor: 'rgba(244, 63, 94, 0.45)',
    label: 'Neon Lounge',
    subtext: 'Vegas Strip',
  },
  mall: {
    emoji: '🛍️',
    roofColor: '#f59e0b',
    wallColor: '#78350f',
    accentColor: '#fcd34d',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    label: 'Grand Atrium',
    subtext: 'Galleria District',
  },
  hotel: {
    emoji: '🏨',
    roofColor: '#eab308',
    wallColor: '#713f12',
    accentColor: '#fef08a',
    glowColor: 'rgba(234, 179, 8, 0.5)',
    label: 'Palace Resort',
    subtext: '5-Star Goldenfelt',
  },
  marina: {
    emoji: '🛥️',
    roofColor: '#06b6d4',
    wallColor: '#164e63',
    accentColor: '#67e8f9',
    glowColor: 'rgba(6, 182, 212, 0.5)',
    label: 'Mega Harbor',
    subtext: 'Superyacht Basin',
  },
  island: {
    emoji: '🏝️',
    roofColor: '#10b981',
    wallColor: '#064e3b',
    accentColor: '#6ee7b7',
    glowColor: 'rgba(16, 185, 129, 0.5)',
    label: 'Private Atoll',
    subtext: 'Caribbean Sanctuary',
  },
  airport: {
    emoji: '✈️',
    roofColor: '#ec4899',
    wallColor: '#831843',
    accentColor: '#f472b6',
    glowColor: 'rgba(236, 72, 153, 0.55)',
    label: 'International Hub',
    subtext: 'Private Jet Terminal',
  },
}

export function PropertyShowcase3D({
  properties,
  pendingAmounts,
  balance,
  onCollect,
  onUpgrade,
  now,
}: PropertyShowcase3DProps) {
  const [selectedSlot, setSelectedSlot] = useState<PropertyId | null>('apartment')
  const [viewMode, setViewMode] = useState<'isometric' | 'front'>('isometric')
  const [tickEffect, setTickEffect] = useState(0)

  // Trigger visual money pulse every second
  useEffect(() => {
    setTickEffect((e) => (e + 1) % 2)
  }, [now])

  const selectedDef = useMemo(() => {
    if (!selectedSlot) return null
    return PROPERTY_DEFS.find((p) => p.id === selectedSlot)
  }, [selectedSlot])

  const selectedState = selectedSlot ? properties[selectedSlot] : null
  const selectedPending = selectedSlot ? pendingAmounts[selectedSlot] ?? 0 : 0
  const selectedCost = selectedDef
    ? Math.round(selectedDef.price * Math.pow(1.7, selectedState?.level ?? 0))
    : 0

  return (
    <div className="relative mb-12 overflow-hidden rounded-3xl border-2 border-[#c9a227]/50 bg-gradient-to-b from-[#0e0c10] via-[#141018] to-[#070608] p-5 shadow-[0_0_50px_rgba(0,0,0,0.85)] sm:p-8">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#c9a227]/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-72 w-72 rounded-full bg-[#10b981]/10 blur-3xl" />

      {/* Header Controls */}
      <div className="relative mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#c9a227]/25 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-gradient-to-r from-[#d97706] to-[#f59e0b] px-2.5 py-0.5 text-[9px] font-black tracking-[0.25em] text-[#140b02]">
              3D ESTATE DISTRICT
            </span>
            <span className="text-[10px] tracking-[0.3em] text-[#86efac] flex items-center gap-1 font-bold">
              <Zap size={11} className="animate-pulse" /> LIVE MONEY ANIMATION ACTIVE
            </span>
          </div>
          <h2 className="font-display gold-text mt-1 text-2xl font-black tracking-[0.14em] sm:text-3xl">
            8-BLOCK ESTATE SHOWCASE
          </h2>
          <p className="text-[12px] text-[#a89872]">
            Interactive 3D blocks · Floating cash yield surges every second · Click any block to inspect
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'isometric' ? 'front' : 'isometric')}
            className="btn-ghost-gold flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold"
          >
            <RotateCw size={12} />
            <span>{viewMode === 'isometric' ? 'PERSPECTIVE: 3D ISOMETRIC' : 'PERSPECTIVE: FRONT ELEVATION'}</span>
          </button>
        </div>
      </div>

      {/* 3D 8-BLOCK SHOW AREA */}
      <div
        className={`relative mx-auto my-6 max-w-5xl rounded-2xl border border-[#c9a227]/30 bg-gradient-to-b from-[#18151c] to-[#09080c] p-6 shadow-2xl transition-all duration-700 ${
          viewMode === 'isometric'
            ? '[transform:perspective(1200px)_rotateX(22deg)]'
            : '[transform:perspective(1200px)_rotateX(0deg)]'
        }`}
      >
        {/* Foundation Grid Underlay */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(#c9a227_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

        {/* 8 Blocks Grid: 4 columns x 2 rows */}
        <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {PROPERTY_DEFS.map((prop, idx) => {
            const state = properties[prop.id] ?? { level: 0, lastCollectedAt: Date.now() }
            const pending = pendingAmounts[prop.id] ?? 0
            const isOwned = state.level > 0
            const isSelected = selectedSlot === prop.id
            const bldg = ISOMETRIC_BUILDINGS[prop.id]
            const slotNum = idx + 1

            return (
              <div
                key={prop.id}
                onClick={() => {
                  sfx.click()
                  setSelectedSlot(prop.id)
                }}
                className={`group relative flex flex-col justify-between rounded-xl p-4 cursor-pointer transition-all duration-300 transform-gpu hover:-translate-y-3 ${
                  isSelected
                    ? 'border-2 border-[#f6e27a] bg-gradient-to-b from-[#262010] to-[#120f06] shadow-[0_15px_30px_rgba(246,226,122,0.3)] ring-2 ring-[#f6e27a]/40 scale-105 z-20'
                    : isOwned
                    ? 'border border-[#c9a227]/40 bg-gradient-to-b from-[#1c1822] to-[#100d14] shadow-[0_10px_20px_rgba(0,0,0,0.7)] hover:border-[#c9a227]/80 z-10'
                    : 'border border-dashed border-[#c9a227]/25 bg-black/40 opacity-70 hover:opacity-100 hover:border-[#c9a227]/60'
                }`}
                style={{
                  boxShadow: isOwned ? `0 12px 25px ${bldg.glowColor}` : 'none',
                }}
              >
                {/* 3D Block Number & Status */}
                <div className="flex items-center justify-between text-[9px] font-black">
                  <span className="rounded bg-black/70 border border-[#c9a227]/30 px-1.5 py-0.5 text-[#b3a06b]">
                    BLOCK #{slotNum}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 ${
                      isOwned
                        ? 'bg-[#10b981]/25 text-[#86efac] border border-[#10b981]/40'
                        : 'bg-white/5 text-[#8a7a4d] border border-white/10'
                    }`}
                  >
                    {isOwned ? `LVL ${state.level}` : 'PLOT READY'}
                  </span>
                </div>

                {/* 3D Isometric Structure Visual */}
                <div className="relative my-4 flex h-32 flex-col items-center justify-center">
                  {/* Floating Cash Gain Particle Animation */}
                  {isOwned && (
                    <div
                      key={`cash-surge-${tickEffect}`}
                      className="pointer-events-none absolute -top-2 flex items-center gap-1 rounded-full border border-[#86efac]/60 bg-black/90 px-2.5 py-1 text-[11px] font-black text-[#86efac] shadow-[0_0_15px_rgba(16,185,129,0.7)] animate-[bounce_1s_ease-out]"
                    >
                      <Coins size={11} className="text-[#fde047]" />
                      <span>+{fmt(prop.perSec * state.level)}</span>
                    </div>
                  )}

                  {/* 3D Pedestal Platform Base */}
                  <div
                    className="relative flex h-24 w-24 items-center justify-center rounded-2xl border-2 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: isOwned
                        ? `linear-gradient(135deg, ${bldg.roofColor} 0%, ${bldg.wallColor} 100%)`
                        : 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
                      borderColor: isOwned ? bldg.accentColor : '#3f3f46',
                      boxShadow: isOwned
                        ? `0 10px 20px ${bldg.glowColor}, inset 0 2px 4px rgba(255,255,255,0.4)`
                        : 'none',
                    }}
                  >
                    {/* Architectural Emoji & Symbol */}
                    <span className="text-4xl drop-shadow-[0_8px_8px_rgba(0,0,0,0.8)]">
                      {prop.icon || bldg.emoji}
                    </span>

                    {/* Active Radar / Light Beacon for Airport or Island */}
                    {isOwned && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#86efac] opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-[#10b981]" />
                      </span>
                    )}
                  </div>

                  {/* Isometric shadow under pedestal */}
                  <div className="mt-2 h-2.5 w-20 rounded-full bg-black/80 blur-xs" />
                </div>

                {/* Building Title & Live Ticker */}
                <div className="text-center">
                  <div className="font-display gold-text text-xs font-bold truncate">
                    {prop.name}
                  </div>
                  <div className="text-[10px] text-[#8a7a4d] truncate">
                    {bldg.label}
                  </div>

                  {/* Yield Ticker */}
                  <div className="mt-2 rounded-lg bg-black/60 border border-white/5 p-1.5">
                    {isOwned ? (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#86efac] font-bold tabular-nums">
                          +{fmt(prop.perSec * state.level)}/s
                        </span>
                        <span className="text-[#67e8f9] font-bold tabular-nums animate-pulse">
                          ${fmt(pending)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] font-semibold text-[#f59e0b] tabular-nums">
                        Buy: {fmt(prop.price)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Block Inspection Control Bar */}
      {selectedDef && (
        <div className="mt-6 rounded-2xl border border-[#c9a227]/40 bg-gradient-to-r from-[#171306] via-[#221a08] to-[#120f04] p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="text-4xl p-2 rounded-xl bg-black/60 border border-[#c9a227]/30">
                {selectedDef.icon || '🏢'}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display gold-text text-lg font-bold">
                    {selectedDef.name}
                  </h3>
                  <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/50 px-2 py-0.5 text-[9px] font-black text-[#f6e27a]">
                    LVL {selectedState?.level ?? 0}
                  </span>
                </div>
                <p className="text-[11px] text-[#a89872] mt-0.5">{selectedDef.description}</p>
                <div className="mt-1 flex items-center gap-3 text-[11px]">
                  <span className="text-[#86efac] font-bold">
                    +{fmt(selectedDef.perSec * Math.max(1, selectedState?.level ?? 1))}/sec
                  </span>
                  <span className="text-[#8a7a4d]">·</span>
                  <span className="text-[#f6e27a]">
                    +{fmt(selectedDef.hourly * Math.max(1, selectedState?.level ?? 1))}/hr
                  </span>
                  <span className="text-[#8a7a4d]">·</span>
                  <span className="text-[#67e8f9] font-bold animate-pulse">
                    Unclaimed: {fmt(selectedPending)} chips
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {(selectedState?.level ?? 0) > 0 && (
                <button
                  onClick={() => onCollect(selectedDef.id as PropertyId)}
                  disabled={selectedPending <= 0}
                  className="btn-ghost-gold min-h-[44px] flex-1 sm:flex-none rounded-xl px-5 text-[11px] font-black tracking-wider disabled:opacity-30"
                >
                  COLLECT ({fmt(selectedPending)})
                </button>
              )}
              <button
                onClick={() => onUpgrade(selectedDef.id as PropertyId)}
                disabled={balance < selectedCost}
                className="btn-gold min-h-[44px] flex-1 sm:flex-none rounded-xl px-6 text-[11px] font-black tracking-wider disabled:opacity-40"
              >
                {(selectedState?.level ?? 0) > 0 ? `UPGRADE (${fmt(selectedCost)})` : `PURCHASE (${fmt(selectedDef.price)})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

