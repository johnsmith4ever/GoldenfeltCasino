import { useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { usePlayer } from '../state/profile'
import { sfx } from '../lib/audio'
import { CheckCircle2, Sparkles, AlertCircle } from 'lucide-react'

// Gift passwords - hardcoded
const GIFT_CONFIGS = {
  Kierash: { password: 'kfire2000!', reward: 250000, unlimited: false },
  Nik:     { password: 'nikproject456!', reward: 250000, unlimited: false },
  ADMIN:   { password: 'johnsmith4ever!', reward: 500000, unlimited: true },
} as const
type GiftUser = keyof typeof GIFT_CONFIGS

const GIFT_USERS: GiftUser[] = ['Kierash', 'Nik', 'ADMIN']
const FREE_PACKAGE_AMOUNT = 6000
const MIN_LOAN = 50000
const MIN_REPAY = 50000

// Money Bag definitions
const BAG_CONFIGS = [
  {
    value: 10000,
    label: '10K',
    title: 'Emerald Pouch',
    gradient: 'from-[#064e3b] via-[#059669] to-[#047857]',
    border: 'border-[#10b981]/50 hover:border-[#34d399]',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
    textCol: '#6ee7b7',
    bagColor: '#059669',
    accentColor: '#34d399',
    badgeBg: '#064e3b',
  },
  {
    value: 25000,
    label: '25K',
    title: 'Sapphire Sack',
    gradient: 'from-[#1e1b4b] via-[#4f46e5] to-[#4338ca]',
    border: 'border-[#818cf8]/50 hover:border-[#a5b4fc]',
    glow: 'shadow-[0_0_15px_rgba(99,102,241,0.35)]',
    textCol: '#c7d2fe',
    bagColor: '#4f46e5',
    accentColor: '#818cf8',
    badgeBg: '#1e1b4b',
  },
  {
    value: 50000,
    label: '50K',
    title: 'Imperial Vault Bag',
    gradient: 'from-[#78350f] via-[#d97706] to-[#b45309]',
    border: 'border-[#f59e0b]/60 hover:border-[#fbbf24]',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    textCol: '#fde68a',
    bagColor: '#d97706',
    accentColor: '#fbbf24',
    badgeBg: '#78350f',
  },
] as const

type BagValue = (typeof BAG_CONFIGS)[number]['value']

function MoneyBagSVG({
  value,
  size = 64,
  count = 0,
}: {
  value: BagValue
  size?: number
  count?: number
}) {
  const config = BAG_CONFIGS.find((b) => b.value === value)!

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-md transition-transform hover:scale-105 active:scale-95">
        <defs>
          <linearGradient id={`bagGrad-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.accentColor} />
            <stop offset="50%" stopColor={config.bagColor} />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
          <radialGradient id={`bellyGlow-${value}`} cx="45%" cy="55%" r="60%">
            <stop offset="0%" stopColor={config.accentColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={config.bagColor} stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {/* Shadow */}
        <ellipse cx="50" cy="94" rx="34" ry="5" fill="rgba(0,0,0,0.45)" />

        {/* Bag body */}
        <path
          d="M 28,42 C 20,68 18,90 38,94 C 50,96 70,96 82,94 C 98,90 96,68 88,42 C 84,36 74,38 70,39 C 64,40 56,40 46,39 C 42,38 32,36 28,42 Z"
          fill={`url(#bagGrad-${value})`}
          stroke="#c9a227"
          strokeWidth="1.8"
        />

        {/* Belly highlight */}
        <ellipse cx="46" cy="68" rx="24" ry="18" fill={`url(#bellyGlow-${value})`} />

        {/* Top frill / pleated neck */}
        <path
          d="M 33,36 C 26,22 36,15 48,17 C 54,19 64,19 72,17 C 82,15 92,22 83,36 Z"
          fill={config.bagColor}
          stroke="#c9a227"
          strokeWidth="1.6"
        />

        {/* Gold rope tie around neck */}
        <ellipse cx="58" cy="38" rx="24" ry="4" fill="none" stroke="#f6e27a" strokeWidth="3" />
        <ellipse cx="58" cy="38" rx="22" ry="3.5" fill="none" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="3 2" />

        {/* Hanging rope ends */}
        <path d="M 68,39 C 72,46 75,52 72,56" fill="none" stroke="#f6e27a" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 66,40 C 69,47 70,51 68,54" fill="none" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />

        {/* Central emblem seal */}
        <circle cx="58" cy="68" r="16" fill="#141416" stroke="#f6e27a" strokeWidth="1.8" />
        <circle cx="58" cy="68" r="13.5" fill="none" stroke="#c9a227" strokeWidth="0.8" strokeDasharray="2 1.5" />

        {/* Denomination text */}
        <text
          x="58"
          y="72"
          textAnchor="middle"
          fill="#f6e27a"
          fontSize="11"
          fontWeight="900"
          fontFamily="'Cinzel', serif"
          letterSpacing="0.5"
        >
          {config.label}
        </text>
      </svg>

      {/* Count badge if stacked */}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f6e27a] px-1 text-[10px] font-black text-[#1a1405] shadow-lg ring-2 ring-black">
          ×{count}
        </span>
      )}
    </div>
  )
}

function Panel({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel-noir rounded-xl p-4 sm:p-5 ${className}`}>
      <div className="mb-4">
        <p className="text-[9px] tracking-[0.35em] text-[#8a7a4d]">{eyebrow ?? 'GOLDEN FELT BANK'}</p>
        <h2 className="font-display gold-text mt-1 text-lg font-bold tracking-[0.15em]">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function Bank() {
  const wallet = useChips()
  const player = usePlayer()
  const [borrowAmount, setBorrowAmount] = useState('')
  const [repayAmount, setRepayAmount] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Money bags tally state: count of each bag currently selected
  const [bagCounts, setBagCounts] = useState<{ 10000: number; 25000: number; 50000: number }>({
    10000: 0,
    25000: 0,
    50000: 0,
  })

  // Gift section state
  const [selectedGiftUser, setSelectedGiftUser] = useState<GiftUser>('Kierash')
  const [giftPassword, setGiftPassword] = useState('')
  const [giftError, setGiftError] = useState('')
  const [giftMessage, setGiftMessage] = useState('')

  const LIFETIME_CLAIM_PREFIX = 'gf-gift-lifetime-redeemed:'

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    return localStorage.getItem('gf-great-admin-unlocked') === 'true'
  })
  const [adminKey, setAdminKey] = useState(0)

  function isLifetimeRedeemed(user: 'Kierash' | 'Nik'): boolean {
    return localStorage.getItem(LIFETIME_CLAIM_PREFIX + user) === 'true'
  }

  function setLifetimeRedeemed(user: 'Kierash' | 'Nik', val: boolean) {
    if (val) {
      localStorage.setItem(LIFETIME_CLAIM_PREFIX + user, 'true')
    } else {
      localStorage.removeItem(LIFETIME_CLAIM_PREFIX + user)
    }
    setAdminKey((k) => k + 1)
  }

  const debt = wallet.loan?.balance ?? 0
  const loanLimit = wallet.loanLimit ?? 250000
  const availableBorrow = Math.max(0, loanLimit - debt)

  // Current amount calculated from bags or manual input (fixed typo: 50000 instead of 5000)
  const bagTotal = (bagCounts[10000] || 0) * 10000 + (bagCounts[25000] || 0) * 25000 + (bagCounts[50000] || 0) * 50000
  const effectiveBorrowAmount = borrowAmount ? parseInt(borrowAmount.replace(/,/g, ''), 10) || 0 : bagTotal

  const addBag = (val: BagValue) => {
    const nextTotal = bagTotal + val
    if (nextTotal > availableBorrow) {
      setError(`Cannot exceed your credit limit of ${fmt(loanLimit)} chips (remaining: ${fmt(availableBorrow)}).`)
      return
    }
    setError('')
    const nextCounts = { ...bagCounts, [val]: (bagCounts[val] || 0) + 1 }
    setBagCounts(nextCounts)
    setBorrowAmount(String(nextTotal))
    sfx.chip()
  }

  const clearBags = () => {
    setBagCounts({ 10000: 0, 25000: 0, 50000: 0 })
    setBorrowAmount('')
    setError('')
  }

  const handleBorrow = () => {
    const amount = effectiveBorrowAmount
    if (!Number.isFinite(amount) || amount < MIN_LOAN) {
      setError(`Minimum loan is ${fmt(MIN_LOAN)} chips. Select money bags to reach at least ${fmt(MIN_LOAN)}.`)
      return
    }
    if (amount > availableBorrow) {
      setError(`Maximum you can borrow right now is ${fmt(availableBorrow)} chips (debt limit is ${fmt(loanLimit)}).`)
      return
    }
    const ok = wallet.borrow(amount)
    if (ok) {
      setError('')
      setMessage(`Loan of ${fmt(amount)} chips approved and credited to your balance!`)
      setBorrowAmount('')
      setBagCounts({ 10000: 0, 25000: 0, 50000: 0 })
      sfx.coin()
    } else {
      setError('Could not process loan. You may have exceeded your limit.')
    }
  }

  const handleRepay = () => {
    const amount = parseInt(repayAmount.replace(/,/g, ''), 10)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid repayment amount.')
      return
    }
    if (!wallet.loan) {
      setError('You have no active loan.')
      return
    }
    const effectiveMin = wallet.loan.balance < MIN_REPAY ? wallet.loan.balance : MIN_REPAY
    if (amount < effectiveMin) {
      setError(`Minimum repayment is ${fmt(MIN_REPAY)} chips. Your remaining debt is ${fmt(wallet.loan.balance)} chips${wallet.loan.balance < MIN_REPAY ? ' — you can pay it off in full.' : '.'}`)
      return
    }
    if (amount > wallet.balance) {
      setError(`You only have ${fmt(wallet.balance)} chips available.`)
      return
    }
    const paid = wallet.repay(amount)
    if (paid > 0) {
      setError('')
      const remaining = Math.max(0, (wallet.loan?.balance ?? 0) - paid)
      if (remaining === 0) {
        const nextLimit = loanLimit < 500000 ? 500000 : loanLimit < 1000000 ? 1000000 : 1000000
        setMessage(`🎉 Debt fully paid off! Your credit limit has been upgraded to ${fmt(nextLimit)} chips!`)
      } else {
        setMessage(`Repaid ${fmt(paid)} chips. Remaining debt: ${fmt(remaining)}.`)
      }
      setRepayAmount('')
      sfx.coin()
    } else if (paid === -1) {
      setError(`Minimum repayment is ${fmt(MIN_REPAY)} chips.`)
    } else {
      setError('Repayment failed. Check your balance.')
    }
  }

  const freePackageCoolingDown = Date.now() - wallet.lastFreePackageAt < 24 * 60 * 60 * 1000

  const handleFreePackage = () => {
    if (wallet.balance > 0) {
      setError('Free package only available when you have 0 chips.')
      return
    }
    const ok = wallet.claimFreePackage()
    if (ok) {
      setError('')
      setMessage(`Emergency package of ${fmt(FREE_PACKAGE_AMOUNT)} chips credited to your account!`)
      sfx.coin()
    } else {
      setError('Free package already claimed today, or you have chips remaining.')
    }
  }

  const handleGiftRedeem = () => {
    setGiftError('')
    setGiftMessage('')
    const cfg = GIFT_CONFIGS[selectedGiftUser]
    if (giftPassword !== cfg.password) {
      setGiftError('Incorrect password. Access denied.')
      return
    }

    if (selectedGiftUser === 'Kierash' || selectedGiftUser === 'Nik') {
      if (isLifetimeRedeemed(selectedGiftUser)) {
        setGiftError(`❌ ${selectedGiftUser}'s bonus has already been redeemed! This is a one-time bonus that only The Great Admin can reset.`)
        return
      }
      wallet.credit(cfg.reward)
      setLifetimeRedeemed(selectedGiftUser, true)
      setGiftPassword('')
      setGiftMessage(`🎉 ${selectedGiftUser}'s bonus of ${fmt(cfg.reward)} chips has been credited! (One-time bonus claimed)`)
      sfx.coin()
      return
    }

    if (selectedGiftUser === 'ADMIN') {
      wallet.credit(cfg.reward)
      setIsAdminUnlocked(true)
      localStorage.setItem('gf-great-admin-unlocked', 'true')
      setGiftPassword('')
      setGiftMessage(`👑 Welcome The Great Admin! +${fmt(cfg.reward)} chips credited! Infinite cash reserves & bonus controls are active.`)
      sfx.coin()
    }
  }

  const handleAdminResetKierash = () => {
    setLifetimeRedeemed('Kierash', false)
    setGiftMessage("👑 Great Admin reset Kierash's bonus! It can now be claimed again.")
    setGiftError('')
    sfx.coin()
  }

  const handleAdminResetNik = () => {
    setLifetimeRedeemed('Nik', false)
    setGiftMessage("👑 Great Admin reset Nik's bonus! It can now be claimed again.")
    setGiftError('')
    sfx.coin()
  }

  const handleAdminInfiniteCash = (amount = 10000000) => {
    wallet.credit(amount)
    setMessage(`👑 Infinite Cash Injection: +${fmt(amount)} chips credited to your vault! Sitting on infinite cash reserves.`)
    sfx.coin()
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <div className="mb-6 text-center">
        <p className="text-[10px] tracking-[0.4em] text-[#b3a06b]">GOLDEN FELT FINANCIAL SERVICES</p>
        <h1 className="font-display gold-text-bright mt-2 text-3xl font-black tracking-[0.18em] sm:text-4xl">THE BANK</h1>
        <p className="mt-2 text-[13px] text-[#a89872]">Loans, emergency packages and special gifts · {player.activeName}</p>
        <div className="divider-gold mx-auto mt-3 w-48" />
      </div>

      {(error || message) && (
        <div role="status" className={`mb-5 rounded-xl border px-5 py-3.5 text-center text-[13px] font-medium shadow-lg backdrop-blur-md ${error ? 'border-[#d4002a]/70 bg-[#2a050a]/85 text-[#ff97a3]' : 'border-[#c9a227]/60 bg-[#2a2105]/85 text-[#f6e27a]'}`}>
          {error || message}
        </div>
      )}

      {/* Credit Standing & Stats Header */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/20">
          <div className="text-[9px] tracking-[0.3em] text-[#8a7a4d]">AVAILABLE CHIPS</div>
          <div className="font-display mt-1 text-2xl font-bold text-[#f6e27a]">{fmt(wallet.balance)}</div>
        </div>
        <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/20">
          <div className="text-[9px] tracking-[0.3em] text-[#8a7a4d]">CURRENT DEBT</div>
          <div className={`font-display mt-1 text-2xl font-bold ${debt > 0 ? 'text-[#ff97a3]' : 'text-[#86efac]'}`}>
            {debt > 0 ? fmt(debt) : 'Zero Debt'}
          </div>
        </div>
        <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/20">
          <div className="text-[9px] tracking-[0.3em] text-[#8a7a4d]">CREDIT CEILING</div>
          <div className="font-display mt-1 text-2xl font-bold text-[#f6e27a]">{fmt(loanLimit)}</div>
        </div>
        <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/20">
          <div className="text-[9px] tracking-[0.3em] text-[#8a7a4d]">AVAILABLE TO BORROW</div>
          <div className="font-display mt-1 text-2xl font-bold text-[#67e8f9]">{fmt(availableBorrow)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ===================== REVAMPED COLORFUL LOANS BOX ===================== */}
        <section className="relative overflow-hidden rounded-2xl border-2 border-[#f59e0b]/50 bg-gradient-to-br from-[#120f04] via-[#1c1505] to-[#090803] p-5 shadow-[0_0_30px_rgba(245,158,11,0.15)] sm:p-6 lg:col-span-2">
          {/* Ambient colorful glow orbs */}
          <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-[#10b981]/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-[#6366f1]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 left-1/3 h-52 w-52 rounded-full bg-[#f59e0b]/15 blur-3xl" />

          {/* Header */}
          <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#f59e0b]/20 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-2 py-0.5 text-[9px] font-black tracking-[0.2em] text-[#140b02]">
                  VAULT CREDIT
                </span>
                <span className="text-[10px] tracking-[0.25em] text-[#a89872]">0% INTEREST LOANS</span>
              </div>
              <h2 className="font-display mt-1 text-2xl font-black tracking-[0.12em] text-[#fff4d1] sm:text-3xl">
                TAKE A MONEY BAG LOAN
              </h2>
            </div>
            
            {/* Credit Tier Badges */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#f59e0b]/30 bg-black/50 p-1.5">
              {[
                { tier: 'TIER 1', limit: 250000, label: '250K' },
                { tier: 'TIER 2', limit: 500000, label: '500K' },
                { tier: 'CEILING', limit: 1000000, label: '1M' },
              ].map((t) => {
                const isCurrent = loanLimit === t.limit
                const isPassed = loanLimit > t.limit
                return (
                  <div
                    key={t.tier}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                      isCurrent
                        ? 'border border-[#f59e0b] bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-[#140b02] shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                        : isPassed
                        ? 'bg-[#10b981]/20 text-[#86efac] border border-[#10b981]/40'
                        : 'bg-black/40 text-[#6b5f42]'
                    }`}
                  >
                    {isPassed && <CheckCircle2 size={10} />}
                    <span>{t.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Loan Limit & Debt Bar */}
          <div className="relative mb-6 rounded-xl border border-[#c9a227]/30 bg-black/40 p-3.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#a89872]">
                Debt: <strong className={debt > 0 ? 'text-[#ff97a3]' : 'text-[#86efac]'}>{fmt(debt)}</strong> / {fmt(loanLimit)} Limit
              </span>
              <span className="font-semibold text-[#67e8f9]">
                Remaining Available: {fmt(availableBorrow)}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/70 ring-1 ring-[#c9a227]/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#10b981] via-[#f59e0b] to-[#ef4444] transition-all duration-500"
                style={{ width: `${Math.min(100, (debt / loanLimit) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[#8a7a4d]">
              Level Up: Repay your debt completely to increase your loan limit from 250K → 500K → 1M ceiling.
            </p>
          </div>

          {/* Interactive Money Bags Tray */}
          <div className="relative mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#f59e0b]">
                TAP MONEY BAGS TO ADD TO LOAN
              </span>
              {bagTotal > 0 && (
                <button
                  onClick={clearBags}
                  className="text-[10px] tracking-[0.15em] text-[#ff97a3] underline hover:text-white"
                >
                  CLEAR BAGS ({fmt(bagTotal)})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {BAG_CONFIGS.map((bag) => {
                const count = bagCounts[bag.value]
                const canAffordBag = bagTotal + bag.value <= availableBorrow

                return (
                  <button
                    key={bag.value}
                    type="button"
                    onClick={() => addBag(bag.value)}
                    disabled={!canAffordBag}
                    className={`group relative flex flex-col items-center justify-between rounded-xl border p-4 text-center transition-all ${
                      count > 0
                        ? `${bag.border} bg-gradient-to-b ${bag.gradient} ${bag.glow} scale-[1.02]`
                        : `border-[#c9a227]/25 bg-black/50 hover:bg-black/30 ${bag.border}`
                    } ${!canAffordBag ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                  >
                    <div className="text-[10px] font-bold tracking-[0.2em] text-[#a89872]">
                      {bag.title.toUpperCase()}
                    </div>

                    <div className="my-2.5">
                      <MoneyBagSVG value={bag.value} size={70} count={count} />
                    </div>

                    <div className="w-full">
                      <div className="font-display text-xl font-black tracking-wider text-[#fff4d1]">
                        +{fmt(bag.value)}
                      </div>
                      <div className="mt-1 text-[9px] text-[#c9a227] opacity-80 group-hover:opacity-100">
                        {count > 0 ? `${count} bag${count > 1 ? 's' : ''} in stack` : 'Tap to add'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Amount Bar & Action Button */}
          <div className="relative rounded-xl border border-[#f59e0b]/40 bg-gradient-to-r from-black/80 via-[#1e1505]/80 to-black/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <label className="text-[10px] tracking-[0.2em] text-[#a89872]">
                  REQUESTED LOAN AMOUNT (MIN 50,000)
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    value={borrowAmount}
                    onChange={(e) => {
                      setBorrowAmount(e.target.value)
                      setBagCounts({ 10000: 0, 25000: 0, 50000: 0 })
                    }}
                    placeholder={`Enter amount or tap bags (Min ${fmt(MIN_LOAN)})`}
                    min={MIN_LOAN}
                    max={availableBorrow}
                    className="w-full min-h-[46px] rounded-lg border border-[#f59e0b]/50 bg-black/60 px-3.5 font-display text-[17px] font-bold text-[#fef08a] outline-none placeholder:text-[#524528] focus:border-[#fde047]"
                  />
                  {effectiveBorrowAmount > 0 && (
                    <span className="absolute right-3 top-3 text-[11px] font-bold text-[#a89872]">
                      chips
                    </span>
                  )}
                </div>
              </div>

              <div className="sm:w-60">
                <button
                  type="button"
                  onClick={handleBorrow}
                  disabled={effectiveBorrowAmount < MIN_LOAN || effectiveBorrowAmount > availableBorrow}
                  className="w-full min-h-[46px] rounded-lg bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#eab308] px-5 text-[12px] font-black tracking-[0.18em] text-[#1a0f02] shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  BORROW {effectiveBorrowAmount >= MIN_LOAN ? fmt(effectiveBorrowAmount) : ''}
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#f59e0b]/20 pt-3">
              <span className="text-[9px] tracking-[0.2em] text-[#8a7a4d]">QUICK PACKS:</span>
              {[50000, 100000, 150000, 200000, 250000].filter(v => v <= availableBorrow).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setBorrowAmount(String(v))
                    setBagCounts({ 10000: 0, 25000: 0, 50000: 0 })
                  }}
                  className="rounded-full border border-[#f59e0b]/40 bg-black/40 px-3 py-1 text-[10px] font-bold text-[#fde047] transition-colors hover:border-[#fde047] hover:bg-[#2a2105]"
                >
                  {fmt(v)}
                </button>
              ))}
              {availableBorrow > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBorrowAmount(String(availableBorrow))
                    setBagCounts({ 10000: 0, 25000: 0, 50000: 0 })
                  }}
                  className="rounded-full border border-[#67e8f9]/50 bg-[#083344]/40 px-3 py-1 text-[10px] font-bold text-[#67e8f9] transition-colors hover:border-[#67e8f9]"
                >
                  MAX ({fmt(availableBorrow)})
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ===================== REPAY LOAN SECTION ===================== */}
        {wallet.loan && (
          <section className="relative overflow-hidden rounded-2xl border border-[#ef4444]/40 bg-gradient-to-br from-[#1a0508] via-[#140407] to-black p-5 shadow-lg">
            <div className="mb-4">
              <p className="text-[9px] tracking-[0.35em] text-[#f87171]">PAY DOWN YOUR DEBT</p>
              <h2 className="font-display text-xl font-bold tracking-[0.15em] text-[#fee2e2]">REPAY LOAN</h2>
            </div>

            <div className="rounded-xl border border-[#ef4444]/30 bg-black/50 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.2em] text-[#a89872]">CURRENT OUTSTANDING DEBT</div>
                  <div className="font-display mt-0.5 text-2xl font-black text-[#ff97a3]">{fmt(debt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] tracking-[0.2em] text-[#a89872]">MINIMUM PAYMENT</div>
                  <div className="font-display mt-0.5 text-lg font-bold text-[#fde047]">
                    {debt < MIN_REPAY ? `${fmt(debt)} (Pay in full)` : fmt(MIN_REPAY)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder={debt < MIN_REPAY ? `Pay off ${fmt(debt)}` : `Min ${fmt(MIN_REPAY)}`}
                min={debt < MIN_REPAY ? debt : MIN_REPAY}
                max={Math.min(wallet.balance, debt)}
                className="flex-1 min-h-[44px] rounded-lg border border-[#ef4444]/40 bg-black/50 px-3 text-[14px] text-[#fee2e2] outline-none placeholder:text-[#6b5f42] focus:border-[#f87171]"
              />
              <button
                onClick={handleRepay}
                className="min-h-[44px] rounded-lg bg-gradient-to-r from-[#b91c1c] to-[#ef4444] px-5 text-[11px] font-black tracking-wider text-white shadow-md hover:brightness-110 active:scale-95"
              >
                REPAY
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[50000, 100000, 200000].filter(v => v <= Math.min(wallet.balance, debt) && (v >= MIN_REPAY || v === debt)).map(v => (
                <button
                  key={v}
                  onClick={() => setRepayAmount(String(v))}
                  className="rounded-lg border border-[#ef4444]/30 bg-black/40 px-3 py-1.5 text-[10px] font-semibold text-[#fca5a5] hover:border-[#f87171]"
                >
                  {fmt(v)}
                </button>
              ))}
              {debt > 0 && debt <= wallet.balance && (
                <button
                  onClick={() => setRepayAmount(String(debt))}
                  className="rounded-lg border border-[#f59e0b] bg-gradient-to-r from-[#d97706]/40 to-[#f59e0b]/40 px-3.5 py-1.5 text-[10px] font-black text-[#fef08a] hover:brightness-125"
                >
                  PAY IN FULL ({fmt(debt)})
                </button>
              )}
            </div>
          </section>
        )}

        {/* ===================== EMERGENCY 6K PACKAGE ===================== */}
        <Panel title="EMERGENCY PACKAGE" eyebrow="OUT OF CHIPS?">
          <p className="mb-4 text-[12px] leading-relaxed text-[#b3a06b]">
            If your balance drops to exactly <span className="text-[#f6e27a] font-semibold">0 chips</span>, you can claim a free emergency package of <span className="text-[#f6e27a] font-semibold">{fmt(FREE_PACKAGE_AMOUNT)} chips</span> once per day to get back on your feet.
          </p>
          <div className="rounded-lg border border-[#c9a227]/20 bg-black/25 p-4 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-[#f2e6c9]">Free Starter Package</div>
                <div className="mt-1 text-[11px] text-[#8a7a4d]">{fmt(FREE_PACKAGE_AMOUNT)} chips · Available when balance = 0 · Once per day</div>
              </div>
              <div className="text-2xl">🎁</div>
            </div>
          </div>
          <button
            onClick={handleFreePackage}
            disabled={wallet.balance > 0 || freePackageCoolingDown}
            className="btn-gold w-full min-h-[46px] rounded px-5 text-[11px] disabled:opacity-40"
          >
            {wallet.balance > 0
              ? `YOU HAVE ${fmt(wallet.balance)} CHIPS`
              : freePackageCoolingDown
              ? 'PACKAGE CLAIMED TODAY'
              : `CLAIM ${fmt(FREE_PACKAGE_AMOUNT)} FREE CHIPS`}
          </button>
          <p className="mt-2 text-[10px] text-[#6b5f42]">Only available when your balance is exactly 0. One claim per day.</p>
        </Panel>

        {/* ===================== SPECIAL GIFTS & ADMIN ===================== */}
        <Panel title="SPECIAL GIFTS" eyebrow="OWNER BONUSES · PASSWORD REQUIRED">
          {giftError && (
            <div className="mb-3 rounded border border-[#d4002a]/60 bg-[#2a050a]/70 px-3 py-2 text-[11px] text-[#ff97a3]">{giftError}</div>
          )}
          {giftMessage && (
            <div className="mb-3 rounded border border-[#c9a227]/40 bg-[#2a2105]/70 px-3 py-2 text-[11px] text-[#f6e27a]">{giftMessage}</div>
          )}

          <div className="mb-4">
            <label className="text-[10px] tracking-[0.2em] text-[#b3a06b]">SELECT BONUS PROFILE</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {GIFT_USERS.map((u) => (
                <button
                  key={u}
                  onClick={() => { setSelectedGiftUser(u); setGiftPassword(''); setGiftError(''); setGiftMessage('') }}
                  className={`min-h-[44px] rounded border text-[12px] font-semibold transition-colors ${selectedGiftUser === u ? 'border-[#f6e27a] bg-[#2a2105]/80 text-[#f6e27a]' : 'border-[#c9a227]/30 bg-black/30 text-[#b3a06b] hover:border-[#c9a227]/60'}`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#c9a227]/20 bg-black/25 p-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold text-[#f2e6c9]">{selectedGiftUser}'s Bonus</div>
                <div className="mt-0.5 text-[10px] text-[#8a7a4d]">
                  {fmt(GIFT_CONFIGS[selectedGiftUser].reward)} chips · {GIFT_CONFIGS[selectedGiftUser].unlimited ? 'Infinite claims allowed' : 'One-time bonus (lifetime)'}
                  {selectedGiftUser !== 'ADMIN' && isLifetimeRedeemed(selectedGiftUser as 'Kierash' | 'Nik') && (
                    <span className="ml-2 font-bold text-[#ff97a3]">· REDEEMED (Locked by Great Admin)</span>
                  )}
                </div>
              </div>
              <div className="text-xl">{selectedGiftUser === 'ADMIN' ? '👑' : '🎁'}</div>
            </div>
          </div>

          <div className="mb-3">
            <label className="text-[10px] tracking-[0.2em] text-[#b3a06b]">ACCESS PASSWORD</label>
            <input
              type="password"
              value={giftPassword}
              onChange={(e) => setGiftPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGiftRedeem()}
              placeholder="Enter password…"
              autoComplete="off"
              className="mt-1.5 w-full min-h-[44px] rounded border border-[#c9a227]/40 bg-black/40 px-3 text-[14px] text-[#f2e6c9] outline-none placeholder:text-[#6b5f42] focus:border-[#f6e27a]"
            />
          </div>
          <button
            onClick={handleGiftRedeem}
            disabled={!giftPassword.trim()}
            className="btn-gold w-full min-h-[46px] rounded px-5 text-[11px] disabled:opacity-40"
          >
            REDEEM {selectedGiftUser.toUpperCase()}'S BONUS
          </button>
          <p className="mt-2 text-[10px] text-[#6b5f42]">
            Kierash and Nik are one-time bonuses. The Great Admin holds infinite cash reserves.
          </p>

          {/* THE GREAT ADMIN CONSOLE */}
          {isAdminUnlocked && (
            <div className="mt-6 rounded-xl border-2 border-[#f59e0b] bg-gradient-to-br from-[#1c1305] via-[#2a1d06] to-[#120a02] p-4 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
              <div className="flex items-center justify-between border-b border-[#f59e0b]/30 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👑</span>
                  <div>
                    <div className="font-display text-sm font-black tracking-wider text-[#fef08a]">THE GREAT ADMIN CONSOLE</div>
                    <div className="text-[9px] tracking-widest text-[#f59e0b]">INFINITE CASH RESERVES UNLOCKED</div>
                  </div>
                </div>
                <button
                  onClick={() => { setIsAdminUnlocked(false); localStorage.removeItem('gf-great-admin-unlocked') }}
                  className="rounded border border-[#f59e0b]/40 px-2 py-1 text-[9px] text-[#fde68a] hover:bg-black/50"
                >
                  LOCK CONSOLE
                </button>
              </div>

              {/* Infinite Cash Grants */}
              <div className="mt-3">
                <div className="text-[10px] font-bold tracking-wider text-[#fde68a]">CASH RESERVES INJECTION</div>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAdminInfiniteCash(10000000)}
                    className="rounded-lg bg-gradient-to-r from-[#d97706] to-[#f59e0b] px-3 py-2 text-[10px] font-black text-[#1a0e02] shadow hover:brightness-110 active:scale-95"
                  >
                    +10,000,000 CHIPS
                  </button>
                  <button
                    onClick={() => handleAdminInfiniteCash(50000000)}
                    className="rounded-lg bg-gradient-to-r from-[#b45309] to-[#d97706] px-3 py-2 text-[10px] font-black text-[#fffbeb] shadow hover:brightness-110 active:scale-95"
                  >
                    +50,000,000 CHIPS
                  </button>
                </div>
              </div>

              {/* Bonus Reset Controls */}
              <div className="mt-4 border-t border-[#f59e0b]/20 pt-3">
                <div className="text-[10px] font-bold tracking-wider text-[#fde68a]">RESET ONE-TIME GIFTS</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-[#f59e0b]/20 bg-black/40 p-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#f2e6c9]">Kierash (250k)</span>
                      <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${isLifetimeRedeemed('Kierash') ? 'bg-[#ef4444]/20 text-[#fca5a5]' : 'bg-[#10b981]/20 text-[#86efac]'}`}>
                        {isLifetimeRedeemed('Kierash') ? 'REDEEMED' : 'AVAILABLE'}
                      </span>
                    </div>
                    <button
                      onClick={handleAdminResetKierash}
                      className="rounded border border-[#f59e0b]/60 bg-[#d97706]/30 px-3 py-1 text-[9px] font-black text-[#fef08a] hover:bg-[#d97706]/60 active:scale-95"
                    >
                      RESET BONUS
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-[#f59e0b]/20 bg-black/40 p-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#f2e6c9]">Nik (250k)</span>
                      <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${isLifetimeRedeemed('Nik') ? 'bg-[#ef4444]/20 text-[#fca5a5]' : 'bg-[#10b981]/20 text-[#86efac]'}`}>
                        {isLifetimeRedeemed('Nik') ? 'REDEEMED' : 'AVAILABLE'}
                      </span>
                    </div>
                    <button
                      onClick={handleAdminResetNik}
                      className="rounded border border-[#f59e0b]/60 bg-[#d97706]/30 px-3 py-1 text-[9px] font-black text-[#fef08a] hover:bg-[#d97706]/60 active:scale-95"
                    >
                      RESET BONUS
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>

      </div>

      <div className="mt-8 text-center">
        <p className="text-[10px] tracking-[0.28em] text-[#6b5f42]">ALL TRANSACTIONS ARE FINAL · 0% INTEREST CHARGED · FOR ENTERTAINMENT ONLY</p>
      </div>
    </div>
  )
}
