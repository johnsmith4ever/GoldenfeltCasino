import { useState, useEffect, useMemo } from 'react'
import { Check, Gift, Lock, TrendingUp, Users, Coins } from 'lucide-react'
import { Chip } from '../components/Chip'
import { Nametag } from '../components/Nametag'
import { useChips, fmt } from '../state/chips'
import { usePlayer } from '../state/profile'
import {
  CATALOG,
  CATEGORY_LABEL,
  DAILY_AMOUNT,
  NAME_MAX,
  formatCountdown,
  msUntilClaim,
  useNow,
  useShop,
  type Category,
  type ShopItem,
} from '../state/shop'
import { sfx } from '../lib/audio'
import { getStakePool, investInStakePool, getPlayerStake } from '../lib/stakeAndClub'

const TABS: Category[] = ['felt', 'back', 'tag', 'luxury']

/* ---------- Daily gift ---------- */

export function DailyGift({ compact = false }: { compact?: boolean }) {
  const { lastClaim, claim, streak } = useShop()
  const now = useNow(1000)
  const wait = msUntilClaim(lastClaim, now)
  const ready = wait === 0

  const onClaim = () => {
    if (claim()) sfx.coin()
  }

  return (
    <div className={`panel-noir gold-frame relative overflow-hidden rounded-xl ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#d4af37] opacity-10 blur-3xl" />
      <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#c9a227]/50 bg-black/40 ${ready ? 'pulse-soft' : ''}`}>
          <Gift size={26} strokeWidth={1.5} className="text-[#f6e27a]" />
        </div>
        <div className="flex-1">
          <div className="font-display gold-text text-lg font-bold tracking-[0.2em]">DAILY GIFT</div>
          <p className="mt-0.5 text-[13px] font-light text-[#b3a06b]">
            Claim <span className="font-semibold text-[#f6e27a] tabular-nums">{fmt(DAILY_AMOUNT)}</span> free chips every 24 hours. <span className="text-[#f6e27a]">Daily streak: {streak}</span>
          </p>
        </div>
        <button
          onClick={onClaim}
          disabled={!ready}
          className="btn-gold min-h-[44px] w-full rounded px-6 py-2.5 text-[12px] sm:w-auto sm:min-w-[210px]"
        >
          {ready ? `CLAIM ${fmt(DAILY_AMOUNT)}` : `NEXT GIFT IN ${formatCountdown(wait)}`}
        </button>
      </div>
    </div>
  )
}

/* ---------- Item previews ---------- */

function Preview({ item }: { item: ShopItem }) {
  if (item.category === 'felt') {
    const cls = item.css || 'felt-green'
    return (
      <div className={`felt-texture ${cls} gold-frame flex h-24 items-center justify-center rounded-lg`}>
        {!item.css && (
          <div className="flex gap-1.5">
            <span className="felt-green h-8 w-8 rounded-full border border-[#c9a227]/40" />
            <span className="felt-red h-8 w-8 rounded-full border border-[#c9a227]/40" />
            <span className="felt-noir h-8 w-8 rounded-full border border-[#c9a227]/40" />
          </div>
        )}
      </div>
    )
  }
  if (item.category === 'back') {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg bg-black/30">
        <div className="relative h-[84px] w-[60px]">
          <div className={`card-back ${item.css} flex h-full w-full items-center justify-center`}>
            <span className="card-back-mark font-display text-xl text-[#f6e27a]/70 select-none">GF</span>
          </div>
        </div>
      </div>
    )
  }
  if (item.category === 'luxury') {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-[#f59e0b]/30 bg-gradient-to-br from-black/60 to-[#1c1505]/80">
        <span className="text-4xl drop-shadow-md">{item.icon ?? '👑'}</span>
      </div>
    )
  }
  return (
    <div className="flex h-24 items-center justify-center rounded-lg bg-black/30">
      <Nametag tagId={item.id} />
    </div>
  )
}

function ItemCard({ item, onMessage }: { item: ShopItem; onMessage: (m: string) => void }) {
  const { balance } = useChips()
  const { owned, equipped, buy, equip } = useShop()
  const isOwned = owned.includes(item.id)
  const isEquipped = item.category !== 'luxury' && equipped[item.category] === item.id
  const canAfford = balance >= item.price
  const isLuxury = item.category === 'luxury'

  const onBuy = () => {
    const r = buy(item.id)
    if (r === 'bought') {
      sfx.coin()
      onMessage(`${item.name} purchased ${isLuxury ? 'and added to your trophy collection' : 'and equipped'}.`)
    } else if (r === 'poor') {
      onMessage(`You need ${fmt(item.price - balance)} more chips for ${item.name}.`)
    }
  }
  const onEquip = () => {
    if (equip(item.id)) {
      sfx.click()
      onMessage(`${item.name} equipped.`)
    }
  }

  return (
    <div className={`panel-noir flex flex-col rounded-xl p-4 transition-colors ${isEquipped ? 'border-[#f6e27a]/70 shadow-[0_0_15px_rgba(246,226,122,0.15)]' : ''}`}>
      <Preview item={item} />
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display gold-text text-base font-bold tracking-[0.12em] uppercase">{item.name}</h3>
          {item.level && (
            <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/50 px-1.5 py-0.5 text-[9px] font-black text-[#f6e27a]">
              LVL {item.level}
            </span>
          )}
        </div>
        {isOwned && (
          <span className="shrink-0 rounded-full border border-[#c9a227]/40 px-2 py-0.5 text-[9px] tracking-[0.2em] text-[#86efac]">
            {isLuxury ? 'COLLECTED' : 'OWNED'}
          </span>
        )}
      </div>
      <p className="mt-1 flex-1 text-[12.5px] font-light leading-relaxed text-[#a89872]">{item.desc}</p>

      <div className="mt-4">
        {isLuxury ? (
          isOwned ? (
            <div className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded border border-[#10b981]/40 bg-[#064e3b]/30 px-4 py-2 text-[11px] font-bold text-[#86efac]">
              <Check size={14} /> IN YOUR COLLECTION
            </div>
          ) : (
            <button
              onClick={onBuy}
              disabled={!canAfford}
              className="btn-gold flex min-h-[44px] w-full items-center justify-center gap-2 rounded px-4 py-2 text-[11px]"
            >
              {!canAfford && <Lock size={13} />}
              BUY · {fmt(item.price)}
            </button>
          )
        ) : isEquipped ? (
          <button disabled className="btn-ghost-gold flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded px-4 py-2 text-[11px]">
            <Check size={14} /> EQUIPPED
          </button>
        ) : isOwned ? (
          <button onClick={onEquip} className="btn-ghost-gold min-h-[44px] w-full rounded px-4 py-2 text-[11px]">
            EQUIP
          </button>
        ) : (
          <button
            onClick={onBuy}
            disabled={!canAfford}
            className="btn-gold flex min-h-[44px] w-full items-center justify-center gap-2 rounded px-4 py-2 text-[11px]"
          >
            {!canAfford && <Lock size={13} />}
            BUY · {fmt(item.price)}
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- Casino Stake Section ---------- */

function CasinoStakeSection() {
  const { balance, spend } = useChips()
  const { activeName } = usePlayer()
  const playerName = activeName ?? 'Player'
  const [investInput, setInvestInput] = useState('')
  const [stakeMessage, setStakeMessage] = useState('')
  const [stakeError, setStakeError] = useState('')

  // Read current stake pool
  const [poolVersion, setPoolVersion] = useState(0)
  useEffect(() => {
    const handler = () => setPoolVersion((v) => v + 1)
    window.addEventListener('stake-pool-updated', handler)
    return () => window.removeEventListener('stake-pool-updated', handler)
  }, [])
  const pool = useMemo(() => getStakePool(), [poolVersion])
  const myStake = useMemo(() => getPlayerStake(playerName), [playerName, poolVersion])

  const numAmount = parseInt(investInput.replace(/,/g, ''), 10) || 0

  const handleInvest = (amount: number) => {
    if (!amount || amount <= 0) {
      setStakeError('Please enter a valid investment amount.')
      return
    }
    if (amount > balance) {
      setStakeError(`You only have ${fmt(balance)} chips available.`)
      return
    }
    if (!spend(amount)) {
      setStakeError('Could not process chip transfer.')
      return
    }
    const res = investInStakePool(playerName, amount)
    sfx.coin()
    setStakeError('')
    setStakeMessage(`🎉 You invested ${fmt(amount)} chips! Your house ownership stake is now ${res.myPercent.toFixed(2)}%!`)
    setInvestInput('')
    setPoolVersion((v) => v + 1)
  }

  // Sorted list of shareholders
  const shareholders = Object.entries(pool.contributions)
    .map(([name, amount]) => ({
      name,
      amount,
      pct: pool.totalPool > 0 ? (amount / pool.totalPool) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <section className="relative mt-12 overflow-hidden rounded-2xl border-2 border-[#c9a227]/50 bg-gradient-to-br from-[#120f04] via-[#1a1406] to-[#0a0905] p-6 shadow-2xl sm:p-8">
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-[#f59e0b]/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-[#10b981]/15 blur-3xl" />

      <div className="relative mb-6 border-b border-[#c9a227]/30 pb-5 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <span className="rounded bg-gradient-to-r from-[#d97706] to-[#f59e0b] px-2.5 py-0.5 text-[9px] font-black tracking-[0.25em] text-[#140b02]">
            HOUSE OWNERSHIP POOL
          </span>
          <span className="text-[10px] tracking-[0.2em] text-[#a89872]">DYNAMIC CAP TABLE</span>
        </div>
        <h2 className="font-display gold-text-bright mt-2 text-2xl font-black tracking-[0.15em] sm:text-3xl">
          CASINO STAKE &amp; CAPITAL POOL
        </h2>
        <p className="mt-1 text-[13px] text-[#cbb98a]">
          Invest chips into the house. Your ownership stake dynamically scales with the size of the total capital pool.
        </p>
      </div>

      {stakeMessage && (
        <div className="mb-4 rounded-xl border border-[#10b981]/60 bg-[#064e3b]/80 p-3.5 text-center text-[12px] font-semibold text-[#a7f3d0]">
          {stakeMessage}
        </div>
      )}
      {stakeError && (
        <div className="mb-4 rounded-xl border border-[#ef4444]/60 bg-[#450a0a]/80 p-3.5 text-center text-[12px] font-semibold text-[#fca5a5]">
          {stakeError}
        </div>
      )}

      {/* Stake Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#c9a227]/30 bg-black/50 p-4">
          <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">TOTAL CASINO POOL</div>
          <div className="font-display mt-1 text-2xl font-black text-[#f6e27a]">
            {fmt(pool.totalPool)} <span className="text-[12px] text-[#a89872]">chips</span>
          </div>
          <div className="mt-1 text-[10px] text-[#6b5f42]">{shareholders.length} active stakeholder{shareholders.length !== 1 ? 's' : ''}</div>
        </div>

        <div className="rounded-xl border border-[#c9a227]/30 bg-black/50 p-4">
          <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">YOUR TOTAL INVESTMENT</div>
          <div className="font-display mt-1 text-2xl font-black text-[#f2e6c9]">
            {fmt(myStake.contribution)} <span className="text-[12px] text-[#a89872]">chips</span>
          </div>
          <div className="mt-1 text-[10px] text-[#6b5f42]">Invested by {playerName}</div>
        </div>

        <div className="rounded-xl border border-[#f59e0b]/50 bg-gradient-to-br from-[#2a1e05] to-black/60 p-4">
          <div className="text-[9px] tracking-[0.25em] text-[#f59e0b]">YOUR CASINO STAKE</div>
          <div className="font-display mt-1 text-3xl font-black text-[#fef08a]">
            {myStake.percent.toFixed(2)}%
          </div>
          <div className="mt-1 text-[10px] text-[#86efac]">
            {myStake.percent > 0 ? 'Active House Partner' : 'No stake yet'}
          </div>
        </div>
      </div>

      {/* Ownership Progress Bar */}
      <div className="mt-5 rounded-xl border border-[#c9a227]/25 bg-black/40 p-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#a89872]">Your Share of Golden Felt</span>
          <span className="font-bold text-[#fde047]">{myStake.percent.toFixed(2)}% Ownership</span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-black/80 ring-1 ring-[#c9a227]/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#fde047] transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(myStake.percent > 0 ? 3 : 0, myStake.percent))}%` }}
          />
        </div>
      </div>

      {/* Investment input controls */}
      <div className="mt-6 rounded-xl border border-[#c9a227]/40 bg-black/60 p-5">
        <label className="text-[10px] font-bold tracking-[0.25em] text-[#b3a06b]">
          INVEST CHIPS TO INCREASE YOUR STAKE
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            type="number"
            value={investInput}
            onChange={(e) => setInvestInput(e.target.value)}
            placeholder="Enter chip amount to invest…"
            min={1}
            max={balance}
            className="flex-1 min-h-[46px] rounded-lg border border-[#c9a227]/50 bg-black/60 px-4 font-display text-[16px] text-[#f2e6c9] outline-none placeholder:text-[#524528] focus:border-[#fde047]"
          />
          <button
            onClick={() => handleInvest(numAmount)}
            disabled={numAmount <= 0 || numAmount > balance}
            className="btn-gold min-h-[46px] rounded-lg px-8 text-[12px] font-bold tracking-wider disabled:opacity-40"
          >
            INVEST IN CASINO STAKE
          </button>
        </div>

        {/* Quick chip buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[9px] tracking-[0.2em] text-[#8a7a4d]">QUICK ADD:</span>
          {[100, 1000, 10000, 50000, 100000].filter(v => v <= balance).map(v => (
            <button
              key={v}
              onClick={() => setInvestInput(String((numAmount || 0) + v))}
              className="rounded-full border border-[#c9a227]/40 bg-black/40 px-3 py-1 text-[10px] font-bold text-[#fde047] hover:border-[#fde047] hover:bg-[#2a2105]"
            >
              +{fmt(v)}
            </button>
          ))}
          {balance > 0 && (
            <button
              onClick={() => setInvestInput(String(balance))}
              className="rounded-full border border-[#67e8f9]/50 bg-[#083344]/40 px-3 py-1 text-[10px] font-bold text-[#67e8f9] hover:border-[#67e8f9]"
            >
              ALL IN ({fmt(balance)})
            </button>
          )}
        </div>
      </div>

      {/* Shareholder Cap Table */}
      {shareholders.length > 0 && (
        <div className="mt-6 border-t border-[#c9a227]/20 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#8a7a4d]">
              SHAREHOLDER ROSTER (CAP TABLE)
            </span>
            <span className="text-[10px] text-[#6b5f42]">Based on total pool size</span>
          </div>
          <div className="space-y-2">
            {shareholders.map((s, idx) => {
              const isMe = s.name.toLowerCase() === playerName.toLowerCase()
              return (
                <div
                  key={s.name}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[12px] ${
                    isMe
                      ? 'border border-[#fde047]/50 bg-[#2a2105]/70 text-[#fde047]'
                      : 'border border-[#c9a227]/15 bg-black/30 text-[#cbb98a]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-display text-[11px] font-bold text-[#8a7a4d]">#{idx + 1}</span>
                    <span className="font-bold">{s.name}</span>
                    {isMe && (
                      <span className="rounded bg-[#f59e0b]/20 px-1.5 py-0.5 text-[9px] font-black text-[#fde047]">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="text-[11px] text-[#8a7a4d]">{fmt(s.amount)} chips</span>
                    <span className="font-display font-bold text-[#f6e27a] tabular-nums">{s.pct.toFixed(2)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------- Page ---------- */

export default function Shop() {
  const { balance } = useChips()
  const { name, setName } = useShop()
  const [tab, setTab] = useState<Category>('felt')
  const [message, setMessage] = useState('')

  const items = CATALOG.filter((i) => i.category === tab)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <div className="mb-6 text-center">
        <h1 className="font-display gold-text text-3xl font-bold tracking-[0.2em] sm:text-4xl">THE SHOP</h1>
        <p className="mt-1 text-[13px] tracking-[0.25em] text-[#b3a06b] uppercase">Spend your chips in style</p>
        <div className="divider-gold mx-auto mt-3 w-48" />
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#c9a227]/40 bg-black/50 py-1 pl-1.5 pr-4">
          <Chip value={1000} size={26} label="GF" />
          <span className="font-display text-base font-bold text-[#f6e27a] tabular-nums">{fmt(balance)}</span>
          <span className="text-[10px] tracking-[0.25em] text-[#8a7a4d]">CHIPS</span>
        </div>
      </div>

      <DailyGift />

      {/* Nametag name editor */}
      <div className="panel-noir mt-5 flex flex-col items-center gap-4 rounded-xl p-4 sm:flex-row sm:p-5">
        <div className="w-full flex-1">
          <label htmlFor="nametag-name" className="text-[10px] tracking-[0.3em] text-[#8a7a4d]">YOUR NAME</label>
          <input
            id="nametag-name"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guest"
            autoComplete="off"
            className="mt-1.5 min-h-[44px] w-full rounded border border-[#c9a227]/30 bg-black/40 px-3 text-[15px] text-[#f2e6c9] outline-none placeholder:text-[#6b5f42] focus:border-[#f6e27a]/70"
          />
        </div>
        <div className="flex flex-col items-center gap-1.5 sm:items-end">
          <span className="text-[10px] tracking-[0.3em] text-[#8a7a4d]">PREVIEW</span>
          <Nametag />
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="mt-8 flex flex-wrap justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => { sfx.click(); setTab(t); setMessage('') }}
            className={`min-h-[44px] rounded px-5 py-2 text-[11px] font-bold ${tab === t ? 'btn-gold' : 'btn-ghost-gold'}`}
          >
            {CATEGORY_LABEL[t]}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="mt-4 h-5 text-center text-[12px] tracking-wide text-[#f6e27a]">{message}</p>

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onMessage={setMessage} />
        ))}
      </div>

      {/* Casino Stake Section at the bottom */}
      <CasinoStakeSection />

      <p className="mt-10 text-center text-[11px] tracking-[0.3em] text-[#6b5f42]">
        CHIPS HOLD NO REAL VALUE · ALL TRANSACTIONS ARE FOR IN-GAME PRESTIGE ONLY
      </p>
    </div>
  )
}
