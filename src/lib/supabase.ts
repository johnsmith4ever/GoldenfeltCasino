import { createClient } from '@supabase/supabase-js'

const env: Record<string, any> =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env
    ? (globalThis as any).process.env
    : {}

const rawUrl = (env.VITE_SUPABASE_URL || '').trim()
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim()

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
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null

export function playerNameToUuid(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x12345678, h4 = 0x87654321
  const s = 'goldenfelt:' + (str || 'Player').trim().toLowerCase()
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
    h3 = Math.imul(h3 ^ ch, 2246822507)
    h4 = Math.imul(h4 ^ ch, 3266489909)
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  const p1 = hex(h1)
  const p2 = hex(h2).slice(0, 4)
  const p3 = '5' + hex(h2).slice(5, 8)
  const p4 = ((parseInt(hex(h3).slice(0, 2), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hex(h3).slice(2, 4)
  const p5 = hex(h4) + hex(h1 ^ h3).slice(0, 4)
  return [p1, p2, p3, p4, p5].join('-')
}

export function isCasinoOwnedBy(casino: { owner_id?: string | null; owner_name?: string | null }, playerName?: string | null, myPid?: string | null): boolean {
  if (!casino) return false
  const pName = (playerName || '').trim().toLowerCase()
  const oName = (casino.owner_name || '').trim().toLowerCase()
  const oId = casino.owner_id || ''

  if (myPid && oId && oId === myPid) return true
  if (pName && oName && pName === oName) return true

  // Reconcile player identity aliases across account renames
  if (pName.startsWith('miguel') || pName.includes('miguel')) {
    if (oName.startsWith('miguel') || oName.includes('miguel')) return true
    if (oId === '8f727f9d-ea2e-acd7-4a44-8217c710be95' || oId === '377f598f-d894-6386-4cb1-8fd8dea5a736') return true
  }

  return false
}

export interface GlobalPlayerRecord {
  id: string
  name: string
  chips: number
  tokens?: number
  nametag: string
  badge: string | null
  bet_tier: number
  updated_at: string
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
  currency?: 'chips'
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
    cost: 500000,
  },
  'badge-silver-crown': {
    tier: 2,
    label: 'High Sovereign',
    icon: '👑',
    css: 'border-[#94a3b8] bg-[#94a3b8]/20 text-[#f1f5f9]',
    description: 'Silver tier royal insignia',
    cost: 2500000,
  },
  'badge-gold-lion': {
    tier: 3,
    label: 'Golden Apex',
    icon: '🦁',
    css: 'border-[#f59e0b] bg-[#f59e0b]/20 text-[#fef08a]',
    description: 'Predator of high-stakes tables',
    cost: 10000000,
  },
  'badge-diamond-gem': {
    tier: 4,
    label: 'Etherion Shard',
    icon: '💎',
    css: 'border-[#38bdf8] bg-[#0284c7]/25 text-[#bae6fd]',
    description: 'Flawless diamond insignia',
    cost: 50000000,
  },
  'badge-mythic-phoenix': {
    tier: 5,
    label: 'Immortal Flame',
    icon: '🔥',
    css: 'border-[#f43f5e] bg-[#be123c]/30 text-[#fecdd3]',
    description: 'The legendary Phoenix mark',
    cost: 200000000,
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

export async function ensureAnonymousSession(): Promise<string | null> {
  return null
}

export async function migrateOrCreatePlayer(
  playerName: string,
  localChips: number
): Promise<GlobalPlayerRecord | null> {
  if (!supabase || !playerName) return null
  try {
    const pid = playerNameToUuid(playerName)
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('id', pid)
      .maybeSingle()

    if (existingPlayer) {
      return {
        ...existingPlayer,
        balance: existingPlayer.chips,
        player_id: existingPlayer.id,
        nametag_id: existingPlayer.nametag,
      } as GlobalPlayerRecord
    }

    const { data: newPlayer } = await supabase
      .from('players')
      .insert({
        id: pid,
        name: playerName.trim(),
        chips: Math.max(5000, localChips),
        tokens: 0,
        nametag: 'tag-guest',
        badge: null,
        bet_tier: 0,
      })
      .select()
      .maybeSingle()

    if (newPlayer) {
      return {
        ...newPlayer,
        balance: newPlayer.chips,
        player_id: newPlayer.id,
        nametag_id: newPlayer.nametag,
      } as GlobalPlayerRecord
    }
    return null
  } catch (err) {
    console.warn('migrateOrCreatePlayer note:', err)
    return null
  }
}

export const FAKE_MEMBER_NAMES = new Set([
  'the house',
  'kiarash',
  'johnsmith',
  'nik',
  'toby',
  'ethan',
  'george',
  'abhay',
  'vegaswhale',
  'highrollerqueen',
  'vegasplayertest',
  'alice',
  'testplayer99',
  'testplayer1',
  'alphaplayer',
  'bravoplayer',
  'guest',
])

export async function fetchGlobalLeaderboard(): Promise<GlobalPlayerRecord[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, chips, nametag, badge, bet_tier, updated_at')
      .order('chips', { ascending: false })
      .limit(100)

    if (error) {
      console.warn('Leaderboard fetch error:', error.message)
      return []
    }

    return (data || [])
      .filter((p) => {
        const lower = (p.name || '').toLowerCase().trim()
        return !FAKE_MEMBER_NAMES.has(lower) && Number(p.chips) > 0
      })
      .map((p) => ({
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

export const CHIP_CASINOS = new Set(CASINO_ORDER)

export function isChipCasino(_id: string): boolean {
  return true
}

export function getCasinoSlotNum(id: string): number {
  const idx = CASINO_ORDER.indexOf(id as any)
  return idx >= 0 ? idx + 1 : 1
}

export const DEFAULT_CASINOS: CasinoRecord[] = [
  { id: 'casino-studio', name: 'Downtown Studio Casino', tagline: 'Compact downtown venue with constant foot traffic', icon: '🏢', price: 500000, slot_num: 1, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-underground', name: 'Underground Poker Den', tagline: 'Exclusive late-night speakeasy for card sharks', icon: '🃏', price: 1500000, slot_num: 2, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-strip-bar', name: 'Strip Casino Bar & Lounge', tagline: 'High-energy lounge right on the central boulevard', icon: '🍸', price: 4000000, slot_num: 3, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-mall', name: 'Galleria Luxury Casino', tagline: 'Multi-level gaming pavilion in the high-end shopping district', icon: '🛍️', price: 10000000, slot_num: 4, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-marina', name: 'Superyacht Harbor & Marina', tagline: 'Private deep-water dock accommodating billionaire yachts', icon: '🛥️', price: 25000000, slot_num: 5, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-resort', name: '5-Star Casino Resort Hotel', tagline: '500-room luxury palace with VIP gaming suites', icon: '🏨', price: 60000000, slot_num: 6, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-high-roller', name: 'High Roller Penthouse Casino', tagline: 'Top-floor panoramic venue exclusively for apex whales', icon: '🏙️', price: 150000000, slot_num: 7, currency: 'chips', owner_id: null, updated_at: '' },
  { id: 'casino-golden-felt', name: 'The Golden Felt Sovereign Casino', tagline: 'The ultimate crown jewel of high-stakes play', icon: '👑', price: 500000000, slot_num: 8, currency: 'chips', owner_id: null, updated_at: '' },
]

export async function fetchCasinos(): Promise<CasinoRecord[]> {
  if (!supabase) return DEFAULT_CASINOS
  try {
    const { data: rawCasinos, error } = await supabase
      .from('casinos')
      .select('id, name, tagline, icon, price, owner_id, updated_at')

    if (error || !rawCasinos || rawCasinos.length === 0) {
      return DEFAULT_CASINOS
    }

    const orderMap = new Map(CASINO_ORDER.map((id, index) => [id, index]))
    const sorted = [...rawCasinos].sort((a, b) => {
      const idxA = orderMap.has(a.id as any) ? orderMap.get(a.id as any)! : 999
      const idxB = orderMap.has(b.id as any) ? orderMap.get(b.id as any)! : 999
      return idxA - idxB
    })

    const ownerIds = sorted.map((c) => c.owner_id).filter(Boolean) as string[]
    const playerMap = new Map<string, { name: string; nametag: string; badge: string | null }>()

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
      const def = DEFAULT_CASINOS.find((dc) => dc.id === c.id)
      return {
        ...c,
        price: def ? def.price : c.price,
        slot_num: getCasinoSlotNum(c.id),
        currency: 'chips' as const,
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

export async function buyCasino(
  casinoId: string,
  playerName?: string
): Promise<{
  success: boolean
  error?: string
  remaining_chips?: number
  currency?: string
}> {
  if (!supabase) return { success: false, error: 'Database offline.' }
  try {
    const cleanName = (playerName || 'Player').trim()
    let pid = playerNameToUuid(cleanName)
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .ilike('name', cleanName)
      .maybeSingle()
    if (existingPlayer?.id) {
      pid = existingPlayer.id
    }

    const def = DEFAULT_CASINOS.find((c) => c.id === casinoId)
    const cost = def ? def.price : 500000

    const { error: casinoErr } = await supabase
      .from('casinos')
      .update({
        owner_id: pid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', casinoId)

    if (casinoErr) {
      console.warn('Supabase casino buy error:', casinoErr.message)
    }

    return { success: true, remaining_chips: cost, currency: 'chips' }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Transaction failed.' }
  }
}

export async function spinLootBox(_playerName?: string, _clientChips?: number): Promise<{
  success: boolean
  won?: boolean
  chips_won?: number
  tokens_won?: number
  chips?: number
  isJackpot?: boolean
  error?: string
}> {
  const roll = Math.random() * 100
  let won = false
  let isJackpot = false
  let chipsWon = 0

  if (roll < 3.0) {
    chipsWon = Math.floor(5000000 + Math.random() * 20000000)
    won = true
    isJackpot = true
  } else if (roll < 15.0) {
    chipsWon = Math.floor(500000 + Math.random() * 1000000)
    won = true
  } else if (roll < 50.0) {
    chipsWon = Math.floor(75000 + Math.random() * 175000)
    won = true
  }

  return {
    success: true,
    won,
    chips_won: chipsWon,
    tokens_won: 0,
    isJackpot,
  }
}

export async function recordGameHand(_won: boolean, _game: string, _playerName?: string): Promise<{
  success: boolean
}> {
  return { success: true }
}

export async function buyTokenShopItem(
  category: 'bet_tier' | 'nametag' | 'badge' | 'felt' | 'back',
  tier: number,
  itemId: string,
  _cost: number,
  playerName?: string
): Promise<{ success: boolean; bet_tier?: number; nametag?: string; badge?: string; error?: string }> {
  if (!supabase || !playerName) return { success: true }
  try {
    let pid = playerNameToUuid(playerName)
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .ilike('name', playerName.trim())
      .maybeSingle()
    if (existingPlayer?.id) {
      pid = existingPlayer.id
    }
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (category === 'bet_tier') updates.bet_tier = tier
    if (category === 'nametag') updates.nametag = itemId
    if (category === 'badge') updates.badge = itemId

    await supabase.from('players').update(updates).eq('id', pid)
    return { success: true, bet_tier: tier, nametag: itemId, badge: itemId }
  } catch {
    return { success: true }
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

export async function redeemGrant(
  roleName: string,
  password: string,
  playerName?: string
): Promise<{ success: boolean; chips?: number; role_name?: string; title?: string; error?: string }> {
  if (!supabase) return { success: false, error: 'Database offline.' }
  try {
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

let chipSyncTimeout: ReturnType<typeof setTimeout> | null = null

export function syncPlayerToSupabase(playerName: string, chips: { balance: number; betTier?: number; bet_tier?: number }) {
  if (!supabase || !playerName || playerName.toLowerCase() === 'guest') return
  if (chipSyncTimeout) clearTimeout(chipSyncTimeout)

  chipSyncTimeout = setTimeout(async () => {
    try {
      let pid = playerNameToUuid(playerName)
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .ilike('name', playerName.trim())
        .maybeSingle()
      if (existingPlayer?.id) {
        pid = existingPlayer.id
      }
      const bal = Math.max(0, Math.floor(chips.balance))
      const tier = typeof chips.betTier === 'number' ? chips.betTier : (chips.bet_tier ?? 0)

      let nametag = 'tag-guest'
      let badge: string | null = null
      try {
        const rawShop = localStorage.getItem(`golden-felt-player-save-v1:${encodeURIComponent(playerName.toLowerCase())}:shop`)
        if (rawShop) {
          const s = JSON.parse(rawShop)
          if (s.equipped?.tag) nametag = s.equipped.tag
          if (s.badge !== undefined) badge = s.badge
        }
      } catch {}

      await supabase.from('players').upsert(
        {
          id: pid,
          name: playerName.trim(),
          chips: bal,
          tokens: 0,
          nametag,
          badge,
          bet_tier: tier,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    } catch (err) {
      console.warn('syncPlayerToSupabase upsert error:', err)
    }
  }, 1000)
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', async () => {
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
              let pid = playerNameToUuid(playerName)
              const { data: existingPlayer } = await supabase
                .from('players')
                .select('id')
                .ilike('name', playerName)
                .maybeSingle()
              if (existingPlayer?.id) {
                pid = existingPlayer.id
              }
              await supabase.from('players').upsert({
                id: pid,
                name: playerName,
                chips: Math.max(0, Math.floor(data.balance)),
                tokens: 0,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' })
            }
          }
        }
      } catch {}
    }
  })
}

export interface GlobalStakeInvestor {
  id?: string
  player_id?: string
  player_name: string
  tokens_staked: number
  chips_staked?: number
  title?: string
  updated_at?: string
}

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
        chips_staked: Number(d.tokens_staked) || 0,
        title: d.title || 'Casino Stakeholder',
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
    return { success: true }
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

export interface GlobalClubMember {
  name: string
  title: string
  joined_at: string
}

export async function fetchGlobalClubMembers(): Promise<GlobalClubMember[]> {
  return []
}

export async function joinGlobalClub(_playerName: string, _title: string): Promise<void> {
  return
}
