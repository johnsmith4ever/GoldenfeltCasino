import { createClient } from '@supabase/supabase-js'
import type { ChipsSave } from '../state/chips'

function getPlayerActiveTag(playerName: string): string {
  try {
    const raw = localStorage.getItem(`golden-felt-player-save-v1:${encodeURIComponent(playerName.trim().toLowerCase())}:shop`)
    if (raw) {
      const p = JSON.parse(raw)
      if (p?.equipped?.tag) return p.equipped.tag
    }
  } catch {}
  return 'tag-guest'
}

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const isSupabaseConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20 &&
    !supabaseUrl.includes('placeholder')
  )
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export interface GlobalPlayerRecord {
  player_id: string
  name: string
  nametag_id: string
  balance: number
  total_won: number
  total_lost: number
  hands_played: number
  total_bet: number
  properties_count: number
  is_club_member: boolean
  updated_at: string
}

export interface GlobalStakeInvestor {
  player_id: string
  player_name: string
  chips_invested: number
  updated_at: string
}

export interface GlobalClubMember {
  name: string
  title: string
  joined_at: string
}

// Debounce map for player updates to avoid spamming the database
let syncTimeout: ReturnType<typeof setTimeout> | null = null

export function syncPlayerToSupabase(playerName: string, chips: ChipsSave) {
  if (!supabase || !playerName || playerName === 'Guest') return

  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(async () => {
    try {
      const activeTagId = getPlayerActiveTag(playerName)
      const ownedPropertiesCount = Object.values(chips.properties || {}).filter(
        (p: unknown) => p && typeof p === 'object' && 'level' in p && Number((p as { level: number }).level) > 0
      ).length
      let clubMember = false
      try {
        const rawClub = localStorage.getItem('golden-felt-club-members-v1')
        if (rawClub) {
          const parsed = JSON.parse(rawClub)
          clubMember = Array.isArray(parsed) && parsed.some((m: { name?: string }) => m?.name?.toLowerCase() === playerName.trim().toLowerCase())
        }
      } catch {}

      const playerId = playerName.trim().toLowerCase()

      await supabase.from('casino_players').upsert({
        player_id: playerId,
        name: playerName.trim(),
        nametag_id: activeTagId,
        balance: chips.balance,
        total_won: chips.totalWon,
        total_lost: chips.totalLost,
        hands_played: chips.handsPlayed,
        total_bet: chips.totalBet,
        properties_count: ownedPropertiesCount,
        is_club_member: clubMember,
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('Supabase sync warning:', err)
    }
  }, 1200)
}

export async function fetchGlobalLeaderboard(): Promise<GlobalPlayerRecord[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('casino_players')
      .select('*')
      .order('balance', { ascending: false })
      .limit(100)

    if (error) {
      console.warn('Error fetching global leaderboard:', error.message)
      return []
    }
    return (data as GlobalPlayerRecord[]) || []
  } catch (err) {
    console.warn('Supabase fetch leaderboard failed:', err)
    return []
  }
}

export async function fetchGlobalStakeInvestors(): Promise<GlobalStakeInvestor[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('casino_stake_investors')
      .select('*')
      .order('chips_invested', { ascending: false })

    if (error) {
      console.warn('Error fetching stake investors:', error.message)
      return []
    }
    return (data as GlobalStakeInvestor[]) || []
  } catch (err) {
    console.warn('Supabase fetch stake investors failed:', err)
    return []
  }
}

export async function investInGlobalStake(
  playerName: string,
  amount: number
): Promise<boolean> {
  if (!supabase || !playerName) return false
  try {
    const playerId = playerName.trim().toLowerCase()
    
    // Check existing
    const { data: existing } = await supabase
      .from('casino_stake_investors')
      .select('chips_invested')
      .eq('player_id', playerId)
      .maybeSingle()

    const currentInvested = existing?.chips_invested || 0
    const newInvested = currentInvested + amount

    const { error } = await supabase.from('casino_stake_investors').upsert({
      player_id: playerId,
      player_name: playerName.trim(),
      chips_invested: newInvested,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.warn('Error investing in global stake:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('Supabase invest failed:', err)
    return false
  }
}

export async function fetchGlobalClubMembers(): Promise<GlobalClubMember[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('casino_club_members')
      .select('*')
      .order('joined_at', { ascending: false })

    if (error) {
      console.warn('Error fetching club members:', error.message)
      return []
    }
    return (data as GlobalClubMember[]) || []
  } catch (err) {
    console.warn('Supabase fetch club members failed:', err)
    return []
  }
}

export async function joinGlobalClub(playerName: string, title = 'High Roller'): Promise<boolean> {
  if (!supabase || !playerName) return false
  try {
    const { error } = await supabase.from('casino_club_members').upsert({
      name: playerName.trim(),
      title,
      joined_at: new Date().toISOString(),
    })
    return !error
  } catch {
    return false
  }
}
