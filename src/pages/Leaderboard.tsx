import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  RefreshCw,
  Coins,
  Flame,
  Crown,
  Building2,
  Search,
} from 'lucide-react'
import { usePlayer } from '../state/profile'
import { fmt, maxBetForTier, BET_TIERS, useChips } from '../state/chips'
import { Nametag } from '../components/Nametag'
import {
  fetchGlobalLeaderboard,
  fetchCasinos,
  supabase,
  playerNameToUuid,
  syncPlayerToSupabase,
  isCasinoOwnedBy,
  type GlobalPlayerRecord,
  type CasinoRecord,
} from '../lib/supabase'
import {
  getStakePool,
  syncStakePoolFromSupabase,
  type StakePoolData,
} from '../lib/stakeAndClub'

type SortCategory = 'chips' | 'ownership' | 'properties' | 'bet_tier'

function MedalBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd700] via-[#f59e0b] to-[#b45309] text-xl font-black text-black shadow-[0_0_15px_rgba(255,215,0,0.5)]">
        1
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#e2e8f0] via-[#94a3b8] to-[#475569] text-xl font-black text-black shadow-[0_0_12px_rgba(226,232,240,0.4)]">
        2
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#f97316] via-[#c2410c] to-[#7c2d12] text-xl font-black text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]">
        3
      </div>
    )
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c9a227]/30 bg-black/60 font-display text-sm font-bold text-[#8a7a4d]">
      #{rank}
    </div>
  )
}

export default function Leaderboard() {
  const { activeName } = usePlayer()
  const chipsState = useChips()
  const [players, setPlayers] = useState<GlobalPlayerRecord[]>([])
  const [casinos, setCasinos] = useState<CasinoRecord[]>([])
  const [stakePool, setStakePool] = useState<StakePoolData>(() => getStakePool())
  const [sortKey, setSortKey] = useState<SortCategory>('chips')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now')

  const myPid = useMemo(() => playerNameToUuid(activeName ?? ''), [activeName])

  // Sync active player to Supabase whenever Leaderboard is viewed
  useEffect(() => {
    if (activeName) {
      syncPlayerToSupabase(activeName, chipsState)
    }
  }, [activeName, chipsState])

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
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch (err) {
      console.warn('Failed to load global leaderboard:', err)
    } finally {
      setIsLoading(false)
      if (showSpinner) {
        setTimeout(() => setIsRefreshing(false), 400)
      }
    }
  }, [])

  // Setup initial load and Realtime subscriptions
  useEffect(() => {
    loadLeaderboard()

    let channel: any = null
    if (supabase) {
      channel = supabase
        .channel('leaderboard-realtime-rebuild')
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadLeaderboard()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const interval = setInterval(() => {
      loadLeaderboard()
    }, 12000)

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
      window.removeEventListener('stake-pool-updated', handleLocalStakeUpdate)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [loadLeaderboard])

  // Enriched players with property holdings and casino stake metrics
  const enrichedPlayers = useMemo(() => {
    const totalPool = stakePool.totalPool > 0 ? stakePool.totalPool : 1

    return players.map((p) => {
      const pName = (p.name || '').toLowerCase().trim()
      const pPid = p.id || playerNameToUuid(p.name)

      // Match owned casinos either by owner_id or owner_name
      const ownedCasinos = casinos.filter((c) => isCasinoOwnedBy(c, p.name, p.id || pPid))

      // Match stake pool contributions case-insensitively
      let stakedChips = 0
      for (const [k, v] of Object.entries(stakePool.contributions || {})) {
        if (k.toLowerCase().trim() === pName) {
          stakedChips += v
        }
      }
      const stakePercent = stakePool.totalPool > 0 ? Math.round((stakedChips / totalPool) * 10000) / 100 : 0

      return {
        ...p,
        ownedCasinos,
        propertyCount: ownedCasinos.length,
        stakedChips,
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
      if (sortKey === 'ownership') {
        return b.stakePercent - a.stakePercent || (b.chips ?? 0) - (a.chips ?? 0)
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

  // Filtered by search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return sortedPlayers
    const q = searchQuery.toLowerCase().trim()
    return sortedPlayers.filter((p) => p.name.toLowerCase().includes(q))
  }, [sortedPlayers, searchQuery])

  // Top 3 Podium players
  const topThree = useMemo(() => {
    return sortedPlayers.slice(0, 3)
  }, [sortedPlayers])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
      {/* Header Banner */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#10b981]/50 bg-[#064e3b]/40 px-3.5 py-1 mb-2 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-bold tracking-widest text-[#a7f3d0]">
            SUPABASE REALTIME NETWORK · LIVE SYNC
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
          GLOBAL MULTIPLAYER LEADERBOARD
        </h1>
        <p className="mt-1 text-[13px] text-[#a89872]">
          Real-time synchronized standings across all active casino players · Last updated: {lastSyncTime}
        </p>
        <div className="divider-gold mx-auto mt-3 w-48" />
      </div>

      {/* Podium (Top 3 Visual Display) */}
      {!isLoading && topThree.length >= 3 && !searchQuery.trim() && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-end max-w-3xl mx-auto">
          {/* 2nd Place */}
          <div className="order-2 md:order-1 panel-noir rounded-2xl border border-slate-400/40 bg-gradient-to-b from-slate-900/60 to-black p-5 text-center shadow-lg relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="text-3xl">🥈</span>
            </div>
            <div className="mt-2">
              <Nametag name={topThree[1].name} tagId={topThree[1].nametag || 'tag-guest'} badge={topThree[1].badge} />
            </div>
            <div className="font-display text-xl font-black text-slate-200 mt-3 tabular-nums">
              {sortKey === 'chips' && `${fmt(topThree[1].chips)} CHIPS`}
              {sortKey === 'ownership' && `${topThree[1].stakePercent.toFixed(1)}% EQUITY`}
              {sortKey === 'properties' && `${topThree[1].propertyCount} VENUES`}
              {sortKey === 'bet_tier' && `TIER ${topThree[1].bet_tier ?? 0}`}
            </div>
            <div className="text-[10px] text-[#8a7a4d] uppercase font-bold mt-1">2ND PLACE</div>
          </div>

          {/* 1st Place */}
          <div className="order-1 md:order-2 panel-noir rounded-2xl border-2 border-[#ffd700] bg-gradient-to-b from-[#2a2105] via-black to-[#1a1403] p-6 text-center shadow-[0_0_25px_rgba(255,215,0,0.25)] relative -translate-y-2">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2">
              <span className="text-4xl animate-bounce">👑</span>
            </div>
            <div className="mt-2">
              <Nametag name={topThree[0].name} tagId={topThree[0].nametag || 'tag-guest'} badge={topThree[0].badge} />
            </div>
            <div className="font-display text-2xl font-black text-[#f6e27a] mt-3 tabular-nums">
              {sortKey === 'chips' && `${fmt(topThree[0].chips)} CHIPS`}
              {sortKey === 'ownership' && `${topThree[0].stakePercent.toFixed(1)}% EQUITY`}
              {sortKey === 'properties' && `${topThree[0].propertyCount} VENUES`}
              {sortKey === 'bet_tier' && `TIER ${topThree[0].bet_tier ?? 0}`}
            </div>
            <div className="text-[10px] text-[#ffd700] tracking-widest uppercase font-black mt-1">
              🥇 CASINO CHAMPION
            </div>
          </div>

          {/* 3rd Place */}
          <div className="order-3 panel-noir rounded-2xl border border-amber-700/40 bg-gradient-to-b from-amber-950/40 to-black p-5 text-center shadow-lg relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="text-3xl">🥉</span>
            </div>
            <div className="mt-2">
              <Nametag name={topThree[2].name} tagId={topThree[2].nametag || 'tag-guest'} badge={topThree[2].badge} />
            </div>
            <div className="font-display text-xl font-black text-amber-300 mt-3 tabular-nums">
              {sortKey === 'chips' && `${fmt(topThree[2].chips)} CHIPS`}
              {sortKey === 'ownership' && `${topThree[2].stakePercent.toFixed(1)}% EQUITY`}
              {sortKey === 'properties' && `${topThree[2].propertyCount} VENUES`}
              {sortKey === 'bet_tier' && `TIER ${topThree[2].bet_tier ?? 0}`}
            </div>
            <div className="text-[10px] text-[#8a7a4d] uppercase font-bold mt-1">3RD PLACE</div>
          </div>
        </div>
      )}

      {/* Metric selection tabs */}
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setSortKey('chips')}
          className={`flex items-center gap-1.5 rounded-full border px-5 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'chips'
              ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)]'
              : 'border-[#c9a227]/30 bg-black/40 text-[#b3a06b] hover:border-[#c9a227]/60'
          }`}
        >
          <Coins size={14} /> CHIPS WEALTH
        </button>

        <button
          onClick={() => setSortKey('ownership')}
          className={`flex items-center gap-1.5 rounded-full border px-5 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'ownership'
              ? 'border-[#fde047] bg-[#2a2105] text-[#fde047] shadow-[0_0_15px_rgba(253,224,71,0.2)]'
              : 'border-white/10 bg-black/40 text-[#a89872] hover:border-white/30'
          }`}
        >
          <Crown size={14} className="text-[#fde047]" /> CASINO OWNERSHIP
        </button>

        <button
          onClick={() => setSortKey('properties')}
          className={`flex items-center gap-1.5 rounded-full border px-5 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'properties'
              ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)]'
              : 'border-white/10 bg-black/40 text-[#a89872] hover:border-white/30'
          }`}
        >
          <Building2 size={14} className="text-[#f6e27a]" /> PROPERTY HOLDINGS
        </button>

        <button
          onClick={() => setSortKey('bet_tier')}
          className={`flex items-center gap-1.5 rounded-full border px-5 py-2 text-[11px] font-bold transition-all ${
            sortKey === 'bet_tier'
              ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)]'
              : 'border-white/10 bg-black/40 text-[#a89872] hover:border-white/30'
          }`}
        >
          <Flame size={14} /> BET TIER STATUS
        </button>
      </div>

      {/* Search Input Filter */}
      <div className="mb-6 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search size={15} className="absolute left-3.5 top-3 text-[#8a7a4d]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players by name..."
            className="w-full rounded-full border border-[#c9a227]/40 bg-black/80 py-2 pl-10 pr-4 text-xs text-[#f2e6c9] placeholder:text-gray-500 focus:border-[#f6e27a] focus:outline-none shadow-inner"
          />
        </div>
      </div>

      {/* Leaderboard Roster */}
      {isLoading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
          <RefreshCw size={28} className="animate-spin text-[#f6e27a]" />
          <p className="font-display text-sm tracking-widest text-[#b3a06b]">SYNCHRONIZING GLOBAL PLAYERS...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="panel-noir rounded-2xl p-12 text-center border border-[#c9a227]/20">
          <p className="text-[14px] text-[#a89872]">
            {searchQuery.trim() ? `No players found matching "${searchQuery}".` : 'No players recorded yet. Be the first to enter the casino!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlayers.map((player, index) => {
            const isMe =
              (activeName && player.name.toLowerCase() === activeName.toLowerCase()) ||
              player.id === myPid
            const rank = index + 1
            const maxBet = maxBetForTier(player.bet_tier ?? 0)
            const tierLabel = BET_TIERS.find((t) => t.tier === (player.bet_tier ?? 0))?.label ?? 'Standard'

            return (
              <div
                key={player.id || player.name}
                className={`panel-noir rounded-2xl p-4 sm:p-5 transition-all ${
                  isMe
                    ? 'border-2 border-[#f6e27a] shadow-[0_0_20px_rgba(246,226,122,0.2)] bg-gradient-to-r from-[#2a2105]/80 via-black/90 to-[#2a2105]/80'
                    : 'border border-[#c9a227]/20 hover:border-[#c9a227]/40 bg-black/50'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Rank, Nametag, and Identity */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex w-10 shrink-0 items-center justify-center">
                      <MedalBadge rank={rank} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Nametag
                          name={player.name}
                          tagId={player.nametag || 'tag-guest'}
                          badge={player.badge}
                        />
                        {isMe && (
                          <span className="rounded bg-[#f6e27a] text-black px-2 py-0.5 text-[9px] font-black tracking-wider shadow">
                            YOU
                          </span>
                        )}

                        {/* Metric-specific auxiliary badge */}
                        {sortKey === 'bet_tier' && (
                          <span className="rounded bg-black/60 border border-[#f6e27a]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                            {tierLabel}
                          </span>
                        )}

                        {sortKey === 'ownership' && player.stakePercent > 0 && (
                          <span className="rounded bg-[#2a2105] border border-[#fde047]/50 px-2 py-0.5 text-[9px] font-bold text-[#fde047] flex items-center gap-1 shadow-sm">
                            <Crown size={11} className="text-[#fde047]" />
                            {player.stakePercent.toFixed(1)}% Casino Stake
                          </span>
                        )}

                        {sortKey === 'properties' && player.propertyCount > 0 && (
                          <span className="rounded bg-[#c9a227]/20 border border-[#c9a227]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a] flex items-center gap-1 shadow-sm">
                            <Building2 size={11} />
                            {player.propertyCount} {player.propertyCount === 1 ? 'Venue' : 'Venues'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Selected Metric Display (Shows ONLY the selected metric) */}
                  <div className="flex items-center justify-between sm:justify-end border-t border-white/5 pt-3 sm:border-0 sm:pt-0">
                    {/* 1. Chips Wealth tab: show ONLY chips */}
                    {sortKey === 'chips' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#8a7a4d] uppercase font-bold">CHIPS WEALTH</div>
                        <div className="font-display text-2xl font-black text-[#f6e27a] tabular-nums">
                          {fmt(player.chips ?? 0)}
                        </div>
                      </div>
                    )}

                    {/* 2. Casino Ownership tab: show ONLY ownership */}
                    {sortKey === 'ownership' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#8a7a4d] uppercase font-bold">CASINO EQUITY</div>
                        <div className="font-display text-2xl font-black text-[#fde047] tabular-nums flex items-center gap-1 justify-end">
                          <Crown size={18} className="text-[#fde047]" />
                          <span>{player.stakePercent.toFixed(1)}%</span>
                        </div>
                      </div>
                    )}

                    {/* 3. Property Holdings tab: show ONLY properties count */}
                    {sortKey === 'properties' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#8a7a4d] uppercase font-bold">VENUES OWNED</div>
                        <div className="font-display text-2xl font-black text-[#f6e27a] tabular-nums flex items-center gap-1 justify-end">
                          <Building2 size={18} />
                          <span>{player.propertyCount}</span>
                        </div>
                      </div>
                    )}

                    {/* 4. Bet Tier tab: show ONLY bet tier & max bet */}
                    {sortKey === 'bet_tier' && (
                      <div className="text-left sm:text-right">
                        <div className="text-[9px] tracking-[0.2em] text-[#8a7a4d] uppercase font-bold">MAX BET LIMIT</div>
                        <div className="font-display text-2xl font-black text-[#f6e27a] tabular-nums">
                          {fmt(maxBet)} <span className="text-xs font-normal text-gray-400">CHIPS</span>
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
    </div>
  )
}
