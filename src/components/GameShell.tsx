import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ShoppingBag, Volume2, VolumeX, Banknote, Trophy, Dices, Building2, Crown } from 'lucide-react'
import { useChips, fmt } from '../state/chips'
import { usePlayer } from '../state/profile'
import { sfx, setMuted, isMuted } from '../lib/audio'
import { Chip } from './Chip'
import { Nametag } from './Nametag'
import { ITEMS_BY_ID, msUntilClaim, useNow, useShop } from '../state/shop'

export type Screen = 'lobby' | 'shop' | 'properties' | 'club' | 'bank' | 'leaderboard' | 'blackjack' | 'roulette' | 'slots' | 'craps' | 'poker' | 'baccarat' | 'sicbo' | 'war' | 'highlow' | 'keno' | 'rocket' | 'wheel' | 'dice' | 'coinflip'
export type GameId = Exclude<Screen, 'lobby' | 'shop' | 'properties' | 'club' | 'bank' | 'leaderboard'>

export const GAME_META: Record<GameId, { title: string; tagline: string; felt: string }> = {
  blackjack: { title: 'Blackjack', tagline: 'Beat the dealer to 21', felt: 'felt-green' },
  roulette: { title: 'Roulette', tagline: 'European single-zero wheel', felt: 'felt-noir' },
  slots: { title: 'Grand Slots', tagline: 'Three reels of fortune', felt: 'felt-red' },
  craps: { title: 'Craps', tagline: 'Roll the bones', felt: 'felt-red' },
  poker: { title: 'Poker Room', tagline: 'Five ways to play', felt: 'felt-green' },
  baccarat: { title: 'Baccarat', tagline: 'Player, Banker or Tie', felt: 'felt-green' },
  sicbo: { title: 'Sic Bo', tagline: 'Three dice, many bets', felt: 'felt-red' },
  war: { title: 'Casino War', tagline: 'High card wins', felt: 'felt-green' },
  highlow: { title: 'High-Low', tagline: 'Higher or lower?', felt: 'felt-noir' },
  keno: { title: 'Keno', tagline: 'Pick your numbers', felt: 'felt-red' },
  rocket: { title: 'Rocket Crash', tagline: 'Admin Pre-Release · Cash out before liftoff explodes', felt: 'felt-noir' },
  wheel: { title: 'Lucky Wheel', tagline: 'Admin Pre-Release · Multiplier Wheel (10x, 5x, 2x, 1.5x)', felt: 'felt-noir' },
  dice: { title: 'Lucky Dice', tagline: 'Admin Pre-Release · High or Low 1.95x', felt: 'felt-red' },
  coinflip: { title: 'Coin Flip', tagline: 'Admin Pre-Release · Heads or Tails 1.95x', felt: 'felt-noir' },
}

/* ---------- Header ---------- */

export function Header({ onHome, onShop, onProperties, onClub, onBank, onLeaderboard, screen, playerName }: { onHome: () => void; onShop: () => void; onProperties: () => void; onClub: () => void; onBank: () => void; onLeaderboard: () => void; screen: Screen; playerName: string }) {
  const { balance, storageError: walletStorageError } = useChips()
  const { players, switchPlayer, startNewPlayer } = usePlayer()
  const { lastClaim, storageError: shopStorageError } = useShop()
  const now = useNow(15000)
  const giftReady = msUntilClaim(lastClaim, now) === 0
  const [muted, setMutedState] = useState(isMuted())
  const isGame = screen !== 'lobby' && screen !== 'shop' && screen !== 'properties' && screen !== 'club' && screen !== 'bank' && screen !== 'leaderboard'

  const toggleMute = () => {
    const m = !muted
    setMuted(m)
    setMutedState(m)
    if (!m) sfx.click()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#c9a227]/25 bg-[#0a0a0c]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 sm:gap-2.5 px-3 sm:px-4">
        {isGame && (
          <button
            onClick={() => { sfx.click(); onHome() }}
            className="btn-ghost-gold flex items-center gap-1 shrink-0 rounded px-2 py-1 text-[10px]"
          >
            <ArrowLeft size={12} /> CASINO
          </button>
        )}
        <button onClick={() => { sfx.click(); onHome() }} className="flex items-center gap-1.5 shrink-0" title="Golden Felt Casino">
          <MiniSeal size={22} />
          <span className="font-display gold-text hidden text-[11px] font-bold tracking-[0.12em] md:inline">GOLDEN FELT</span>
        </button>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {(walletStorageError || shopStorageError) && <span title={walletStorageError || shopStorageError} className="rounded border border-[#d4002a]/60 bg-[#2a050a]/70 px-1.5 py-0.5 text-[8px] font-bold text-[#ff97a3]">SAVE ISSUE</span>}
          <div className="flex items-center gap-1.5 rounded-full border border-[#c9a227]/40 bg-black/50 py-0.5 pl-1 pr-2.5 shrink-0">
            <Chip value={1000} size={22} label="GF" />
            <span className="font-display text-[13px] font-bold text-[#f6e27a] tabular-nums">{fmt(balance)}</span>
          </div>
          <button
            onClick={() => { sfx.click(); onHome() }}
            className={`btn-ghost-gold relative flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] shrink-0 ${screen === 'lobby' ? 'border-[#f6e27a]/80 bg-[#2a2105]/60 text-[#f6e27a]' : ''}`}
            aria-label="Casino Floor"
          >
            <Dices size={13} /><span className="hidden sm:inline">CASINO</span>
          </button>
          <button
            onClick={() => { sfx.click(); onShop() }}
            className={`btn-ghost-gold relative flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] shrink-0 ${screen === 'shop' ? 'border-[#f6e27a]/80 bg-[#2a2105]/60 text-[#f6e27a]' : ''}`}
            aria-label={giftReady ? 'Shop (daily gift ready)' : 'Shop'}
          >
            <ShoppingBag size={13} />
            <span className="hidden sm:inline">SHOP</span>
            {giftReady && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#f6e27a] pulse-soft" />}
          </button>
          <button
            onClick={() => { sfx.click(); onProperties() }}
            className={`btn-ghost-gold relative flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] shrink-0 ${screen === 'properties' ? 'border-[#f6e27a]/80 bg-[#2a2105]/60 text-[#f6e27a]' : ''}`}
            aria-label="Properties and Stake"
          >
            <Building2 size={13} /><span className="hidden sm:inline">PROPERTIES</span>
          </button>
          <button
            onClick={() => { sfx.click(); onClub() }}
            className={`btn-ghost-gold relative flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] shrink-0 ${screen === 'club' ? 'border-[#f6e27a]/80 bg-[#2a2105]/60 text-[#f6e27a]' : ''}`}
            aria-label="High Rollers Club"
          >
            <Crown size={13} /><span className="hidden sm:inline">CLUB</span>
          </button>
          <button
            onClick={() => { sfx.click(); onBank() }}
            className={`btn-ghost-gold relative flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] shrink-0 ${screen === 'bank' ? 'border-[#f6e27a]/80 bg-[#2a2105]/60 text-[#f6e27a]' : ''}`}
            aria-label="Open the bank"
          >
            <Banknote size={13} /><span className="hidden sm:inline">BANK</span>
          </button>
          <button
            onClick={() => { sfx.click(); onLeaderboard() }}
            className={`btn-ghost-gold relative flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] shrink-0 ${screen === 'leaderboard' ? 'border-[#f6e27a]/80 bg-[#2a2105]/60 text-[#f6e27a]' : ''}`}
            aria-label="Open leaderboard"
          >
            <Trophy size={13} /><span className="hidden sm:inline">RANKS</span>
          </button>
          {/* Player Nametag & Identity */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <Nametag compact />
            {players.length > 1 && (
              <select
                id="switch-player"
                value={playerName}
                onChange={(e) => { switchPlayer(e.target.value); sfx.click() }}
                aria-label="Switch player"
                className="max-w-[75px] min-h-[30px] rounded border border-[#c9a227]/35 bg-black/60 px-1 text-[9px] text-[#f2e6c9] outline-none shrink-0"
              >
                {players.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            <button onClick={() => { sfx.click(); startNewPlayer() }} title="Add or switch to a new player" aria-label="Add new player" className="btn-ghost-gold rounded px-1.5 py-1 text-[9px] shrink-0">+</button>
          </div>
          <button
            onClick={toggleMute}
            className="btn-ghost-gold rounded-full p-1.5 shrink-0"
            aria-label="Toggle sound"
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>
      </div>
    </header>
  )
}

/* ---------- Rotating seal ---------- */

export function MiniSeal({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <circle cx="50" cy="50" r="47" fill="none" stroke="#c9a227" strokeWidth="2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#c9a227" strokeWidth="1" strokeDasharray="3 4" />
      <text x="50" y="55" textAnchor="middle" dominantBaseline="central" fill="#d4af37" fontSize="30" fontFamily="'Cinzel', serif" fontWeight="700">GF</text>
    </svg>
  )
}

export function RotatingSeal({ size = 130 }: { size?: number }) {
  const text = 'GOLDEN FELT · EST. MMXXVI · FINE GAMING · '
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="seal-rotate absolute inset-0">
        <defs>
          <path id="seal-circle" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
        </defs>
        <circle cx="50" cy="50" r="48" fill="none" stroke="#c9a227" strokeWidth="0.8" opacity="0.6" />
        <text fill="#d4af37" fontSize="7.2" letterSpacing="1.6" fontFamily="'Cinzel', serif">
          <textPath href="#seal-circle">{text}</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#c9a227" strokeWidth="2.5" />
          <text x="50" y="53" textAnchor="middle" dominantBaseline="central" fill="#d4af37" fontSize="34" fontFamily="'Cinzel', serif" fontWeight="700">GF</text>
        </svg>
      </div>
    </div>
  )
}

/* ---------- Game page shell ---------- */

export function GameShell({
  screen,
  children,
  side,
  title,
  tagline,
  top,
}: {
  screen: GameId
  children: ReactNode
  side?: ReactNode
  /** Override the page title (used by the poker room, which hosts several games). */
  title?: string
  tagline?: string
  /** Extra content between the title and the table (e.g. game tabs). */
  top?: ReactNode
}) {
  const meta = GAME_META[screen]
  const { equipped } = useShop()
  const feltCss = ITEMS_BY_ID[equipped.felt]?.css || meta.felt
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <div className="mb-5 text-center">
        <h1 className="font-display gold-text text-3xl font-bold tracking-[0.2em] sm:text-4xl">{(title ?? meta.title).toUpperCase()}</h1>
        <p className="mt-1 text-[13px] tracking-[0.25em] text-[#b3a06b] uppercase">{tagline ?? meta.tagline}</p>
        <div className="divider-gold mx-auto mt-3 w-48" />
      </div>
      {top && <div className="mb-4">{top}</div>}
      <div className={`felt-texture ${feltCss} gold-frame relative rounded-2xl p-4 sm:p-6`}>
        {children}
      </div>
      {side && <div className="mt-4">{side}</div>}
    </div>
  )
}

/* ---------- Result banner ---------- */

export function ResultBanner({
  result,
}: {
  result: { kind: 'win' | 'lose' | 'push'; title: string; detail?: string; amount?: number } | null
}) {
  const { lastDebtService, recordLoss } = useChips()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!result) { setVisible(false); return }
    setVisible(true)
    if (result.kind === 'lose') recordLoss()
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [result, recordLoss])
  if (!result || !visible) return null
  const styles = {
    win: 'border-[#f6e27a] bg-[#2a2105]/95 text-[#f6e27a] win-glow-anim',
    lose: 'border-[#d4002a] bg-[#2a050a]/95 text-[#ff97a3]',
    push: 'border-[#b3a06b] bg-[#1c1a14]/95 text-[#e8dcb8]',
  }[result.kind]
  return (
    <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss result" className={`banner-pop-anim absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-8 py-5 text-center shadow-2xl ${styles}`}>
      <div className="font-display text-2xl font-bold tracking-[0.15em] sm:text-3xl">{result.title}</div>
      {result.detail && <div className="mt-1 text-sm tracking-wide opacity-90">{result.detail}</div>}
      {result.amount !== undefined && result.amount > 0 && <div className="font-display mt-2 text-xl font-bold tabular-nums">+{fmt(result.amount)}</div>}
      {lastDebtService > 0 && result.kind === 'win' && <div className="mt-2 text-[11px] font-semibold">30% of your winnings went to your debt · {fmt(lastDebtService)} paid</div>}
      <div className="mt-2 text-[9px] tracking-[0.2em] opacity-50">TAP TO DISMISS</div>
    </button>
  )
}

/* ---------- Gold particle burst ---------- */

export function GoldBurst({ trigger }: { trigger: number }) {
  const [parts, setParts] = useState<{ id: number; dx: number; dy: number; s: number }[]>([])
  useEffect(() => {
    if (!trigger) return
    const p = Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.4
      const d = 60 + Math.random() * 110
      return { id: i + trigger * 1000, dx: Math.cos(a) * d, dy: Math.sin(a) * d - 30, s: 4 + Math.random() * 6 }
    })
    setParts(p)
    const t = setTimeout(() => setParts([]), 1000)
    return () => clearTimeout(t)
  }, [trigger])
  if (!parts.length) return null
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-40">
      {parts.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            width: p.s, height: p.s,
            background: Math.random() > 0.3 ? '#f6e27a' : '#d4af37',
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
          }}
        />
      ))}
    </div>
  )
}

/* ---------- Stat strip ---------- */

export function StatsStrip() {
  const { balance, totalWon, handsPlayed } = useChips()
  const items = [
    ['BALANCE', fmt(balance)],
    ['HANDS PLAYED', fmt(handsPlayed)],
    ['TOTAL WON', fmt(totalWon)],
  ]
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2">
      {items.map(([k, v]) => (
        <div key={k} className="text-center">
          <div className="text-[10px] tracking-[0.3em] text-[#8a7a4d]">{k}</div>
          <div className="font-display text-lg font-bold text-[#f2e6c9] tabular-nums">{v}</div>
        </div>
      ))}
    </div>
  )
}
