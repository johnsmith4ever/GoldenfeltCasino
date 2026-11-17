import { useEffect, useMemo, useState } from 'react'
import {
  Spade,
  Dices,
  CircleDot,
  Cherry,
  Club,
  Crown,
  Lock,
  Sparkles,
  Building2,
} from 'lucide-react'
import { type Screen, type GameId, RotatingSeal, StatsStrip } from '../components/GameShell'
import { DailyGift } from './Shop'
import { usePlayer } from '../state/profile'
import { sfx } from '../lib/audio'
import { getClubMembers, getPlayerStake } from '../lib/stakeAndClub'
import {
  fetchGlobalClubMembers,
  fetchCasinos,
  isCasinoOwnedBy,
  playerNameToUuid,
  isSupabaseConfigured,
  type GlobalClubMember,
} from '../lib/supabase'

function CasinoOwnershipSummaryPlaque({ onOpenProperties }: { onOpenProperties: () => void }) {
  const { activeName } = usePlayer()
  const playerName = activeName || 'Player'
  const [ownedCount, setOwnedCount] = useState<number>(0)
  const [totalCount, setTotalCount] = useState<number>(8)
  const [stakePercent, setStakePercent] = useState<number>(0)

  useEffect(() => {
    let unmounted = false
    const checkOwnership = async () => {
      try {
        const casinos = await fetchCasinos()
        const myPid = playerNameToUuid(playerName)
        const myOwned = (casinos || []).filter((c) => isCasinoOwnedBy(c, playerName, myPid))
        const stake = getPlayerStake(playerName)
        if (!unmounted) {
          setOwnedCount(myOwned.length)
          setTotalCount(casinos?.length || 8)
          setStakePercent(stake.percent)
        }
      } catch {}
    }
    checkOwnership()
    const timer = setInterval(checkOwnership, 6000)
    return () => {
      unmounted = true
      clearInterval(timer)
    }
  }, [playerName])

  const dominancePercent = totalCount > 0 ? ((ownedCount / totalCount) * 100).toFixed(0) : '0'

  return (
    <section className="mx-auto mb-8 max-w-6xl px-4">
      <div className="panel-noir flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#c9a227]/40 bg-gradient-to-r from-black/90 via-[#1a1403]/85 to-black/90 p-4 sm:px-6 shadow-xl">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#f6e27a]/50 bg-[#2a2105] shadow-[0_0_15px_rgba(246,226,122,0.3)]">
            <Building2 size={24} className="text-[#f6e27a]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[13px] font-bold tracking-[0.18em] text-[#f6e27a]">
                CASINO EMPIRE OWNERSHIP
              </span>
              <span className="rounded bg-[#2a2105] border border-[#f6e27a]/50 px-2 py-0.5 text-[9px] font-black text-[#fde047]">
                {ownedCount} / {totalCount} PROPERTIES OWNED ({dominancePercent}%)
              </span>
              {stakePercent > 0 && (
                <span className="rounded bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-black text-emerald-400">
                  {stakePercent.toFixed(1)}% HOUSE EQUITY
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-[#cbb98a]">
              {ownedCount > 0
                ? `You control ${ownedCount} of ${totalCount} casinos on the strip generating ongoing passive revenue.`
                : 'Acquire casino deeds on the strip or stake chips into the central house liquidity reserve.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { sfx.click(); onOpenProperties() }}
          className="btn-gold flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[11px] font-black tracking-wider shrink-0 shadow-lg"
        >
          <Sparkles size={13} className="text-[#140b02]" />
          MANAGE EMPIRE &amp; REVENUE →
        </button>
      </div>
    </section>
  )
}

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
  'PRIVATE VIP TABLES ONLY', 'BLACKJACK PAYS 3 TO 2', 'EUROPEAN ROULETTE', 'GRAND SLOTS', 'HIGH ROLLER CRAPS', 'PRIVATE POKER ROOM', 'VIP BACCARAT',
  'PLAY MONEY ONLY', 'EXCLUSIVE PRIVATE SALONS', 'THE HOUSE WELCOMES YOU',
]

type Group = 'Private Table Classics' | 'Private VIP Salons'

const GAMES: {
  id: GameId
  group: Group
  name: string
  desc: string
  icon: typeof Spade
  accent: string
  minBet: string
}[] = [
  { id: 'blackjack', group: 'Private Table Classics', name: 'Private VIP Blackjack', desc: 'Beat the dealer to twenty-one. Blackjack pays 3 to 2 on your private VIP felt.', icon: Spade, accent: '#176148', minBet: '25' },
  { id: 'roulette', group: 'Private Table Classics', name: 'Private European Roulette', desc: 'Single-zero European wheel. Straight up pays 35 to 1 in your private salon.', icon: CircleDot, accent: '#5c0f14', minBet: '25' },
  { id: 'poker', group: 'Private Table Classics', name: 'Private Poker Room', desc: "Exclusive private tables: Hold'em, Omaha, Seven-Card Stud, Three Card and Video Poker.", icon: Club, accent: '#0e3d2c', minBet: '5' },
  { id: 'craps', group: 'Private Table Classics', name: 'Private High Roller Craps', desc: 'Pass line and field with genuine true casino odds on your private dice felt.', icon: Dices, accent: '#4a0d16', minBet: '25' },
  { id: 'baccarat', group: 'Private VIP Salons', name: 'Private VIP Baccarat', desc: 'Player, Banker or Tie. Closest to nine wins in the private high-limit room.', icon: Crown, accent: '#176148', minBet: '25' },
  { id: 'slots', group: 'Private VIP Salons', name: 'Private Grand Slots', desc: 'Three gilded reels. Triple diamonds pay 500 to 1 on your private high-roller machine.', icon: Cherry, accent: '#7a1220', minBet: '25' },
]

const GROUPS: Group[] = ['Private Table Classics', 'Private VIP Salons']

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
            VISIT THE BOUTIQUE — FELTS, CARD BACKS &amp; NAMETAGS
          </button>
        </div>
      </section>

      {/* Live VIP Party & Poker Banner */}
      <section className="mx-auto mb-8 max-w-6xl px-4">
        <div className="panel-noir rounded-2xl border-2 border-[#f59e0b] bg-gradient-to-r from-[#2a1705] via-[#1a1403] to-[#2a1705] p-5 shadow-[0_0_25px_rgba(245,158,11,0.25)] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="text-4xl">🥂</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display gold-text-bright text-lg font-black tracking-wider">
                  VIP PARTY &amp; LIVE MULTIPLAYER POKER
                </span>
                <span className="rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white animate-pulse">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-[#cbb98a] mt-0.5">
                Host private parties with custom room codes, pop champagne for the table, chat, and play live No-Limit Texas Hold'em with other real players.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sfx.click()
              onSelect('party')
            }}
            className="btn-gold rounded-xl px-6 py-2.5 text-xs font-black shrink-0 shadow-lg flex items-center gap-2"
          >
            <span>ENTER VIP PARTY LOUNGE</span> →
          </button>
        </div>
      </section>

      {/* Hall of Fame Plaque (Compact) */}
      <HallOfFamePlaque onOpenClub={() => onSelect('club')} />

      {/* Casino Empire & Ownership Banner */}
      <CasinoOwnershipSummaryPlaque onOpenProperties={() => onSelect('properties')} />

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
                      <span className="rounded bg-[#2a2105] border border-[#f6e27a]/60 px-2 py-0.5 text-[9px] font-black tracking-widest text-[#fde047] flex items-center gap-1 shadow-sm">
                        <Lock size={10} className="text-[#f6e27a]" /> PRIVATE
                      </span>
                      <span className="rounded-full border border-[#c9a227]/30 px-2.5 py-0.5 text-[10px] tracking-[0.2em] text-[#b3a06b]">
                        MIN {g.minBet}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-display gold-text mt-5 text-2xl font-bold tracking-[0.12em]">{g.name.toUpperCase()}</h3>
                  <p className="mt-2 text-sm font-light leading-relaxed text-[#a89872]">{g.desc}</p>
                  <div className="mt-5 flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.3em] text-[#d4af37]">
                    <span>ENTER PRIVATE SALON</span>
                    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                  </div>
                </button>
              )
            })}
            {group === 'Private VIP Salons' && (
              <div className="rounded-xl border border-dashed border-[#c9a227]/30 p-6 bg-black/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lock size={16} className="text-[#f6e27a]" />
                    <h3 className="font-display text-sm font-bold tracking-[0.25em] text-[#f6e27a]">PRIVATE VIP HOUSE RULES</h3>
                  </div>
                  <ul className="space-y-2.5 text-[13px] font-light leading-relaxed text-[#cbb98a]">
                    <li className="flex gap-2"><span className="text-[#c9a227]">✦</span> 100% Private sessions — no public matchmaking or bots.</li>
                    <li className="flex gap-2"><span className="text-[#c9a227]">✦</span> Genuine casino rules with true house math.</li>
                    <li className="flex gap-2"><span className="text-[#c9a227]">✦</span> Dealer stands on all seventeens in Blackjack.</li>
                    <li className="flex gap-2"><span className="text-[#c9a227]">✦</span> All progression &amp; chips securely saved in your browser.</li>
                  </ul>
                </div>
                <div className="mt-4 pt-3 border-t border-[#c9a227]/20 text-[10px] text-[#8a7a4d] uppercase font-bold tracking-widest">
                  Golden Felt VIP Sovereign Lounge
                </div>
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
