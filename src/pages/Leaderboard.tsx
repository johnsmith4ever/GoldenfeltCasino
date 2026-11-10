import { useEffect, useMemo, useState } from 'react'
import { usePlayer } from '../state/profile'
import { fmt } from '../state/chips'
import { ITEMS_BY_ID } from '../state/shop'
import { getStakePool } from '../lib/stakeAndClub'
import { fetchGlobalLeaderboard, isSupabaseConfigured, type GlobalPlayerRecord } from '../lib/supabase'

interface PlayerStats {
  name: string
  balance: number
  totalWon: number
  totalLost: number
  handsPlayed: number
  totalBet: number
  netProfit: number
  stakeAmount: number
  stakePercent: number
  nametagId?: string
}

function getPlayerStorageKey(playerName: string, namespace: string): string {
  const slug = encodeURIComponent(
    playerName.trim().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 16).toLocaleLowerCase()
  )
  return `golden-felt-player-save-v1:${slug}:${namespace}`
}

function loadPlayerChips(playerName: string, pool: { totalPool: number; contributions: Record<string, number> }): PlayerStats {
  const cleanName = playerName.trim()
  const stakeKey = Object.keys(pool.contributions).find((k) => k.toLowerCase() === cleanName.toLowerCase())
  const stakeAmount = stakeKey ? pool.contributions[stakeKey] : 0
  const stakePercent = pool.totalPool > 0 ? (stakeAmount / pool.totalPool) * 100 : 0

  let nametagId = 'tag-guest'
  try {
    const rawShop = localStorage.getItem(getPlayerStorageKey(playerName, 'shop'))
    if (rawShop) {
      const p = JSON.parse(rawShop)
      if (p?.equipped?.tag) nametagId = p.equipped.tag
    }
  } catch {}

  try {
    const raw = localStorage.getItem(getPlayerStorageKey(playerName, 'chips'))
    if (!raw) return { name: playerName, balance: 0, totalWon: 0, totalLost: 0, handsPlayed: 0, totalBet: 0, netProfit: 0, stakeAmount, stakePercent, nametagId }
    const data = JSON.parse(raw) as {
      balance?: number
      totalWon?: number
      totalLost?: number
      handsPlayed?: number
      totalBet?: number
    }
    const balance = Number(data.balance) || 0
    const totalWon = Number(data.totalWon) || 0
    const totalLost = Number(data.totalLost) || 0
    const handsPlayed = Number(data.handsPlayed) || 0
    const totalBet = Number(data.totalBet) || 0
    return {
      name: playerName,
      balance,
      totalWon,
      totalLost,
      handsPlayed,
      totalBet,
      netProfit: totalWon - totalLost,
      stakeAmount,
      stakePercent,
      nametagId,
    }
  } catch {
    return { name: playerName, balance: 0, totalWon: 0, totalLost: 0, handsPlayed: 0, totalBet: 0, netProfit: 0, stakeAmount, stakePercent, nametagId }
  }
}

type SortKey = 'balance' | 'totalWon' | 'totalBet' | 'stakeAmount' | 'handsPlayed' | 'netProfit'

const SORT_OPTIONS: { key: SortKey; label: string; icon: string; desc: string }[] = [
  { key: 'balance', label: 'Current Balance', icon: '💰', desc: 'Who has the most chips right now' },
  { key: 'totalWon', label: 'Total Won', icon: '🏆', desc: 'Highest cumulative winnings ever' },
  { key: 'totalBet', label: 'Total Bet', icon: '🎲', desc: 'Biggest gamblers by total amount wagered' },
  { key: 'stakeAmount', label: 'Casino Stake', icon: '🏛️', desc: 'Largest shareholders and house co-owners' },
  { key: 'handsPlayed', label: 'Hands Played', icon: '🃏', desc: 'Most experienced players' },
  { key: 'netProfit', label: 'Net Profit', icon: '📈', desc: 'Total won minus total lost' },
]

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>
  if (rank === 2) return <span className="text-2xl">🥈</span>
  if (rank === 3) return <span className="text-2xl">🥉</span>
  return <span className="font-display text-lg font-bold text-[#6b5f42]">#{rank}</span>
}

export default function Leaderboard() {
  const { players, activeName } = usePlayer()
  const [activeSortKey, setActiveSortKey] = useState<SortKey>('balance')
  const [globalPlayers, setGlobalPlayers] = useState<GlobalPlayerRecord[]>([])
  const [isLive, setIsLive] = useState(isSupabaseConfigured())

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const loadGlobal = () => {
      fetchGlobalLeaderboard().then((res) => {
        if (res && res.length > 0) {
          setGlobalPlayers(res)
          setIsLive(true)
        }
      })
    }
    loadGlobal()
    const interval = setInterval(loadGlobal, 8000)
    return () => clearInterval(interval)
  }, [])

  const stats = useMemo(() => {
    const pool = getStakePool()
    const allLocalNames = Array.from(new Set([...players, ...Object.keys(pool.contributions)]))
    const localMap = new Map<string, PlayerStats>()

    for (const name of allLocalNames) {
      localMap.set(name.toLowerCase(), loadPlayerChips(name, pool))
    }

    // Merge global players from Supabase
    for (const gp of globalPlayers) {
      const key = gp.name.toLowerCase()
      const existing = localMap.get(key)
      if (existing) {
        localMap.set(key, {
          name: gp.name,
          balance: Math.max(existing.balance, gp.balance),
          totalWon: Math.max(existing.totalWon, gp.total_won),
          totalLost: Math.max(existing.totalLost, gp.total_lost),
          handsPlayed: Math.max(existing.handsPlayed, gp.hands_played),
          totalBet: Math.max(existing.totalBet, gp.total_bet),
          netProfit: Math.max(existing.totalWon, gp.total_won) - Math.max(existing.totalLost, gp.total_lost),
          stakeAmount: existing.stakeAmount,
          stakePercent: existing.stakePercent,
          nametagId: gp.nametag_id || existing.nametagId,
        })
      } else {
        localMap.set(key, {
          name: gp.name,
          balance: gp.balance,
          totalWon: gp.total_won,
          totalLost: gp.total_lost,
          handsPlayed: gp.hands_played,
          totalBet: gp.total_bet,
          netProfit: gp.total_won - gp.total_lost,
          stakeAmount: 0,
          stakePercent: 0,
          nametagId: gp.nametag_id || 'tag-guest',
        })
      }
    }

    return Array.from(localMap.values()).sort((a, b) => b[activeSortKey] - a[activeSortKey])
  }, [players, activeSortKey, globalPlayers])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/30 bg-black/50 px-3 py-1 mb-2">
          <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[10px] font-bold tracking-widest text-[#f6e27a]">
            {isLive ? 'LIVE GLOBAL SYNC ACTIVE' : 'LOCAL DEVICE MODE'}
          </span>
        </div>
        <p className="text-[10px] tracking-[0.4em] text-[#b3a06b]">GOLDEN FELT RANKINGS</p>
        <h1 className="font-display gold-text-bright mt-2 text-3xl font-black tracking-[0.18em] sm:text-4xl">LEADERBOARD</h1>
        <p className="mt-2 text-[13px] text-[#a89872]">
          {isLive
            ? `Global multi-device sync online · ${stats.length} active high roller${stats.length !== 1 ? 's' : ''}`
            : `Rankings across all players on this device · ${players.length} player${players.length !== 1 ? 's' : ''}`}
        </p>
        <div className="divider-gold mx-auto mt-3 w-48" />
      </div>

      {/* Sort tabs */}
      <div className="mb-5 flex flex-wrap gap-2 justify-center">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setActiveSortKey(opt.key)}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-semibold transition-colors ${
              activeSortKey === opt.key
                ? 'border-[#f6e27a] bg-[#2a2105]/80 text-[#f6e27a]'
                : 'border-[#c9a227]/30 bg-black/30 text-[#b3a06b] hover:border-[#c9a227]/60'
            }`}
          >
            <span>{opt.icon}</span> {opt.label}
          </button>
        ))}
      </div>

      {/* Category description */}
      <div className="mb-5 text-center text-[12px] text-[#8a7a4d]">
        {SORT_OPTIONS.find((o) => o.key === activeSortKey)?.desc}
      </div>

      {players.length === 0 ? (
        <div className="text-center py-16 text-[#6b5f42]">No players found. Create a player to get started.</div>
      ) : (
        <div className="space-y-3">
          {stats.map((s, i) => {
            const isMe = s.name === activeName
            const sortOpt = SORT_OPTIONS.find((o) => o.key === activeSortKey)!
            const primaryValue = s[activeSortKey]
            const displayValue = activeSortKey === 'netProfit'
              ? `${primaryValue >= 0 ? '+' : ''}${fmt(primaryValue)}`
              : activeSortKey === 'stakeAmount'
              ? `${fmt(primaryValue)} chips`
              : fmt(primaryValue)
            const unit = activeSortKey === 'handsPlayed'
              ? 'hands'
              : activeSortKey === 'stakeAmount'
              ? `(${s.stakePercent.toFixed(1)}% stake)`
              : 'chips'

            return (
              <div
                key={s.name}
                className={`panel-noir rounded-xl p-4 sm:p-5 ${isMe ? 'border border-[#f6e27a]/40 shadow-[0_0_15px_rgba(246,226,122,0.1)]' : ''}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex w-10 items-center justify-center shrink-0">
                      <MedalIcon rank={i + 1} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-[16px] font-bold text-[#f2e6c9] truncate">{s.name}</span>
                        {isMe && (
                          <span className="rounded bg-[#c9a227]/20 border border-[#c9a227]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                            YOU
                          </span>
                        )}
                        {ITEMS_BY_ID[s.nametagId || 'tag-guest'] && (
                          <span className="rounded bg-[#f59e0b]/15 border border-[#f59e0b]/35 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#fde047]">
                            {ITEMS_BY_ID[s.nametagId || 'tag-guest'].title || ITEMS_BY_ID[s.nametagId || 'tag-guest'].name}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#8a7a4d]">
                        Rank #{i + 1}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] tracking-[0.2em] text-[#8a7a4d] uppercase">
                      {sortOpt.icon} {sortOpt.label}
                    </div>
                    <div className="font-display mt-0.5 text-2xl font-bold text-[#f6e27a] tabular-nums">
                      {displayValue} <span className="text-[12px] font-normal text-[#b3a06b]">{unit}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 text-center">
        <p className="text-[10px] tracking-[0.28em] text-[#6b5f42]">
          RANKINGS ARE LOCAL TO THIS DEVICE · FOR ENTERTAINMENT ONLY
        </p>
      </div>
    </div>
  )
}
