import { useEffect, useMemo, useState } from 'react'
import { useChips, fmt, PROPERTY_DEFS, type PropertyId } from '../state/chips'
import { usePlayer } from '../state/profile'
import { useNow } from '../state/shop'
import { sfx } from '../lib/audio'
import { getStakePool, investInStakePool } from '../lib/stakeAndClub'
import { PropertyShowcase3D } from '../components/PropertyShowcase3D'
import { fetchGlobalStakeInvestors, isSupabaseConfigured, type GlobalStakeInvestor } from '../lib/supabase'
import { Zap } from 'lucide-react'

// Colors contrasting with red (#ef4444)
const CONTRASTING_COLORS = [
  '#06b6d4', // Bright Cyan
  '#10b981', // Emerald Green
  '#a855f7', // Electric Purple
  '#facc15', // Vibrant Yellow
  '#3b82f6', // Royal Blue
  '#fb923c', // Bright Orange
  '#ec4899', // Hot Pink
  '#14b8a6', // Teal
]

// Calculate SVG donut slice path
function describeDonutSlice(
  cx: number,
  cy: number,
  r: number,
  innerR: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  // Clamp so angle never reaches exactly 360 relative to start (prevents SVG zero-arc glitch)
  const angle = Math.min(endAngleDeg - startAngleDeg, 359.999)
  const rad = Math.PI / 180
  const a1 = (startAngleDeg - 90) * rad
  const a2 = (startAngleDeg + angle - 90) * rad

  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const x2 = cx + r * Math.cos(a2)
  const y2 = cy + r * Math.sin(a2)

  const ix1 = cx + innerR * Math.cos(a2)
  const iy1 = cy + innerR * Math.sin(a2)
  const ix2 = cx + innerR * Math.cos(a1)
  const iy2 = cy + innerR * Math.sin(a1)

  const largeArc = angle > 180 ? 1 : 0

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`
}

export default function Properties() {
  const wallet = useChips()
  const player = usePlayer()
  const playerName = player.activeName ?? 'Player'
  // Tick every 1000ms so income visibly increases per second
  const now = useNow(1000)
  const [investInput, setInvestInput] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null)
  const [globalInvestors, setGlobalInvestors] = useState<GlobalStakeInvestor[]>([])

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1)
    window.addEventListener('stake-pool-updated', handler)
    return () => window.removeEventListener('stake-pool-updated', handler)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const loadInvestors = () => {
      fetchGlobalStakeInvestors().then((res) => {
        if (res && res.length > 0) {
          setGlobalInvestors(res)
        }
      })
    }
    loadInvestors()
    const timer = setInterval(loadInvestors, 8000)
    return () => clearInterval(timer)
  }, [refreshKey])

  // Total pending property income
  const totalPending = useMemo(() => {
    return PROPERTY_DEFS.reduce((sum, p) => sum + wallet.propertyPending(p.id as PropertyId, now), 0)
  }, [wallet, now])

  // Total per-second income across all properties
  const totalPerSec = useMemo(() => {
    return PROPERTY_DEFS.reduce((sum, p) => {
      const lvl = wallet.properties[p.id as PropertyId]?.level ?? 0
      return sum + p.perSec * lvl
    }, 0)
  }, [wallet.properties])

  // Total hourly income across all properties
  const totalHourly = useMemo(() => {
    return PROPERTY_DEFS.reduce((sum, p) => {
      const lvl = wallet.properties[p.id as PropertyId]?.level ?? 0
      return sum + p.hourly * lvl
    }, 0)
  }, [wallet.properties])

  // Total portfolio value
  const totalPropertyValue = useMemo(() => {
    return PROPERTY_DEFS.reduce((sum, p) => {
      const lvl = wallet.properties[p.id as PropertyId]?.level ?? 0
      return sum + p.price * lvl
    }, 0)
  }, [wallet.properties])

  // Pending amounts map for all 8 properties
  const pendingAmounts = useMemo(() => {
    const res = {} as Record<PropertyId, number>
    for (const p of PROPERTY_DEFS) {
      res[p.id as PropertyId] = wallet.propertyPending(p.id as PropertyId, now)
    }
    return res
  }, [wallet, now])

  const handleUpgradeProp = (id: PropertyId) => {
    const def = PROPERTY_DEFS.find((p) => p.id === id)
    const st = wallet.properties[id] ?? { level: 0, lastCollectedAt: Date.now() }
    const nextCost = Math.round((def?.price ?? 0) * Math.pow(1.7, st.level))
    if (wallet.buyOrUpgradeProperty(id)) {
      sfx.coin()
      setMessage(`${def?.name ?? id} upgraded to Level ${st.level + 1}!`)
      setError('')
    } else {
      setError(`Need ${fmt(nextCost - wallet.balance)} more chips for ${def?.name ?? id}.`)
    }
  }

  const handleCollectProp = (id: PropertyId) => {
    const def = PROPERTY_DEFS.find((p) => p.id === id)
    const amt = wallet.collectProperty(id)
    if (amt > 0) {
      sfx.coin()
      setMessage(`Collected ${fmt(amt)} chips from ${def?.name ?? id}!`)
      setError('')
    }
  }

  // Collect all properties at once
  const collectAll = () => {
    let collectedTotal = 0
    for (const p of PROPERTY_DEFS) {
      collectedTotal += wallet.collectProperty(p.id as PropertyId)
    }
    if (collectedTotal > 0) {
      sfx.coin()
      setMessage(`Collected ${fmt(collectedTotal)} chips from your properties!`)
      setError('')
    }
  }

  // Stake Pool Data (merged local + Supabase global)
  const pool = useMemo(() => {
    const local = getStakePool()
    const merged = { ...local.contributions }

    for (const gi of globalInvestors) {
      const existingKey = Object.keys(merged).find((k) => k.toLowerCase() === gi.player_name.toLowerCase())
      if (existingKey) {
        merged[existingKey] = Math.max(merged[existingKey], gi.chips_invested)
      } else {
        merged[gi.player_name] = gi.chips_invested
      }
    }

    const totalPool = Object.values(merged).reduce((s, v) => s + v, 0)
    return { contributions: merged, totalPool }
  }, [refreshKey, globalInvestors])

  const myStake = useMemo(() => {
    const cleanName = (playerName || '').trim().toLowerCase()
    const matchKey = Object.keys(pool.contributions).find((k) => k.toLowerCase() === cleanName)
    const contribution = matchKey ? pool.contributions[matchKey] : 0
    const percent = pool.totalPool > 0 ? (contribution / pool.totalPool) * 100 : 0
    return { totalPool: pool.totalPool, contribution, percent }
  }, [playerName, pool])

  // Build shareholders list with YOU being RED and others contrasting colors
  const shareholders = useMemo(() => {
    const list = Object.entries(pool.contributions)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: pool.totalPool > 0 ? (amount / pool.totalPool) * 100 : 0,
        isMe: name.toLowerCase() === playerName.toLowerCase(),
      }))
      .sort((a, b) => b.amount - a.amount)

    let otherColorIndex = 0
    return list.map((item) => {
      let color = '#ef4444' // YOU ARE RED
      if (!item.isMe) {
        color = CONTRASTING_COLORS[otherColorIndex % CONTRASTING_COLORS.length]
        otherColorIndex++
      }
      return { ...item, color }
    })
  }, [pool, playerName, refreshKey])

  // Calculate slice angles for the SVG Pie Chart
  const pieSlices = useMemo(() => {
    if (pool.totalPool <= 0 || shareholders.length === 0) return []
    let currentAngle = 0
    return shareholders.map((s) => {
      const sliceAngle = (s.pct / 100) * 360
      const start = currentAngle
      const end = currentAngle + sliceAngle
      currentAngle = end
      return {
        ...s,
        startAngle: start,
        endAngle: end,
      }
    })
  }, [shareholders, pool.totalPool])

  const handleInvest = (amt: number) => {
    if (!amt || amt <= 0) {
      setError('Please enter a valid investment amount.')
      return
    }
    if (amt > wallet.balance) {
      setError(`You only have ${fmt(wallet.balance)} chips available.`)
      return
    }
    if (!wallet.spend(amt)) {
      setError('Chip transfer failed.')
      return
    }
    const res = investInStakePool(playerName, amt)
    sfx.coin()
    setMessage(`🎉 You acquired more stake! Your ownership is now ${res.myPercent.toFixed(2)}%!`)
    setError('')
    setInvestInput('')
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <div className="mb-6 text-center">
        <p className="text-[10px] tracking-[0.4em] text-[#b3a06b]">REAL ESTATE &amp; CAPITAL ASSETS</p>
        <h1 className="font-display gold-text-bright mt-2 text-3xl font-black tracking-[0.18em] sm:text-4xl">PROPERTIES</h1>
        <p className="mt-2 text-[13px] text-[#a89872]">Acquire 3D venues, earn live per-second passive income, and track casino ownership</p>
        <div className="divider-gold mx-auto mt-3 w-48" />
      </div>

      {(error || message) && (
        <div role="status" className={`mb-5 rounded-xl border px-5 py-3 text-center text-[12px] font-semibold ${error ? 'border-[#ef4444]/60 bg-[#450a0a]/80 text-[#fca5a5]' : 'border-[#10b981]/60 bg-[#064e3b]/80 text-[#a7f3d0]'}`}>
          {error || message}
        </div>
      )}

      {/* Portfolio Overview */}
      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/25 shadow-lg">
          <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">AVAILABLE CHIPS</div>
          <div className="font-display mt-1 text-2xl font-bold text-[#f6e27a]">{fmt(wallet.balance)}</div>
        </div>
        <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/25 shadow-lg">
          <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">LIVE REVENUE TICKER</div>
          <div className="font-display mt-1 text-2xl font-bold text-[#86efac]">
            +{fmt(totalPerSec)} <span className="text-[11px] font-normal text-[#86efac]/80">/sec</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#8a7a4d]">+{fmt(totalHourly)}/hr</div>
        </div>
        <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/25 shadow-lg">
          <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">PORTFOLIO VALUE</div>
          <div className="font-display mt-1 text-2xl font-bold text-[#f2e6c9]">{fmt(totalPropertyValue)}</div>
        </div>
        <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/25 shadow-lg">
          <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">UNCLAIMED INCOME</div>
          <div className="flex items-center justify-between">
            <span className="font-display mt-1 text-2xl font-bold text-[#67e8f9] animate-pulse">{fmt(totalPending)}</span>
            {totalPending > 0 && (
              <button onClick={collectAll} className="btn-gold rounded px-3 py-1 text-[10px] font-black">
                COLLECT
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================== CASINO STAKE PIE CHART (YOU = RED) ===================== */}
      <section className="relative mb-12 overflow-hidden rounded-2xl border-2 border-[#ef4444]/60 bg-gradient-to-br from-[#1c080b] via-[#140608] to-[#0a0304] p-5 shadow-[0_0_35px_rgba(239,68,68,0.25)] sm:p-7">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#ef4444]/15 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-56 w-56 rounded-full bg-[#06b6d4]/10 blur-3xl" />

        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#ef4444]/25 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#ef4444] px-2.5 py-0.5 text-[9px] font-black tracking-[0.2em] text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]">
                YOU ARE RED
              </span>
              <span className="text-[10px] tracking-[0.25em] text-[#fca5a5]">CAPITAL STAKE OWNERSHIP</span>
            </div>
            <h2 className="font-display mt-1 text-2xl font-black tracking-[0.12em] text-[#fff1f2] sm:text-3xl">
              CASINO OWNERSHIP PIE CHART
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.2em] text-[#8a7a4d]">TOTAL CAPITAL POOL</div>
            <div className="font-display text-xl font-bold text-[#fde047]">{fmt(pool.totalPool)} chips</div>
          </div>
        </div>

        {/* PIE CHART VISUALIZER */}
        <div className="grid gap-6 lg:grid-cols-12 items-center mb-6">
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative h-64 w-64">
              <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                {pool.totalPool === 0 ? (
                  <circle
                    cx="100"
                    cy="100"
                    r="75"
                    fill="none"
                    stroke="#3f3f46"
                    strokeWidth="32"
                    strokeDasharray="4 4"
                  />
                ) : pieSlices.length === 1 ? (
                  <circle
                    cx="100"
                    cy="100"
                    r="64"
                    fill="none"
                    stroke={pieSlices[0].color}
                    strokeWidth="32"
                    className="transition-all duration-300"
                    style={{
                      filter: pieSlices[0].isMe ? 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.9))' : 'none',
                    }}
                  />
                ) : (
                  pieSlices.map((slice) => {
                    const isHovered = hoveredSlice === slice.name
                    const path = describeDonutSlice(100, 100, isHovered ? 84 : 80, 48, slice.startAngle, slice.endAngle)
                    return (
                      <path
                        key={slice.name}
                        d={path}
                        fill={slice.color}
                        stroke="#0a0304"
                        strokeWidth="2"
                        className="cursor-pointer transition-all duration-200 hover:brightness-125"
                        style={{
                          filter: slice.isMe
                            ? 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.8))'
                            : isHovered
                            ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))'
                            : 'none',
                        }}
                        onMouseEnter={() => setHoveredSlice(slice.name)}
                        onMouseLeave={() => setHoveredSlice(null)}
                      />
                    )
                  })
                )}
              </svg>

              {/* Center Donut Hole Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[9px] tracking-[0.2em] font-black uppercase text-[#ef4444]">
                  {hoveredSlice ? hoveredSlice.toUpperCase() : 'YOUR STAKE'}
                </span>
                <span className="font-display text-2xl font-black tabular-nums text-[#f2e6c9] drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]">
                  {hoveredSlice
                    ? `${(shareholders.find((s) => s.name === hoveredSlice)?.pct ?? 0).toFixed(1)}%`
                    : `${myStake.percent.toFixed(1)}%`}
                </span>
                <span className="text-[9px] text-[#a89872] tabular-nums">
                  {hoveredSlice
                    ? `${fmt(shareholders.find((s) => s.name === hoveredSlice)?.amount ?? 0)} chips`
                    : `${fmt(myStake.contribution)} chips`}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-[#8a7a4d] tracking-wider text-center">
              YOU ARE RED · HOVER OVER PIE SLICES TO INSPECT SHAREHOLDERS
            </p>
          </div>

          {/* Shareholder Cap Table & Legend */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-[#c9a227]/20 bg-black/60 p-4">
              <div className="mb-3 flex items-center justify-between text-[10px] font-bold tracking-[0.25em] text-[#8a7a4d]">
                <span>CAP TABLE &amp; COLOR KEY</span>
                <span className="text-[#ef4444]">{myStake.percent.toFixed(2)}% OWNED BY YOU</span>
              </div>

              {shareholders.length === 0 ? (
                <p className="text-[11px] text-[#6b5f42]">No one has invested yet. Be the first to own a piece of Golden Felt!</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {shareholders.map((s) => (
                    <div
                      key={s.name}
                      onMouseEnter={() => setHoveredSlice(s.name)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      className={`flex items-center justify-between rounded-lg p-2.5 text-[12px] transition-colors cursor-pointer ${
                        s.isMe
                          ? 'border-2 border-[#ef4444] bg-[#450a0a]/70 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                          : hoveredSlice === s.name
                          ? 'border border-white/30 bg-white/10'
                          : 'border border-white/10 bg-black/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-4 w-4 shrink-0 rounded-full shadow-md"
                          style={{ backgroundColor: s.color }}
                        />
                        <div className="min-w-0 truncate">
                          <div className="font-bold truncate text-[#f2e6c9]">
                            {s.name} {s.isMe && <span className="ml-1 text-[10px] font-black text-[#ef4444]">(YOU - RED)</span>}
                          </div>
                          <div className="text-[10px] text-[#8a7a4d]">{fmt(s.amount)} chips</div>
                        </div>
                      </div>
                      <div className="font-display text-base font-black tabular-nums" style={{ color: s.color }}>
                        {s.pct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Investment Input */}
        <div className="mt-4 rounded-xl border border-[#ef4444]/30 bg-black/50 p-4">
          <div className="mb-2 text-[10px] font-bold tracking-[0.25em] text-[#fca5a5]">
            ACQUIRE CASINO HOUSE STAKE
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="number"
              value={investInput}
              onChange={(e) => setInvestInput(e.target.value)}
              placeholder="Chips to invest…"
              min={1}
              max={wallet.balance}
              className="flex-1 min-h-[44px] rounded-lg border border-[#ef4444]/40 bg-black/60 px-3.5 text-[14px] text-[#f2e6c9] outline-none focus:border-[#ef4444]"
            />
            <button
              onClick={() => handleInvest(parseInt(investInput.replace(/,/g, ''), 10) || 0)}
              disabled={!investInput || parseInt(investInput, 10) <= 0 || parseInt(investInput, 10) > wallet.balance}
              className="rounded-lg bg-gradient-to-r from-[#b91c1c] via-[#dc2626] to-[#ef4444] px-6 text-[11px] font-black tracking-wider text-white shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              INVEST CHIPS
            </button>
          </div>
        </div>
      </section>

      {/* ===================== 3D 8-BLOCK SHOW AREA (LIVE MONEY ANIMATION) ===================== */}
      <PropertyShowcase3D
        properties={wallet.properties}
        pendingAmounts={pendingAmounts}
        balance={wallet.balance}
        onCollect={handleCollectProp}
        onUpgrade={handleUpgradeProp}
        now={now}
      />

      {/* ===================== 3D 8-SLOT PROPERTY EMPIRE ===================== */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-[#c9a227]/30 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#c9a227]/20 border border-[#c9a227]/40 px-2 py-0.5 text-[9px] font-black text-[#f6e27a]">
              8 SLOTS ARCHITECTURE
            </span>
            <p className="text-[10px] tracking-[0.3em] text-[#8a7a4d]">REAL ESTATE SYSTEM</p>
          </div>
          <h2 className="font-display gold-text text-2xl font-bold tracking-[0.15em] mt-1">
            CASINO PROPERTY EMPIRE
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] tracking-widest text-[#8a7a4d]">LIVE TICK RATE</div>
            <div className="text-[12px] font-bold text-[#86efac]">1 SECOND INTERVAL</div>
          </div>
          {totalPending > 0 && (
            <button onClick={collectAll} className="btn-gold rounded-lg px-4 py-2 text-[11px] font-black shadow-lg">
              COLLECT ALL ({fmt(totalPending)})
            </button>
          )}
        </div>
      </div>

      {/* 8 3D PROPERTY SLOTS GRID */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PROPERTY_DEFS.map((prop, index) => {
          const state = wallet.properties[prop.id as PropertyId] ?? { level: 0, lastCollectedAt: Date.now() }
          const pending = wallet.propertyPending(prop.id as PropertyId, now)
          const nextCost = Math.round(prop.price * Math.pow(1.7, state.level))
          const canAfford = wallet.balance >= nextCost
          const icon = prop.icon
          const slotNum = index + 1
          const isOwned = state.level > 0

          const onUpgrade = () => {
            if (wallet.buyOrUpgradeProperty(prop.id as PropertyId)) {
              sfx.coin()
              setMessage(`${prop.name} upgraded to Level ${state.level + 1}!`)
              setError('')
            } else {
              setError(`Need ${fmt(nextCost - wallet.balance)} more chips for ${prop.name}.`)
            }
          }

          const onCollect = () => {
            const amt = wallet.collectProperty(prop.id as PropertyId)
            if (amt > 0) {
              sfx.coin()
              setMessage(`Collected ${fmt(amt)} chips from ${prop.name}!`)
              setError('')
            }
          }

          return (
            <div
              key={prop.id}
              className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-300 transform-gpu hover:-translate-y-2 hover:shadow-[0_20px_35px_rgba(0,0,0,0.8)] ${
                isOwned
                  ? 'border-[#f6e27a]/50 bg-gradient-to-b from-[#1b170c] via-[#120f08] to-[#0a0804] shadow-[0_10px_25px_rgba(201,162,39,0.15)]'
                  : 'border-[#c9a227]/20 bg-gradient-to-b from-[#141216] to-[#0c0a0e] opacity-90'
              }`}
            >
              {/* 3D Top Bevel Highlight */}
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#f6e27a]/40 to-transparent" />

              <div>
                {/* Header Slot & Level */}
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-full border border-[#c9a227]/30 bg-black/60 px-2 py-0.5 text-[9px] font-black tracking-widest text-[#b3a06b]">
                    SLOT #{slotNum}
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black ${
                    isOwned
                      ? 'border-[#10b981]/50 bg-[#064e3b]/50 text-[#86efac]'
                      : 'border-white/10 bg-black/40 text-[#8a7a4d]'
                  }`}>
                    {isOwned ? `LVL ${state.level}` : 'UNOWNED'}
                  </span>
                </div>

                {/* 3D Icon & Title */}
                <div className="text-center my-3">
                  <div className="text-5xl transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_10px_10px_rgba(0,0,0,0.6)]">
                    {icon}
                  </div>
                  <h3 className="font-display gold-text text-base font-bold tracking-wider mt-2">
                    {prop.name}
                  </h3>
                  <p className="text-[11px] text-[#8a7a4d] line-clamp-2 mt-1 leading-snug">
                    {prop.description}
                  </p>
                </div>

                {/* Real-time Income Metrics */}
                <div className="mt-4 rounded-xl bg-black/60 border border-white/5 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8a7a4d] flex items-center gap-1">
                      <Zap size={11} className="text-[#86efac]" /> TICK RATE
                    </span>
                    <span className="font-bold text-[#86efac] tabular-nums">
                      +{fmt(prop.perSec * Math.max(1, state.level))}/sec
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8a7a4d]">HOURLY</span>
                    <span className="text-[#f6e27a] font-medium tabular-nums">
                      +{fmt(prop.hourly * Math.max(1, state.level))}/hr
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
                    <span className="text-[#67e8f9] font-bold">UNCLAIMED</span>
                    <span className="font-display font-bold text-[#67e8f9] tabular-nums text-sm animate-pulse">
                      {fmt(pending)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 space-y-2">
                {isOwned && (
                  <button
                    onClick={onCollect}
                    disabled={pending <= 0}
                    className="btn-ghost-gold min-h-[38px] w-full rounded-lg text-[10px] font-black tracking-wider disabled:opacity-30"
                  >
                    COLLECT {pending > 0 ? `+${fmt(pending)}` : ''}
                  </button>
                )}
                <button
                  onClick={onUpgrade}
                  disabled={!canAfford}
                  className={`min-h-[42px] w-full rounded-lg text-[10px] font-black tracking-wider transition-all shadow-md ${
                    canAfford
                      ? 'btn-gold'
                      : 'border border-[#c9a227]/25 bg-black/40 text-[#8a7a4d] opacity-50 cursor-not-allowed'
                  }`}
                >
                  {isOwned ? `UPGRADE (${fmt(nextCost)})` : `BUY SLOT (${fmt(prop.price)})`}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
