import { useEffect, useMemo, useState } from 'react'
import { Spade, Dices, CircleDot, Cherry, Club, Crown, Dice5, Swords, ArrowUpDown, Grid3x3, Rocket, Disc, Coins } from 'lucide-react'
import { type Screen, type GameId, RotatingSeal, StatsStrip } from '../components/GameShell'
import { DailyGift } from './Shop'
import { sfx } from '../lib/audio'
import { getClubMembers } from '../lib/stakeAndClub'
import { fetchGlobalClubMembers, isSupabaseConfigured, type GlobalClubMember } from '../lib/supabase'

function HallOfFamePlaque({ onOpenClub }: { onOpenClub: () => void }) {
  const [globalMembers, setGlobalMembers] = useState<GlobalClubMember[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const load = () => {
      fetchGlobalClubMembers().then((res) => {
        if (res && res.length > 0) setGlobalMembers(res)
      })
    }
    load()
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [])

  const members = useMemo(() => {
    const local = getClubMembers()
    const map = new Map<string, { name: string }>()
    for (const m of local) map.set(m.name.toLowerCase(), m)
    for (const gm of globalMembers) {
      if (!map.has(gm.name.toLowerCase())) map.set(gm.name.toLowerCase(), { name: gm.name })
    }
    return Array.from(map.values())
  }, [globalMembers])
  return (
    <section className="mx-auto mb-8 max-w-6xl px-4">
      <div className="panel-noir flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c9a227]/40 bg-gradient-to-r from-black/80 via-[#1c1505]/70 to-black/80 p-3 sm:px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl">🏛️</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display gold-text text-[13px] font-bold tracking-[0.18em]">HALL OF FAME</span>
              <span className="rounded bg-[#f59e0b]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#fde047]">
                {members.length} INDUCTED
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-[#cbb98a]">
              {members.length === 0 ? (
                <span className="text-[#8a7a4d]">No members yet. Join The Club (250K entrance) to claim your plaque!</span>
              ) : (
                members.slice(0, 8).map((m) => (
                  <span key={m.name} className="inline-flex items-center gap-1 rounded border border-[#f59e0b]/30 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-[#fef08a]">
                    👑 {m.name}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => { sfx.click(); onOpenClub() }}
          className="btn-ghost-gold rounded-full px-3.5 py-1.5 text-[10px] font-bold"
        >
          VIEW CLUB →
        </button>
      </div>
    </section>
  )
}

const MARQUEE_ITEMS = [
  'BLACKJACK PAYS 3 TO 2', 'EUROPEAN ROULETTE', 'GRAND SLOTS', 'CRAPS', 'POKER ROOM', 'BACCARAT', 'SIC BO', 'KENO',
  'PLAY MONEY ONLY', 'NO REAL WAGERING', 'THE HOUSE WELCOMES YOU',
]

type Group = 'Admin Pre-Release' | 'Casino classics' | 'Table games' | 'Quick games'

const GAMES: {
  id: GameId
  group: Group
  name: string
  desc: string
  icon: typeof Spade
  accent: string
  minBet: string
  isPreRelease?: boolean
}[] = [
  { id: 'rocket', group: 'Admin Pre-Release', name: 'Rocket Crash', desc: 'Exponential multiplier ascent into deep space. Bail out before the rocket explodes!', icon: Rocket, accent: '#b45309', minBet: '25', isPreRelease: true },
  { id: 'wheel', group: 'Admin Pre-Release', name: 'Lucky Wheel', desc: 'High-volatility casino wheel. 15 zeros, 1.5x, 2x, 5x and a legendary 10x jackpot!', icon: Disc, accent: '#7c3aed', minBet: '25', isPreRelease: true },
  { id: 'dice', group: 'Admin Pre-Release', name: 'Lucky Dice', desc: 'High or Low dice roll with true casino odds. Predict right for a 1.95x payout!', icon: Dices, accent: '#059669', minBet: '25', isPreRelease: true },
  { id: 'coinflip', group: 'Admin Pre-Release', name: 'Coin Flip', desc: 'Pure 50/50 high-stakes coin toss. Heads or Tails pays 1.95x total return.', icon: Coins, accent: '#d97706', minBet: '25', isPreRelease: true },
  { id: 'blackjack', group: 'Casino classics', name: 'Blackjack', desc: 'Beat the dealer to twenty-one. Blackjack pays 3 to 2.', icon: Spade, accent: '#176148', minBet: '25' },
  { id: 'roulette', group: 'Casino classics', name: 'Roulette', desc: 'Single-zero European wheel. Straight up pays 35 to 1.', icon: CircleDot, accent: '#5c0f14', minBet: '25' },
  { id: 'slots', group: 'Casino classics', name: 'Grand Slots', desc: 'Three gilded reels. Triple diamonds pay 500 to 1.', icon: Cherry, accent: '#7a1220', minBet: '25' },
  { id: 'craps', group: 'Casino classics', name: 'Craps', desc: 'Pass line and field. Seven out — or ride the point.', icon: Dices, accent: '#4a0d16', minBet: '25' },
  { id: 'poker', group: 'Casino classics', name: 'Poker Room', desc: "Hold'em, Omaha, Seven-Card Stud, Three Card and Video Poker. New to poker? There's a guide.", icon: Club, accent: '#0e3d2c', minBet: '5' },
  { id: 'baccarat', group: 'Table games', name: 'Baccarat', desc: 'Player, Banker or Tie. Closest to nine wins.', icon: Crown, accent: '#176148', minBet: '25' },
  { id: 'sicbo', group: 'Table games', name: 'Sic Bo', desc: 'Three dice, dozens of bets. Small, Big, totals and triples.', icon: Dice5, accent: '#4a0d16', minBet: '25' },
  { id: 'war', group: 'Table games', name: 'Casino War', desc: 'Highest card wins. A tie means war.', icon: Swords, accent: '#176148', minBet: '25' },
  { id: 'highlow', group: 'Quick games', name: 'High-Low', desc: 'Higher or lower? Build a streak and cash out.', icon: ArrowUpDown, accent: '#5c0f14', minBet: '25' },
  { id: 'keno', group: 'Quick games', name: 'Keno', desc: 'Pick up to ten of eighty numbers. Twenty are drawn.', icon: Grid3x3, accent: '#7a1220', minBet: '25' },
]

const GROUPS: Group[] = ['Admin Pre-Release', 'Casino classics', 'Table games', 'Quick games']

export default function Lobby({ onSelect }: { onSelect: (s: Screen) => void }) {
  return (
    <div className="pb-16">
      {/* Marquee */}
      <div className="overflow-hidden border-b border-[#c9a227]/20 bg-black/60 py-1.5">
        <div className="marquee-track">
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0 items-center">
              {MARQUEE_ITEMS.map((t, i) => (
                <span key={i} className="flex items-center whitespace-nowrap font-display text-[11px] tracking-[0.3em] text-[#b3a06b]">
                  <span className="px-6">{t}</span>
                  <span className="text-[#c9a227]">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-10 pt-12 text-center sm:pt-16">
        <div className="absolute left-1/2 top-6 -translate-x-1/2 opacity-90">
          <RotatingSeal size={110} />
        </div>
        <div className="pt-32">
          <p className="text-[11px] tracking-[0.5em] text-[#b3a06b]">EST. MMXXVI — HOUSE OF FORTUNE</p>
          <h1 className="font-display gold-text-bright mt-4 text-5xl font-black leading-tight tracking-[0.08em] sm:text-7xl">
            GOLDEN FELT
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] font-light leading-relaxed text-[#cbb98a]">
            An evening at the tables, on the house. Ten games, played with
            complimentary chips — no real money, only the thrill.
          </p>
          <div className="shimmer-line mx-auto mt-6 h-px w-72" />
          <div className="mt-8">
            <StatsStrip />
          </div>
        </div>
      </section>

      {/* Daily gift */}
      <section className="mx-auto mb-6 max-w-6xl px-4">
        <DailyGift compact />
        <div className="mt-3 text-center">
          <button
            onClick={() => { sfx.click(); onSelect('shop') }}
            className="btn-ghost-gold min-h-[44px] rounded px-5 py-2 text-[11px]"
          >
            VISIT THE SHOP — FELTS, CARD BACKS &amp; NAMETAGS
          </button>
        </div>
      </section>

      {/* Hall of Fame Plaque (Compact) */}
      <HallOfFamePlaque onOpenClub={() => onSelect('club')} />

      {/* Game cards, by kind */}
      {GROUPS.map((group) => (
        <section key={group} className="mx-auto mb-10 max-w-6xl px-4">
          <div className="mb-4 flex items-center gap-4">
            <h2 className="font-display text-[13px] font-bold tracking-[0.4em] text-[#b3a06b]">{group.toUpperCase()}</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[#c9a227]/40 to-transparent" />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.filter((g) => g.group === group).map((g) => {
              const Icon = g.icon
              return (
                <button
                  key={g.id}
                  onClick={() => { sfx.click(); onSelect(g.id) }}
                  className="group panel-noir relative overflow-hidden rounded-xl p-6 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-[#d4af37]/70 hover:shadow-[0_20px_50px_-20px_rgba(212,175,55,0.35)]"
                >
                  <div
                    className="absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-50"
                    style={{ background: g.accent === '#176148' || g.accent === '#0e3d2c' ? '#1a7a58' : '#d4002a' }}
                  />
                  <div className="flex items-start justify-between">
                    <Icon size={34} strokeWidth={1.4} className="text-[#d4af37] transition-transform duration-300 group-hover:scale-110" />
                    <div className="flex items-center gap-1.5">
                      {g.isPreRelease && (
                        <span className="rounded bg-[#f59e0b]/25 border border-[#f59e0b]/60 px-2 py-0.5 text-[9px] font-black tracking-widest text-[#fde047] shadow-[0_0_10px_rgba(245,158,11,0.4)]">
                          ADMIN PRE-RELEASE
                        </span>
                      )}
                      <span className="rounded-full border border-[#c9a227]/30 px-2.5 py-0.5 text-[10px] tracking-[0.2em] text-[#b3a06b]">
                        MIN {g.minBet}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-display gold-text mt-5 text-2xl font-bold tracking-[0.12em]">{g.name.toUpperCase()}</h3>
                  <p className="mt-2 text-sm font-light leading-relaxed text-[#a89872]">{g.desc}</p>
                  <div className="mt-5 flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.3em] text-[#d4af37]">
                    TAKE A SEAT
                    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                  </div>
                </button>
              )
            })}
            {group === 'Quick games' && (
        <div className="rounded-xl border border-dashed border-[#c9a227]/30 p-6">
          <h3 className="font-display text-sm font-bold tracking-[0.25em] text-[#b3a06b]">HOUSE RULES</h3>
          <ul className="mt-4 space-y-2.5 text-[13px] font-light leading-relaxed text-[#8a7a5c]">
            <li className="flex gap-2"><span className="text-[#c9a227]">✦</span> Complimentary chips — never real money.</li>
            <li className="flex gap-2"><span className="text-[#c9a227]">✦</span> Broke? The cashier refills you, free.</li>
            <li className="flex gap-2"><span className="text-[#c9a227]">✦</span> Dealer stands on all seventeens.</li>
            <li className="flex gap-2"><span className="text-[#c9a227]">✦</span> Your balance is saved in this browser.</li>
          </ul>
        </div>
            )}
          </div>
        </section>
      ))}

      <footer className="mt-14 text-center">
        <div className="divider-gold mx-auto w-64" />
        <p className="mt-4 text-[11px] tracking-[0.35em] text-[#6b5f42]">PLAY FOR PLEASURE · CHIPS HOLD NO VALUE</p>
      </footer>
    </div>
  )
}
