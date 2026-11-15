import { useEffect, useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { usePlayer } from '../state/profile'
import { sfx } from '../lib/audio'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { fetchGrantRoles, redeemGrant, type GrantRole } from '../lib/supabase'

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
    border: 'border-[#f59e0b]/50 hover:border-[#fde047]',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    textCol: '#fde68a',
    bagColor: '#d97706',
    accentColor: '#fde047',
    badgeBg: '#78350f',
  },
] as const

type BagValue = 10000 | 25000 | 50000

function MoneyBagGraphic({ config, count = 0 }: { config: typeof BAG_CONFIGS[number]; count?: number }) {
  return (
    <div className="relative flex items-center justify-center py-1">
      <svg
        viewBox="0 0 120 120"
        className="h-20 w-20 drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-105"
      >
        <defs>
          <radialGradient id={`bagGrad-${config.value}`} cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor={config.accentColor} />
            <stop offset="60%" stopColor={config.bagColor} />
            <stop offset="100%" stopColor="#0a0502" />
          </radialGradient>
          <linearGradient id={`tieGrad-${config.value}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        <path
          d="M 45 34 C 40 20, 36 12, 43 9 C 48 6, 54 18, 60 17 C 66 18, 72 6, 77 9 C 84 12, 80 20, 75 34 Z"
          fill={config.bagColor}
          stroke="#000"
          strokeWidth="1.5"
        />
        <ellipse cx="60" cy="34" rx="14" ry="4.5" fill="url(#tieGrad-10000)" stroke="#78350f" strokeWidth="1.2" />
        <path d="M 57 37 Q 53 46 51 51 Q 54 48 57 40" fill="none" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />
        <path d="M 63 37 Q 66 45 68 50 Q 65 47 63 40" fill="none" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />

        <path
          d="M 60 36 C 42 36, 22 50, 18 75 C 14 97, 28 114, 60 114 C 92 114, 106 97, 102 75 C 98 50, 78 36, 60 36 Z"
          fill={`url(#bagGrad-${config.value})`}
          stroke="#120a02"
          strokeWidth="2.5"
        />

        <ellipse cx="58" cy="68" rx="18" ry="17" fill="#0f0c05" stroke="#f6e27a" strokeWidth="1.5" />
        <circle cx="58" cy="68" r="13.5" fill="none" stroke="#c9a227" strokeWidth="0.8" strokeDasharray="2 1.5" />

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

  const [bagCounts, setBagCounts] = useState<{ 10000: number; 25000: number; 50000: number }>({
    10000: 0,
    25000: 0,
    50000: 0,
  })

  // Official Starting Grants state
  const [grantRoles, setGrantRoles] = useState<GrantRole[]>([])
  const [selectedRole, setSelectedRole] = useState<GrantRole | null>(null)
  const [rolePasswordInput, setRolePasswordInput] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantError, setGrantError] = useState('')
  const [grantSuccess, setGrantSuccess] = useState('')

  useEffect(() => {
    fetchGrantRoles().then(setGrantRoles)
  }, [])

  const debt = wallet.loan?.balance ?? 0
  const loanLimit = wallet.loanLimit ?? 250000
  const availableBorrow = Math.max(0, loanLimit - debt)

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
      setError(`Minimum repayment is ${fmt(MIN_REPAY)} chips. Your remaining debt is ${fmt(wallet.loan.balance)} chips.`)
      return
    }
    const interest = Math.max(1, Math.ceil(amount * 0.01))
    const totalRequired = amount + interest
    if (totalRequired > wallet.balance) {
      setError(`Repayment requires ${fmt(totalRequired)} chips (${fmt(amount)} debt + ${fmt(interest)} 1% interest fee). You only have ${fmt(wallet.balance)} chips.`)
      return
    }
    const paid = wallet.repay(amount)
    if (paid > 0) {
      setError('')
      const interestPaid = Math.max(1, Math.ceil(paid * 0.01))
      const remaining = Math.max(0, (wallet.loan?.balance ?? 0) - paid)
      if (remaining === 0) {
        const nextLimit = loanLimit < 500000 ? 500000 : 1000000
        setMessage(`🎉 Debt fully paid off! (Paid ${fmt(paid)} debt + ${fmt(interestPaid)} 1% interest). Limit upgraded to ${fmt(nextLimit)} chips!`)
      } else {
        setMessage(`Repaid ${fmt(paid)} debt + ${fmt(interestPaid)} 1% interest. Remaining debt: ${fmt(remaining)}.`)
      }
      setRepayAmount('')
      sfx.coin()
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

  const handleClaimGrant = async () => {
    if (!selectedRole || !rolePasswordInput.trim()) return
    setGrantLoading(true)
    setGrantError('')
    setGrantSuccess('')

    try {
      const res = await redeemGrant(selectedRole.role_name, rolePasswordInput.trim(), player.activeName || '')
      if (res.success && res.chips) {
        wallet.credit(res.chips)
        sfx.coin()
        setGrantSuccess(`👑 Starting Grant of ${fmt(res.chips)} chips credited for ${selectedRole.role_name}!`)
        setGrantRoles((prev) => prev.map((r) => r.role_name === selectedRole.role_name ? { ...r, is_claimed: true } : r))
        setSelectedRole(null)
        setRolePasswordInput('')
      } else {
        setGrantError(res.error || 'Incorrect password. Attempt logged.')
      }
    } catch (err: any) {
      setGrantError(err?.message || 'Verification failed.')
    } finally {
      setGrantLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <div className="mb-6 text-center">
        <p className="text-[10px] tracking-[0.4em] text-[#b3a06b]">GOLDEN FELT FINANCIAL SERVICES</p>
        <h1 className="font-display gold-text-bright mt-2 text-3xl font-black tracking-[0.18em] sm:text-4xl">THE BANK</h1>
        <p className="mt-2 text-[13px] text-[#a89872]">Vault credit, emergency bailout and official starting grants · {player.activeName}</p>
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

        {/* ===================== LOANS BOX ===================== */}
        <section className="relative overflow-hidden rounded-2xl border-2 border-[#f59e0b]/50 bg-gradient-to-br from-[#120f04] via-[#1c1505] to-[#090803] p-5 shadow-[0_0_30px_rgba(245,158,11,0.15)] sm:p-6 lg:col-span-2">
          <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-[#10b981]/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-[#6366f1]/15 blur-3xl" />

          {/* Header */}
          <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#f59e0b]/20 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-2 py-0.5 text-[9px] font-black tracking-[0.2em] text-[#140b02]">
                  VAULT CREDIT
                </span>
                <span className="text-[10px] tracking-[0.25em] text-[#a89872]">1% REPAYMENT INTEREST</span>
              </div>
              <h2 className="font-display mt-1 text-2xl font-black tracking-[0.12em] text-[#fff4d1] sm:text-3xl">
                TAKE A MONEY BAG LOAN
              </h2>
            </div>

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
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      isCurrent
                        ? 'border border-[#f59e0b] bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-[#140b02]'
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

          {/* Debt Progress Bar */}
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
          </div>

          {/* Money Bags Tray */}
          <div className="relative mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.25em] text-[#f59e0b]">
                TAP MONEY BAGS TO ADD TO LOAN
              </span>
              {bagTotal > 0 && (
                <button onClick={clearBags} className="text-[10px] tracking-[0.15em] text-[#ff97a3] underline hover:text-white">
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
                      count > 0 ? `${bag.border} ${bag.glow} bg-black/60 scale-[1.02]` : 'border-[#c9a227]/30 bg-black/35 hover:border-[#f59e0b]/60'
                    } disabled:opacity-30 disabled:hover:scale-100`}
                  >
                    <div className="text-[10px] font-bold tracking-[0.2em]" style={{ color: bag.textCol }}>
                      {bag.title}
                    </div>
                    <MoneyBagGraphic config={bag} count={count} />
                    <div className="font-display mt-2 text-lg font-black tracking-wider text-[#fff4d1]">
                      +{fmt(bag.value)} chips
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[#f59e0b]/20 pt-4">
            <div>
              <div className="text-[10px] tracking-[0.2em] text-[#a89872]">SELECTED BORROW AMOUNT</div>
              <div className="font-display text-2xl font-bold text-[#fde047]">
                {fmt(effectiveBorrowAmount)} <span className="text-sm font-normal text-[#a89872]">chips</span>
              </div>
            </div>
            <button
              onClick={handleBorrow}
              disabled={effectiveBorrowAmount < MIN_LOAN || effectiveBorrowAmount > availableBorrow}
              className="btn-gold min-h-[46px] rounded px-8 text-[12px] font-black tracking-wider disabled:opacity-40"
            >
              TAKE LOAN OF {fmt(effectiveBorrowAmount)}
            </button>
          </div>
        </section>

        {/* ===================== REPAY DEBT ===================== */}
        <Panel title="REPAY VAULT DEBT" eyebrow="DEBT CLEARANCE">
          <p className="mb-4 text-[12px] leading-relaxed text-[#b3a06b]">
            All repayments incur an extra <span className="text-[#f6e27a] font-semibold">1% interest fee</span> paid to the casino vault. Minimum repayment: 50,000 chips.
          </p>
          <div className="mb-4">
            <label htmlFor="repay-amount" className="text-[10px] tracking-[0.2em] text-[#b3a06b]">REPAYMENT AMOUNT (DEBT)</label>
            <input
              id="repay-amount"
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              placeholder="Chips to repay…"
              className="mt-1.5 w-full min-h-[44px] rounded border border-[#c9a227]/40 bg-black/40 px-3 text-[14px] text-[#f2e6c9] outline-none focus:border-[#f6e27a]"
            />
            {parseInt(repayAmount, 10) > 0 && (
              <div className="mt-2 rounded border border-[#f59e0b]/30 bg-black/50 p-2.5 text-[11px] text-[#fde047]">
                <div>Principal: <strong>{fmt(parseInt(repayAmount, 10))}</strong> chips</div>
                <div>1% Interest Fee: <strong>+{fmt(Math.max(1, Math.ceil(parseInt(repayAmount, 10) * 0.01)))}</strong> chips</div>
                <div className="border-t border-[#f59e0b]/20 mt-1 pt-1 font-bold text-[#86efac]">
                  Total debited: {fmt(parseInt(repayAmount, 10) + Math.max(1, Math.ceil(parseInt(repayAmount, 10) * 0.01)))} chips
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleRepay}
            disabled={!wallet.loan || wallet.loan.balance <= 0}
            className="btn-gold w-full min-h-[46px] rounded px-5 text-[11px] disabled:opacity-40"
          >
            REPAY DEBT (+ 1% INTEREST)
          </button>
        </Panel>

        {/* ===================== EMERGENCY 6K PACKAGE ===================== */}
        <Panel title="EMERGENCY PACKAGE" eyebrow="OUT OF CHIPS?">
          <p className="mb-4 text-[12px] leading-relaxed text-[#b3a06b]">
            If your balance drops to exactly <span className="text-[#f6e27a] font-semibold">0 chips</span>, you can claim an emergency starter package of <span className="text-[#f6e27a] font-semibold">{fmt(FREE_PACKAGE_AMOUNT)} chips</span> once per day.
          </p>
          <div className="rounded-lg border border-[#c9a227]/20 bg-black/25 p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-[#f2e6c9]">Free Starter Package</div>
                <div className="mt-1 text-[11px] text-[#8a7a4d]">{fmt(FREE_PACKAGE_AMOUNT)} chips · 0 balance required · Once per day</div>
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
        </Panel>

        {/* ===================== ROLES & STARTING GRANTS ===================== */}
        <Panel title="PLAYER ROLES & STARTING GRANTS" eyebrow="OFFICIAL ROSTER · SERVER VERIFIED" className="lg:col-span-2">
          <p className="mb-4 text-[12px] leading-relaxed text-[#b3a06b]">
            Starting grants for recognized house figures. Grants are strictly one-time and lock permanently to the claimant's account upon server-side password verification.
          </p>

          {grantError && (
            <div className="mb-4 rounded-xl border border-red-500/50 bg-red-950/70 p-3.5 text-center text-[12px] font-semibold text-red-300">
              {grantError}
            </div>
          )}

          {grantSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-500/50 bg-emerald-950/70 p-3.5 text-center text-[12px] font-semibold text-emerald-300">
              {grantSuccess}
            </div>
          )}

          {/* Roster Cards Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {grantRoles.map((role) => {
              const isSelected = selectedRole?.role_name === role.role_name
              return (
                <div
                  key={role.role_name}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                    role.is_claimed
                      ? 'border-[#3f3f46]/40 bg-black/30 opacity-60'
                      : isSelected
                      ? 'border-[#f6e27a] bg-[#2a2105]/80 shadow-[0_0_15px_rgba(246,226,122,0.3)]'
                      : 'border-[#c9a227]/30 bg-black/40 hover:border-[#c9a227]/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-[#f6e27a]/15 border border-[#f6e27a]/40 px-2 py-0.5 text-[8px] font-black tracking-widest text-[#f6e27a] uppercase">
                        {role.title}
                      </span>
                      {role.is_claimed ? (
                        <span className="rounded bg-red-900/40 border border-red-600/40 px-1.5 py-0.5 text-[8px] font-black text-red-300">
                          CLAIMED
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-900/40 border border-emerald-600/40 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
                          AVAILABLE
                        </span>
                      )}
                    </div>
                    <div className="font-display mt-2 text-lg font-bold text-[#f2e6c9]">
                      {role.role_name}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-[#86efac]">
                      +{fmt(role.grant_chips)} chips
                    </div>
                  </div>

                  <div className="mt-4">
                    {role.is_claimed ? (
                      <div className="text-center text-[10px] text-[#6b5f42]">One-time grant claimed</div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedRole(role)
                          setRolePasswordInput('')
                          setGrantError('')
                          setGrantSuccess('')
                          sfx.click()
                        }}
                        className={`w-full rounded py-1.5 text-[10px] font-black tracking-wider transition-all ${
                          isSelected ? 'btn-gold shadow-md' : 'btn-ghost-gold'
                        }`}
                      >
                        REDEEM GRANT
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Secure Claim Dialog */}
          {selectedRole && (
            <div className="mt-6 rounded-xl border-2 border-[#f6e27a]/60 bg-gradient-to-br from-[#1c1405] via-[#241a06] to-[#0f0b02] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#c9a227]/30 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-[#f6e27a]" />
                  <span className="font-display text-sm font-black tracking-wider text-[#fef08a]">
                    VERIFY {selectedRole.role_name.toUpperCase()} GRANT
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRole(null)}
                  className="text-xs text-[#a89872] hover:text-white"
                >
                  ✕ CANCEL
                </button>
              </div>

              <div className="mt-4">
                <p className="text-[12px] text-[#b3a06b]">
                  Enter the secure grant password to permanently credit <strong>{fmt(selectedRole.grant_chips)} chips</strong> to your account:
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={rolePasswordInput}
                    onChange={(e) => setRolePasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleClaimGrant()}
                    placeholder="Enter grant password…"
                    autoComplete="off"
                    className="flex-1 min-h-[44px] rounded-lg border border-[#c9a227]/50 bg-black/60 px-3.5 text-[14px] text-[#f2e6c9] outline-none focus:border-[#f6e27a]"
                  />
                  <button
                    onClick={handleClaimGrant}
                    disabled={!rolePasswordInput.trim() || grantLoading}
                    className="btn-gold min-h-[44px] rounded-lg px-6 text-[11px] font-black tracking-wider disabled:opacity-40"
                  >
                    {grantLoading ? 'VERIFYING...' : 'CONFIRM & REDEEM'}
                  </button>
                </div>
                <p className="mt-2 text-[9px] text-[#6b5f42]">
                  Verification runs server-side in a security definer RPC. Passwords are never validated in the browser or exposed to the client.
                </p>
              </div>
            </div>
          )}
        </Panel>

      </div>

      <div className="mt-8 text-center">
        <p className="text-[10px] tracking-[0.28em] text-[#6b5f42]">ALL TRANSACTIONS ARE FINAL · PLAY RESPONSIBLY</p>
      </div>
    </div>
  )
}
