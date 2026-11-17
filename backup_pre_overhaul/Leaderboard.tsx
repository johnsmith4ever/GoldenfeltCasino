import { useEffect, useState, useMemo, useCallback } from 'react'
import { Trophy, RefreshCw, Sparkles, Coins, Flame, Crown, Building2 } from 'lucide-react'
import { usePlayer } from '../state/profile'
import { fmt, maxBetForTier, BET_TIERS } from '../state/chips'
import { Nametag } from '../components/Nametag'
import {
  fetchGlobalLeaderboard,
  fetchCasinos,
  supabase,
  ensureAnonymousSession,
  type GlobalPlayerRecord,
  type CasinoRecord,
} from '../lib/supabase'
import {
  getStakePool,
  syncStakePoolFromSupabase,
  type StakePoolData,
} from '../lib/stakeAndClub'

type SortCategory = 'chips' | 'tokens' | 'ownership' | 'properties' | 'bet_tier'

function MedalRank({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl drop-shadow-md">🥇</span>
  if (rank === 2) return <span className="text-2xl drop-shadow-md">🥈</span>
  if (rank === 3) return <span className="text-2xl drop-shadow-md">🥉</span>
  return <span className="font-display text-lg font-bold text-[#8a7a4d]">#{rank}</span>
}

export default function Leaderboard() {
  const { activeName } = usePlayer()
  const [players, setPlayers] = useState<GlobalPlayerRecord[]>([])
  const [casinos, setCasinos] = useState<CasinoRecord[]>([])
  const [stakePool, setStakePool] = useState<StakePoolData>(() => getStakePool())
  const [myUid, setMyUid] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortCategory>('chips')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load stable user auth id
  useEffect(() => {
    ensureAnonymousSession().then((uid) => {
      if (uid) setMyUid(uid)
    })
  }, [])

  // Load global leaderboard, casinos, and stake pool
  const loadLeaderboard = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    try {
      const [records, fetchedCasinos, syncedPool] = await Promise.all([
        fetchGlobalLeaderboard(),
        fetchCasinos(),
        syncStakePoolFromSupabase(),
      ])
      if (records && records.length > 0) {
        setPlayers(records)
      }
      if (fetchedCasinos && fetchedCasinos.length > 0) {
        setCasinos(fetchedCasinos)
      }
      if (syncedPool) {
        setStakePool(syncedPool)
      }
    } catch (err) {
      console.warn('Failed to load global leaderboard:', err)
    } finally {
      setIsLoading(false)
      if (showSpinner) {
        setTimeout(() => setIsRefreshing(false), 400)
      }
    }
  }, [])

  // Setup initial load, Realtime subscriptions and tab visibility refetch
  useEffect(() => {
    loadLeaderboard()

    // Realtime postgres_changes subscription on players and casinos tables
    let channel: any = null
    if (supabase) {
      channel = supabase
        .channel('leaderboard-global-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players' },
          () => {
            loadLeaderboard()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'casinos' },
          () => {
            loadLeaderboard()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'stake_investors' },
          () => {
            loadLeaderboard()
          }
        )
        .subscribe()
    }

    const handleLocalStakeUpdate = () => {
      setStakePool(getStakePool())
    }
    window.addEventListener('stake-pool-updated', handleLocalStakeUpdate)

    // Refetch when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadLeaderboard()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
      window.removeEventListener('stake-pool-updated', handleLocalStakeUpdate)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadLeaderboard])

  // Enriched players with property holdings and casino stake metrics
  const enrichedPlayers = useMemo(() => {
    const totalPool = stakePool.totalPool > 0 ? stakePool.totalPool : 1

    return players.map((p) => {
      const pName = (p.name || '').toLowerCase().trim()
      // Match owned casinos either by owner_id or owner_name
      const ownedCasinos = casinos.filter((c) => {
        const matchOwnerId = c.owner_id && c.owner_id === p.id
        const matchOwnerName = c.owner_name && c.owner_name.toLowerCase().trim() === pName
        return Boolean(matchOwnerId || matchOwnerName)
      })

      // Match stake pool contributions case-insensitively
      let stakedTokens = 0
      for (const [k, v] of Object.entries(stakePool.contributions || {})) {
        if (k.toLowerCase().trim() === pName) {
          stakedTokens += v
        }
      }
      const stakePercent = stakePool.totalPool > 0 ? Math.round((stakedTokens / totalPool) * 10000) / 100 : 0

      return {
        ...p,
        ownedCasinos,
        propertyCount: ownedCasinos.length,
        stakedTokens,
        stakePercent,
      }
    })
  }, [players, casinos, stakePool])

  // Sorted players list based on selected filter tab
  const sortedPlayers = useMemo(() => {
    return [...enrichedPlayers].sort((a, b) => {
      if (sortKey === 'chips') {
        return (b.chips ?? 0) - (a.chips ?? 0)
      }
      if (sortKey === 'tokens') {
        return (b.tokens ?? 0) - (a.tokens ?? 0)
      }
      if (sortKey === 'ownership') {
        return b.stakedTokens - a.stakedTokens || (b.tokens ?? 0) - (a.tokens ?? 0)
      }
      if (sortKey === 'properties') {
        return b.propertyCount - a.propertyCount || (b.chips ?? 0) - (a.chips ?? 0)
      }
      if (sortKey === 'bet_tier') {
        return (b.bet_tier ?? 0) - (a.bet_tier ?? 0) || (b.chips ?? 0) - (a.chips ?? 0)
      }
      return 0
    })
  }, [enrichedPlayers, sortKey])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/40 bg-black/60 px-3.5 py-1 mb-2 shadow-sm">
          <Trophy size={13} className="text-[#f6e27a]" />
          <span className="text-[10px] font-bold tracking-widest text-[#f6e27a]">
            SUPABASE GLOBAL REALTIME RANKINGS
          </span>
          <button
            onClick={() => loadLeaderboard(true)}
            disabled={isRefreshing}
            title="Refresh Leaderboard"
            className="ml-1 text-[#f6e27a] hover:text-white transition-opacity disabled:opacity-50"
          >
            <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <h1 className="font-display gold-text-bright text-3xl font-black tracking-[0.18em] sm:text-4xl">
          GLOBAL LEADERBOARD
        </h1>
        <p className="mt-1 text-[13px] text-[#a89872]">
          All active high rollers synchronized across the decentralized casino network
        </p>
        <div className="divider-gold mx-auto mt-3 w-48" />
      </div>

      {/* Sort selection tabs */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setSortKey('chips')}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'chips'
              ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)]'
              : 'border-[#c9a227]/30 bg-black/40 text-[#b3a06b] hover:border-[#c9a227]/60'
          }`}
        >
          <Coins size={14} /> CHIPS WEALTH
        </button>

        <button
          onClick={() => setSortKey('tokens')}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'tokens'
              ? 'border-[#38bdf8] bg-[#071829] text-[#7dd3fc] shadow-[0_0_15px_rgba(56,189,248,0.2)]'
              : 'border-white/10 bg-black/40 text-[#a89872] hover:border-white/30'
          }`}
        >
          <Sparkles size={14} className="text-[#38bdf8]" /> SCARCE TOKENS
        </button>

        <button
          onClick={() => setSortKey('ownership')}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'ownership'
              ? 'border-[#fde047] bg-[#2a2105] text-[#fde047] shadow-[0_0_15px_rgba(253,224,71,0.2)]'
              : 'border-white/10 bg-black/40 text-[#a89872] hover:border-white/30'
          }`}
        >
          <Crown size={14} className="text-[#fde047]" /> CASINO OWNERSHIP
        </button>

        <button
          onClick={() => setSortKey('properties')}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'properties'
              ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)]'
              : 'border-white/10 bg-black/40 text-[#a89872] hover:border-white/30'
          }`}
        >
          <Building2 size={14} className="text-[#f6e27a]" /> PROPERTY HOLDINGS
        </button>

        <button
          onClick={() => setSortKey('bet_tier')}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'bet_tier'
              ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)]'
              : 'border-white/10 bg-black/40 text-[#a89872] hover:border-white/30'
          }`}
        >
          <Flame size={14} /> BET TIER STATUS
        </button>
      </div>

      {/* Leaderboard Roster */}
      {isLoading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
          <RefreshCw size={28} className="animate-spin text-[#f6e27a]" />
          <p className="font-display text-sm tracking-widest text-[#b3a06b]">FETCHING GLOBAL RECORDS...</p>
        </div>
      ) : sortedPlayers.length === 0 ? (
        <div className="panel-noir rounded-2xl p-12 text-center border border-[#c9a227]/20">
          <p className="text-[14px] text-[#a89872]">No players recorded yet. Be the first to enter the casino!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => {
            const isMe = (myUid && player.id === myUid) || (activeName && player.name.toLowerCase() === activeName.toLowerCase())
            const rank = index + 1
            const maxBet = maxBetForTier(player.bet_tier ?? 0)
            const tierLabel = BET_TIERS.find(t => t.tier === (player.bet_tier ?? 0))?.label ?? 'Standard'

            return (
              <div
                key={player.id || player.name}
                className={`panel-noir rounded-2xl p-4 sm:p-5 transition-all ${
                  isMe
                    ? 'border-2 border-[#f6e27a] shadow-[0_0_20px_rgba(246,226,122,0.15)] bg-gradient-to-r from-[#2a2105]/70 via-black/80 to-[#2a2105]/70'
                    : 'border border-[#c9a227]/20 hover:border-[#c9a227]/40'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Medal rank, Nametag, and Identity */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex w-10 shrink-0 items-center justify-center">
                      <MedalRank rank={rank} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Nametag
                          name={player.name}
                          tagId={player.nametag || 'tag-guest'}
                          badge={player.badge}
                        />
                        {isMe && (
                          <span className="rounded bg-[#c9a227]/20 border border-[#c9a227]/50 px-2 py-0.5 text-[9px] font-black text-[#f6e27a] shadow">
                            YOU
                          </span>
                        )}
                        <span className="rounded bg-black/60 border border-white/10 px-2 py-0.5 text-[9px] font-bold text-gray-400">
                          Tier {player.bet_tier ?? 0}: {tierLabel}
                        </span>

                        {/* Casino Equity Badge */}
                        {player.stakePercent > 0 && (
                          <span className="rounded bg-[#0284c7]/20 border border-[#38bdf8]/40 px-2 py-0.5 text-[9px] font-bold text-[#7dd3fc] flex items-center gap-1 shadow-sm">
                            <Crown size={11} className="text-[#fde047]" />
                            {player.stakePercent.toFixed(1)}% Casino Stake
                          </span>
                        )}

                        {/* Property Holdings Badge */}
                        {player.propertyCount > 0 && (
                          <span className="rounded bg-[#c9a227]/20 border border-[#c9a227]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a] flex items-center gap-1 shadow-sm">
                            <Building2 size={11} />
                            {player.propertyCount} {player.propertyCount === 1 ? 'Venue' : 'Venues'} Owned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Selected Metric Display (Shows ONLY what is selected) */}
                  <div className="flex items-center justify-between sm:justify-end border-t border-white/5 pt-3 sm:border-0 sm:pt-0">
                    {/* 1. Chips Wealth tab: show ONLY chips */}
                    {sortKey === 'chips' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#8a7a4d] uppercase font-bold">CHIPS WEALTH</div>
                        <div className="font-display text-2xl font-bold text-[#f6e27a] tabular-nums">
                          {fmt(player.chips ?? 0)}
                        </div>
                      </div>
                    )}

                    {/* 2. Scarce Tokens tab: show ONLY tokens */}
                    {sortKey === 'tokens' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#38bdf8] uppercase font-bold">SCARCE TOKENS</div>
                        <div className="font-display text-2xl font-bold text-[#7dd3fc] tabular-nums flex items-center gap-1 sm:justify-end">
                          <Sparkles size={16} className="text-[#38bdf8]" />
                          {fmt(player.tokens ?? 0)}
                        </div>
                      </div>
                    )}

                    {/* 3. Casino Ownership tab: show ONLY stake pool equity & staked tokens */}
                    {sortKey === 'ownership' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#fde047] uppercase font-bold">CASINO EQUITY</div>
                        <div className="font-display text-2xl font-black text-[#fde047] tabular-nums">
                          {player.stakePercent.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-[#7dd3fc] tabular-nums">
                          {fmt(player.stakedTokens)} tokens in pool
                        </div>
                      </div>
                    )}

                    {/* 4. Property Holdings tab: show ONLY casino venue deeds owned */}
                    {sortKey === 'properties' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#f6e27a] uppercase font-bold">PROPERTY HOLDINGS</div>
                        <div className="font-display text-2xl font-bold text-[#f6e27a] tabular-nums">
                          {player.propertyCount}{' '}
                          <span className="text-xs font-normal text-[#cbb98a]">
                            {player.propertyCount === 1 ? 'Venue' : 'Venues'} Owned
                          </span>
                        </div>
                        {player.ownedCasinos.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5 sm:justify-end">
                            {player.ownedCasinos.map((c) => (
                              <span key={c.id} title={`${c.name} (Slot ${c.slot_num})`} className="text-sm">
                                {c.icon}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5. Bet Tier tab: show table limit and tier */}
                    {sortKey === 'bet_tier' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#8a7a4d] uppercase font-bold">TABLE LIMIT</div>
                        <div className="font-display text-xl font-bold text-[#f2e6c9] tabular-nums">
                          {fmt(maxBet)}
                        </div>
                        <div className="text-[10px] text-[#cbb98a]">
                          Tier {player.bet_tier ?? 0}: {tierLabel}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer message */}
      <div className="mt-12 text-center text-[10px] tracking-[0.3em] text-[#6b5f42]">
        SUPABASE CLOUD SYNC · REALTIME POSTGRESQL TRUTH · ZERO LOCAL STORAGE HYPERINFLATION
      </div>
    </div>
  )
}
