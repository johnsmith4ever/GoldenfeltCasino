import { createClient } from '@supabase/supabase-js'

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
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

export interface GlobalPlayerRecord {
  id: string
  name: string
  chips: number
  tokens: number
  nametag: string
  badge: string | null
  bet_tier: number
  updated_at: string
  // Legacy / convenience fields
  balance?: number
  player_id?: string
  nametag_id?: string
}

export interface CasinoRecord {
  id: string
  name: string
  tagline: string
  icon: string
  price: number
  slot_num?: number
  currency?: 'chips' | 'tokens'
  owner_id: string | null
  owner_name?: string | null
  owner_nametag?: string | null
  owner_badge?: string | null
  updated_at: string
}

export const BADGE_DEFINITIONS: Record<
  string,
  { tier: number; label: string; icon: string; css: string; description: string; cost: number }
> = {
  'badge-bronze-dice': {
    tier: 1,
    label: 'Lucky Bones',
    icon: '🎲',
    css: 'border-[#ca8a04] bg-[#ca8a04]/20 text-[#fde047]',
    description: 'First tier collector badge',
    cost: 100,
  },
  'badge-silver-crown': {
    tier: 2,
    label: 'High Sovereign',
    icon: '👑',
    css: 'border-[#94a3b8] bg-[#94a3b8]/20 text-[#f1f5f9]',
    description: 'Silver tier royal insignia',
    cost: 500,
  },
  'badge-gold-lion': {
    tier: 3,
    label: 'Golden Apex',
    icon: '🦁',
    css: 'border-[#f59e0b] bg-[#f59e0b]/20 text-[#fef08a]',
    description: 'Predator of high-stakes tables',
    cost: 2500,
  },
  'badge-diamond-gem': {
    tier: 4,
    label: 'Etherion Shard',
    icon: '💎',
    css: 'border-[#38bdf8] bg-[#0284c7]/25 text-[#bae6fd]',
    description: 'Flawless diamond insignia',
    cost: 10000,
  },
  'badge-mythic-phoenix': {
    tier: 5,
    label: 'Immortal Flame',
    icon: '🔥',
    css: 'border-[#f43f5e] bg-[#be123c]/30 text-[#fecdd3]',
    description: 'The legendary Phoenix mark',
    cost: 50000,
  },
}

export function subscribeToCasinos(onUpdate: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('casinos-realtime-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'casinos' }, () => {
      onUpdate()
    })
    .subscribe()
  return () => {
    if (supabase) supabase.removeChannel(channel)
  }
}

// Ensure anonymous session exists and return auth.uid()
export async function ensureAnonymousSession(): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      return session.user.id
    }
    const { data: signInData, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.warn('Anonymous sign-in failed:', error.message)
      return null
    }
    return signInData?.user?.id ?? null
  } catch (err) {
    console.warn('Error establishing anonymous session:', err)
    return null
  }
}

// Migrate or fetch player row from Supabase
export async function migrateOrCreatePlayer(
  playerName: string,
  localChips: number
): Promise<GlobalPlayerRecord | null> {
  if (!supabase) return null
  try {
    const uid = await ensureAnonymousSession()
    if (!uid) return null

    // Check if player row already exists for this auth.uid
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('id', uid)
      .maybeSingle()

    if (existingPlayer) {
      return {
        ...existingPlayer,
        balance: existingPlayer.chips,
        player_id: existingPlayer.id,
        nametag_id: existingPlayer.nametag,
      } as GlobalPlayerRecord
    }

    // Try to insert new player with initial or migrated chips
    const startingChips = Math.min(Math.max(5000, localChips), 8000000)
    const { data: newPlayer, error } = await supabase
      .from('players')
      .insert({
        id: uid,
        name: playerName.trim(),
        chips: startingChips,
        tokens: 0,
        nametag: 'tag-guest',
        badge: null,
        bet_tier: 0,
      })
      .select()
      .maybeSingle()

    if (error) {
      // If name collision, try with suffix or read by name
      console.warn('Player creation note:', error.message)
      const { data: byName } = await supabase
        .from('players')
        .select('*')
        .ilike('name', playerName.trim())
        .maybeSingle()
      if (byName) {
        return {
          ...byName,
          balance: byName.chips,
          player_id: byName.id,
          nametag_id: byName.nametag,
        } as GlobalPlayerRecord
      }
      return null
    }

    return {
      ...newPlayer,
      balance: newPlayer.chips,
      player_id: newPlayer.id,
      nametag_id: newPlayer.nametag,
    } as GlobalPlayerRecord
  } catch (err) {
    console.warn('migrateOrCreatePlayer failed:', err)
    return null
  }
}

// Fetch all players for leaderboard
export async function fetchGlobalLeaderboard(): Promise<GlobalPlayerRecord[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, chips, tokens, nametag, badge, bet_tier, updated_at')
      .order('chips', { ascending: false })
      .limit(100)

    if (error) {
      console.warn('Leaderboard fetch error:', error.message)
      return []
    }

    return (data || []).map((p) => ({
      ...p,
      balance: p.chips,
      player_id: p.id,
      nametag_id: p.nametag,
    })) as GlobalPlayerRecord[]
  } catch (err) {
    console.warn('fetchGlobalLeaderboard failed:', err)
    return []
  }
}

export const CASINO_ORDER = [
  'casino-studio',      // Slot 1
  'casino-underground', // Slot 2
  'casino-strip-bar',   // Slot 3
  'casino-mall',        // Slot 4
  'casino-marina',      // Slot 5
  'casino-resort',      // Slot 6
  'casino-high-roller', // Slot 7
  'casino-golden-felt', // Slot 8
] as const

export const CHIP_CASINOS = new Set([
  'casino-studio',
  'casino-underground',
  'casino-strip-bar',
  'casino-mall',
])

export function isChipCasino(id: string): boolean {
  return CHIP_CASINOS.has(id)
}

export function getCasinoSlotNum(id: string): number {
  const idx = CASINO_ORDER.indexOf(id as any)
  return idx >= 0 ? idx + 1 : 1
}

export const DEFAULT_CASINOS: CasinoRecord[] = [
  { id: 'casino-studio', name: 'Downtown Studio Casino', tagline: 'Compact downtown venue with constant foot traffic', icon: '🏢', price: 150000, slot_num: 1, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-underground', name: 'Underground Poker Den', tagline: 'Exclusive late-night speakeasy for card sharks', icon: '🃏', price: 500000, slot_num: 2, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-strip-bar', name: 'Strip Casino Bar & Lounge', tagline: 'High-energy lounge right on the central boulevard', icon: '🍸', price: 1200000, slot_num: 3, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-mall', name: 'Galleria Luxury Casino', tagline: 'Multi-level gaming pavilion in the high-end shopping district', icon: '🛍️', price: 3000000, slot_num: 4, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-marina', name: 'Superyacht Harbor & Marina', tagline: 'Private deep-water dock accommodating billionaire yachts', icon: '🛥️', price: 5000, slot_num: 5, currency: 'tokens', owner_id: null, updated_at: '' },
  { id: 'casino-resort', name: '5-Star Casino Resort Hotel', tagline: '500-room luxury palace with VIP gaming suites', icon: '🏨', price: 10000, slot_num: 6, currency: 'tokens', owner_id: null, updated_at: '' },
  { id: 'casino-high-roller', name: 'High Roller Penthouse Casino', tagline: 'Top-floor panoramic venue exclusively for apex whales', icon: '🏙️', price: 25000, slot_num: 7, currency: 'tokens', owner_id: null, updated_at: '' },
  { id: 'casino-golden-felt', name: 'The Golden Felt Sovereign Casino', tagline: 'The ultimate crown jewel of high-stakes play', icon: '👑', price: 50000, slot_num: 8, currency: 'tokens', owner_id: null, updated_at: '' },
]

// Fetch casinos with owner player details
export async function fetchCasinos(): Promise<CasinoRecord[]> {
  if (!supabase) return DEFAULT_CASINOS
  try {
    const { data: rawCasinos, error } = await supabase
      .from('casinos')
      .select('id, name, tagline, icon, price, owner_id, updated_at')

    if (error || !rawCasinos || rawCasinos.length === 0) {
      return DEFAULT_CASINOS
    }

    // Sort strictly by canonical CASINO_ORDER so Slots 1-4 (Chips) are ALWAYS first and Slots 5-8 (Tokens) are ALWAYS second
    const orderMap = new Map(CASINO_ORDER.map((id, index) => [id, index]))
    const sorted = [...rawCasinos].sort((a, b) => {
      const idxA = orderMap.has(a.id as any) ? orderMap.get(a.id as any)! : 999
      const idxB = orderMap.has(b.id as any) ? orderMap.get(b.id as any)! : 999
      return idxA - idxB
    })

    // Fetch owner details for owned casinos
    const ownerIds = sorted.map((c) => c.owner_id).filter(Boolean) as string[]
    let playerMap = new Map<string, { name: string; nametag: string; badge: string | null }>()

    if (ownerIds.length > 0) {
      const { data: players } = await supabase
        .from('players')
        .select('id, name, nametag, badge')
        .in('id', ownerIds)

      if (players) {
        for (const p of players) {
          playerMap.set(p.id, { name: p.name, nametag: p.nametag, badge: p.badge })
        }
      }
    }

    return sorted.map((c) => {
      const owner = c.owner_id ? playerMap.get(c.owner_id) : null
      const isChip = isChipCasino(c.id)
      return {
        ...c,
        slot_num: getCasinoSlotNum(c.id),
        currency: isChip ? 'chips' : 'tokens',
        owner_name: owner?.name || null,
        owner_nametag: owner?.nametag || null,
        owner_badge: owner?.badge || null,
      }
    })
  } catch (err) {
    console.warn('fetchCasinos failed:', err)
    return DEFAULT_CASINOS
  }
}

// RPC: Buy Casino Stake atomically (Slots 1-4 = Chips, Slots 5-8 = Tokens)
export async function buyCasino(
  casinoId: string,
  playerName?: string
): Promise<{
  success: boolean
  error?: string
  remaining_tokens?: number
  remaining_chips?: number
  currency?: string
}> {
  if (!supabase) return { success: false, error: 'Database offline.' }
  try {
    await ensureAnonymousSession()
    const { data, error } = await supabase.rpc('buy_casino', {
      c_id: casinoId,
      p_player_name: playerName || '',
    })
    if (error) return { success: false, error: error.message }
    return data as { success: boolean; error?: string; remaining_tokens?: number; remaining_chips?: number; currency?: string }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Transaction failed.' }
  }
}

// RPC: Spin Loot Box (costs 10k chips: 10% 1-80 tokens, 5% 100-120 tokens, 2% 150+ tokens, 83% nothing)
export async function spinLootBox(playerName?: string, clientChips?: number): Promise<{
  success: boolean
  won?: boolean
  tokens_won?: number
  chips?: number
  tokens?: number
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database offline.' }
  try {
    await ensureAnonymousSession()
    // Try with p_player_name and p_client_chips
    let { data, error } = await supabase.rpc('spin_loot_box', {
      p_player_name: playerName || '',
      p_client_chips: typeof clientChips === 'number' ? clientChips : null,
    })

    // If PostgREST schema cache misses the 2-parameter signature, fallback to single p_player_name
    if (error && (error.message.includes('schema cache') || error.message.includes('spin_loot_box'))) {
      const fallback1 = await supabase.rpc('spin_loot_box', {
        p_player_name: playerName || '',
      })
      if (!fallback1.error) {
        data = fallback1.data
        error = null
      } else {
        const fallback2 = await supabase.rpc('spin_loot_box')
        if (!fallback2.error) {
          data = fallback2.data
          error = null
        }
      }
    }

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('Could not find')) {
        return {
          success: false,
          error: 'Could not find spin_loot_box in Supabase schema cache. Please run supabase_schema.sql in the Supabase SQL editor.',
        }
      }
      return { success: false, error: error.message }
    }
    return data
  } catch (err: any) {
    return { success: false, error: err?.message || 'Loot box roll failed.' }
  }
}

// RPC: Claim Daily Token Spin (24h cooldown)
export async function claimDailyTokenSpin(playerName?: string): Promise<{
  success: boolean
  tokens_won?: number
  tokens?: number
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Database offline.' }
  try {
    await ensureAnonymousSession()
    let { data, error } = await supabase.rpc('claim_daily_token_spin', {
      p_player_name: playerName || '',
    })

    // If PostgREST schema cache misses the parameter signature, fallback to 0-argument signature
    if (error && (error.message.includes('schema cache') || error.message.includes('claim_daily_token_spin'))) {
      const fallback = await supabase.rpc('claim_daily_token_spin')
      if (!fallback.error) {
        data = fallback.data
        error = null
      }
    }

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('Could not find')) {
        return {
          success: false,
          error: 'Could not find claim_daily_token_spin in Supabase schema cache. Please run supabase_schema.sql in the Supabase SQL editor.',
        }
      }
      return { success: false, error: error.message }
    }
    return data
  } catch (err: any) {
    return { success: false, error: err?.message || 'Daily spin claim failed.' }
  }
}

// RPC: Record Game Hand (Blackjack/Poker 4-win streak, total spin milestones, luck drop)
export async function recordGameHand(won: boolean, game: string, playerName?: string): Promise<{
  success: boolean
  tokens_awarded?: number
  tokens?: number
  streak?: number
  streak_completed?: boolean
  milestone_awarded?: boolean
  luck_drop?: boolean
  error?: string
}> {
  if (!supabase) return { success: false }
  try {
    const { data, error } = await supabase.rpc('record_game_hand', {
      p_won: won,
      p_game: game,
      p_player_name: playerName || '',
    })
    if (error) return { success: false, error: error.message }
    return data
  } catch {
    return { success: false }
  }
}

// RPC: Buy Token Shop Item (Sequential unlock)
export async function buyTokenShopItem(
  category: 'bet_tier' | 'nametag' | 'badge' | 'felt' | 'back',
  tier: number,
  itemId: string,
  cost: number,
  playerName?: string
): Promise<{ success: boolean; tokens?: number; bet_tier?: number; nametag?: string; badge?: string; error?: string }> {
  if (!supabase) return { success: false, error: 'Database offline.' }
  try {
    await ensureAnonymousSession()
    const { data, error } = await supabase.rpc('buy_token_shop_item', {
      p_category: category,
      p_tier: tier,
      p_item_id: itemId,
      p_cost: cost,
      p_player_name: playerName || '',
    })
    if (error) return { success: false, error: error.message }
    return data
  } catch (err: any) {
    return { success: false, error: err?.message || 'Purchase failed.' }
  }
}

// RPC: Redeem Starting Grant (Server-side bcrypt password verification)
export async function redeemGrant(
  roleName: string,
  password: string,
  playerName?: string
): Promise<{ success: boolean; chips?: number; role_name?: string; title?: string; error?: string }> {
  if (!supabase) return { success: false, error: 'Database offline.' }
  try {
    await ensureAnonymousSession()
    const { data, error } = await supabase.rpc('redeem_grant', {
      p_role: roleName,
      p_password: password,
      p_player_name: playerName || '',
    })
    if (error) return { success: false, error: error.message }
    return data
  } catch (err: any) {
    return { success: false, error: err?.message || 'Grant claim failed.' }
  }
}

export interface GrantRole {
  role_name: string
  title: string
  grant_chips: number
  is_claimed: boolean
}

export async function fetchGrantRoles(): Promise<GrantRole[]> {
  const fallback: GrantRole[] = [
    { role_name: 'Toby', title: 'Loyal Soldier', grant_chips: 500000, is_claimed: false },
    { role_name: 'Nik', title: 'Loyal Soldier', grant_chips: 500000, is_claimed: false },
    { role_name: 'Ethan', title: 'Loyal Soldier', grant_chips: 500000, is_claimed: false },
    { role_name: 'George', title: 'Loyal Soldier', grant_chips: 500000, is_claimed: false },
    { role_name: 'Abhay', title: 'Loyal Soldier', grant_chips: 500000, is_claimed: false },
    { role_name: 'Kiarash', title: 'Great Guy', grant_chips: 10000000, is_claimed: false },
    { role_name: 'johnsmith', title: 'Admin', grant_chips: 100000000, is_claimed: false },
  ]
  if (!supabase) return fallback
  try {
    const { data, error } = await supabase.rpc('get_grant_roles')
    if (error || !data || data.length === 0) return fallback
    return data as GrantRole[]
  } catch {
    return fallback
  }
}

// Debounced sync of chips and tokens to Supabase
let chipSyncTimeout: ReturnType<typeof setTimeout> | null = null

export function syncPlayerToSupabase(playerName: string, chips: { balance: number; tokens?: number }) {
  if (!supabase || !playerName || playerName.toLowerCase() === 'guest') return
  if (chipSyncTimeout) clearTimeout(chipSyncTimeout)
  chipSyncTimeout = setTimeout(async () => {
    try {
      await ensureAnonymousSession()
      await supabase.rpc('sync_player_chips', {
        p_chips: chips.balance,
        p_player_name: playerName,
        p_tokens: typeof chips.tokens === 'number' ? chips.tokens : null,
      })
    } catch {
      try {
        await supabase.rpc('sync_player_chips', { p_chips: chips.balance, p_player_name: playerName })
      } catch {
        try {
          await supabase.rpc('sync_player_chips', { p_chips: chips.balance })
        } catch {}
      }
    }
  }, 1500)
}

// Immediate flush on tab hide/close
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      try {
        const raw = localStorage.getItem('golden-felt-active-player-v1')
        if (raw && supabase) {
          const playerName = raw.trim()
          const chipsKey = `golden-felt-player-save-v1:${encodeURIComponent(playerName.toLowerCase())}:chips`
          const chipsStr = localStorage.getItem(chipsKey)
          if (chipsStr) {
            const data = JSON.parse(chipsStr)
            if (data?.balance) {
              supabase.rpc('sync_player_chips', {
                p_chips: data.balance,
                p_player_name: playerName,
                p_tokens: typeof data.tokens === 'number' ? data.tokens : null,
              })
            }
          }
        }
      } catch {}
    }
  })
}

// Global Token Stake Pool
export interface GlobalStakeInvestor {
  id?: string
  player_id?: string
  player_name: string
  tokens_staked: number
  title?: string
  updated_at?: string
}

export interface GlobalClubMember {
  name: string
  title: string
  joined_at: string
}

export const DEFAULT_STAKE_INVESTORS: GlobalStakeInvestor[] = []

export async function fetchGlobalStakeInvestors(): Promise<GlobalStakeInvestor[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('stake_investors')
      .select('id, player_name, tokens_staked, title, updated_at')
      .order('tokens_staked', { ascending: false })

    if (error || !data) return []
    const MOCK_NAMES = new Set(['the house', 'kiarash', 'johnsmith', 'nik', 'toby', 'ethan', 'george', 'abhay'])
    return data
      .filter((d: any) => !MOCK_NAMES.has((d.player_name || '').toLowerCase().trim()))
      .map((d: any) => ({
        id: d.id,
        player_name: d.player_name,
        tokens_staked: Number(d.tokens_staked) || 0,
        title: d.title || 'Stakeholder',
        updated_at: d.updated_at,
      }))
  } catch {
    return []
  }
}

export async function investInGlobalStake(
  playerName: string,
  amount: number
): Promise<{ success: boolean; total_pool?: number; my_staked?: number; error?: string }> {
  if (!supabase) return { success: true }
  try {
    await ensureAnonymousSession()
    const { data, error } = await supabase.rpc('stake_tokens', {
      p_tokens: amount,
      p_player_name: playerName || '',
    })

    if (error) {
      // Direct table upsert fallback
      try {
        const { data: existing } = await supabase
          .from('stake_investors')
          .select('id, tokens_staked')
          .ilike('player_name', playerName)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('stake_investors')
            .update({
              tokens_staked: (Number(existing.tokens_staked) || 0) + amount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('stake_investors')
            .insert({
              player_name: playerName,
              tokens_staked: amount,
              title: 'Casino Stakeholder',
            })
        }
      } catch {}
      return { success: false, error: error.message }
    }
    return data
  } catch (err: any) {
    return { success: false, error: err?.message || 'Stake failed' }
  }
}

export function subscribeToStakePool(callback: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('stake-pool-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stake_investors' }, () => {
      callback()
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function fetchGlobalClubMembers(): Promise<GlobalClubMember[]> {
  return []
}

export async function joinGlobalClub(_playerName: string, _title: string): Promise<void> {
  return
}
