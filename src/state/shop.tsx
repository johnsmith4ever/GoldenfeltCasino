import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useChips } from './chips'
import { playerStorageKey, usePlayer } from './profile'
import { supabase, playerNameToUuid } from '../lib/supabase'

export const DAILY_AMOUNT = 10000
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const NAME_MAX = 16
export const CURRENT_TAG_RESET_VERSION = 11

export type Category = 'felt' | 'back' | 'tag' | 'luxury'

export interface ShopItem {
  id: string
  category: Category
  name: string
  desc: string
  price: number
  /** CSS class applied when equipped. Empty string = use the game's default. */
  css: string
  /** Nametags only: the title printed under the player's name. */
  title?: string
  icon?: string
  level?: number
}

export const CATEGORY_LABEL: Record<Category, string> = {
  felt: 'TABLE FELTS',
  back: 'CARD BACKS',
  tag: 'NAMETAGS',
  luxury: 'LUXURIES & TROPHIES',
}

export const CATALOG: ShopItem[] = [
  // Table Felts (Priced in Chips)
  { id: 'felt-classic', category: 'felt', name: 'House Classic Felt', desc: 'Each table keeps its own classic green baize.', price: 0, css: '' },
  { id: 'felt-royal', category: 'felt', name: 'Royal Blue Baize', desc: 'Deep sapphire baize woven for high-stakes salons.', price: 250000, css: 'felt-royal' },
  { id: 'felt-violet', category: 'felt', name: 'Midnight Violet Velvet', desc: 'A moody plum velvet felt for late-night play.', price: 500000, css: 'felt-violet' },
  { id: 'felt-teal', category: 'felt', name: 'Imperial Teal', desc: 'Cool teal velvet with a jewel-like luster.', price: 1500000, css: 'felt-teal' },
  { id: 'felt-crimson', category: 'felt', name: 'Imperial Crimson', desc: 'Deep blood-red luxury velvet for private high rollers.', price: 5000000, css: 'felt-red' },
  { id: 'felt-gold', category: 'felt', name: 'Gold Leaf Baize', desc: 'Burnished bronze-gold woven cloth. Pure indulgence.', price: 15000000, css: 'felt-gold' },
  { id: 'felt-obsidian', category: 'felt', name: 'Black Obsidian Noir', desc: 'Pitch-black ultra-sleek noir velvet with subtle gold pinstripes.', price: 50000000, css: 'felt-noir' },

  // Card Backs (Priced in Chips)
  { id: 'back-classic', category: 'back', name: 'Crimson Lattice', desc: 'The casino standard playing card back.', price: 0, css: '' },
  { id: 'back-sapphire', category: 'back', name: 'Sapphire Lattice', desc: 'Blue geometric lattice with a polished silver edge.', price: 250000, css: 'card-back-sapphire' },
  { id: 'back-emerald', category: 'back', name: 'Emerald Velvet', desc: 'Deep green lattice with 18K gold filigree trim.', price: 500000, css: 'card-back-emerald' },
  { id: 'back-onyx', category: 'back', name: 'Onyx Goldfoil', desc: 'Black obsidian finish with fine gold linework.', price: 1500000, css: 'card-back-onyx' },
  { id: 'back-dragon', category: 'back', name: 'Imperial Dragon', desc: 'Gilded dragon scales embossed in crimson and gold.', price: 5000000, css: 'card-back-goldfoil' },
  { id: 'back-goldfoil', category: 'back', name: 'Solid Gold Foil', desc: 'Mirror-polished gold foil from corner to corner.', price: 15000000, css: 'card-back-goldfoil' },
  { id: 'back-hologram', category: 'back', name: 'Prismatic Hologram', desc: 'Iridescent holographic foil with shifting rainbow reflections.', price: 50000000, css: 'card-back-sapphire' },

  // Nametags - Levels 1 to 12 (Chips progression)
  { id: 'tag-guest', category: 'tag', name: 'Level 1: Novice', desc: 'A plain, understated bronze nameplate.', price: 0, css: 'tag-guest', title: 'NOVICE', level: 1 },
  { id: 'tag-silver', category: 'tag', name: 'Level 2: Regular', desc: 'Brushed silver. Quietly confident.', price: 100000, css: 'tag-silver', title: 'REGULAR', level: 2 },
  { id: 'tag-gold', category: 'tag', name: 'Level 3: Member', desc: 'A polished 18K gold nameplate.', price: 350000, css: 'tag-gold', title: 'MEMBER', level: 3 },
  { id: 'tag-crimson', category: 'tag', name: 'Level 4: High Roller', desc: 'Crimson velvet plate for big spenders.', price: 1000000, css: 'tag-crimson', title: 'HIGH ROLLER', level: 4 },
  { id: 'tag-emerald', category: 'tag', name: 'Level 5: VIP Club', desc: 'Emerald plate, velvet-rope status.', price: 2500000, css: 'tag-emerald', title: 'VIP CLUB', level: 5 },
  { id: 'tag-legend', category: 'tag', name: 'Level 6: Golden Legend', desc: 'Animated shimmering 24K gold nameplate.', price: 6000000, css: 'tag-legend', title: 'LEGEND', level: 6 },
  { id: 'tag-baron', category: 'tag', name: 'Level 7: Diamond Baron', desc: 'Electric diamond cyan glow with ice crystal trim.', price: 15000000, css: 'tag-baron', title: 'DIAMOND BARON', level: 7 },
  { id: 'tag-mogul', category: 'tag', name: 'Level 8: Casino Mogul', desc: 'Rich imperial ruby plate with 24K gold filigree.', price: 35000000, css: 'tag-mogul', title: 'CASINO MOGUL', level: 8 },
  { id: 'tag-whale', category: 'tag', name: 'Level 9: Apex Whale', desc: 'Deep ocean navy with iridescent turquoise reflections.', price: 75000000, css: 'tag-whale', title: 'APEX WHALE', level: 9 },
  { id: 'tag-house', category: 'tag', name: 'Level 10: The House', desc: 'Obsidian & pulsing gold border. You are the house.', price: 150000000, css: 'tag-house', title: 'THE HOUSE', level: 10 },
  { id: 'tag-immortal', category: 'tag', name: 'Level 11: Immortal Gambler', desc: 'Cosmic electric violet & golden solar flare aura.', price: 300000000, css: 'tag-immortal', title: 'IMMORTAL', level: 11 },
  { id: 'tag-founder', category: 'tag', name: 'Level 12: Supreme Founder', desc: 'Royal purple velvet & supreme 24K imperial seal.', price: 600000000, css: 'tag-founder', title: 'FOUNDER', level: 12 },

  // Luxury Collectibles & Trophies
  { id: 'lux-horseshoe', category: 'luxury', name: 'Solid Gold Lucky Horseshoe', desc: 'Hand-forged 24K bullion. Brings good fortune to every table.', price: 500000, css: '', icon: '🧲' },
  { id: 'lux-dice', category: 'luxury', name: 'Diamond-Studded Obsidian Dice', desc: 'Weighted precision dice with real diamond pips for luck.', price: 1500000, css: '', icon: '🎲' },
  { id: 'lux-champagne', category: 'luxury', name: 'Dom Pérignon Vintage VIP Service', desc: 'Chilled crystal bottle delivered directly to your high-stakes table.', price: 3000000, css: '', icon: '🍾' },
  { id: 'lux-rolex', category: 'luxury', name: 'Goldenfelt Royal Chronometer', desc: 'Swiss movement 18K solid-gold timepiece engraved with MMXXVI.', price: 10000000, css: '', icon: '⌚' },
  { id: 'lux-penthouse', category: 'luxury', name: 'Casino Penthouse Rooftop Key', desc: 'Unlocks the master rooftop penthouse suite overlooking the casino strip.', price: 35000000, css: '', icon: '🗝️' },
  { id: 'lux-jet', category: 'luxury', name: 'Private Gulfstream Casino Jet', desc: 'Fly directly to Monaco and Macau in the ultimate private luxury jet.', price: 100000000, css: '', icon: '✈️' },
  { id: 'lux-megayacht', category: 'luxury', name: 'Sovereign Casino Megayacht', desc: '300-foot multi-deck superyacht with helipad and private casino salon.', price: 250000000, css: '', icon: '🛥️' },
  { id: 'lux-island', category: 'luxury', name: 'Sovereign Golden Felt Island', desc: 'Private offshore island nation with tax-free gaming privileges.', price: 500000000, css: '', icon: '🏝️' },
]

export const ITEMS_BY_ID: Record<string, ShopItem> = Object.fromEntries(CATALOG.map((i) => [i.id, i]))

export type EquippableCategory = 'felt' | 'back' | 'tag'

const DEFAULT_EQUIPPED: Record<EquippableCategory, string> = {
  felt: 'felt-classic',
  back: 'back-classic',
  tag: 'tag-guest',
}

const FREE_IDS = CATALOG.filter((i) => i.price === 0).map((i) => i.id)

interface ShopState {
  lastClaim: number
  lastClaimDay: string
  streak: number
  owned: string[]
  equipped: Record<EquippableCategory, string>
  name: string
  badge?: string | null
  tagResetVersion?: number
}

function cleanName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').slice(0, NAME_MAX)
}

function load(playerName: string): ShopState {
  const fresh: ShopState = {
    lastClaim: 0,
    lastClaimDay: '',
    streak: 0,
    owned: [...FREE_IDS],
    equipped: { ...DEFAULT_EQUIPPED },
    name: playerName,
    badge: null,
    tagResetVersion: CURRENT_TAG_RESET_VERSION,
  }
  try {
    const raw = localStorage.getItem(playerStorageKey('shop', playerName))
    if (!raw) return fresh
    const p = JSON.parse(raw)

    const owned = new Set<string>(FREE_IDS)
    if (Array.isArray(p.owned)) {
      for (const id of p.owned) {
        if (typeof id === 'string' && ITEMS_BY_ID[id]) {
          owned.add(id)
        }
      }
    }

    const equipped = { ...DEFAULT_EQUIPPED }
    for (const cat of ['felt', 'back', 'tag'] as EquippableCategory[]) {
      const id = p.equipped?.[cat]
      if (typeof id === 'string' && ITEMS_BY_ID[id]?.category === cat && owned.has(id)) {
        equipped[cat] = id
      }
    }

    const result: ShopState = {
      lastClaim: typeof p.lastClaim === 'number' ? p.lastClaim : 0,
      lastClaimDay: typeof p.lastClaimDay === 'string' ? p.lastClaimDay : '',
      streak: Number.isFinite(p.streak) ? Math.max(0, p.streak) : 0,
      owned: [...owned],
      equipped,
      name: playerName && playerName.toLowerCase() !== 'guest' ? cleanName(playerName) : 'Player',
      badge: typeof p.badge === 'string' ? p.badge : null,
      tagResetVersion: CURRENT_TAG_RESET_VERSION,
    }

    return result
  } catch {
    return fresh
  }
}

export function msUntilClaim(lastClaim: number, now: number): number {
  const elapsed = now - lastClaim
  return Math.max(0, DAILY_COOLDOWN_MS - elapsed)
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

interface ShopContextValue extends ShopState {
  storageError: string
  isOwned: (id: string) => boolean
  buy: (id: string) => 'bought' | 'owned' | 'poor' | 'unknown'
  equip: (id: string) => boolean
  claim: () => boolean
  openMysteryCrate: () => { ok: boolean; message: string }
  setName: (name: string) => void
  setBadge: (badge: string | null) => void
  unlockItem: (id: string, category?: EquippableCategory) => void
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function ShopProvider({ children }: { children: ReactNode }) {
  const { spend, credit, consumeStreakShield, useToken } = useChips()
  const { activeName } = usePlayer()
  const playerName = activeName ?? 'Player'
  const [state, setState] = useState(() => load(playerName))
  const ref = useRef(state)
  const [storageError, setStorageError] = useState('')

  useEffect(() => {
    ref.current = state
    try {
      localStorage.setItem(playerStorageKey('shop', playerName), JSON.stringify(state))
      setStorageError('')
    } catch {
      setStorageError('Shop progress could not be saved. Browser storage may be full or disabled.')
    }
  }, [state, playerName])

  const update = useCallback((fn: (s: ShopState) => ShopState) => {
    const next = fn(ref.current)
    ref.current = next
    setState(next)
    try {
      localStorage.setItem(playerStorageKey('shop', playerName), JSON.stringify(next))
      setStorageError('')
    } catch {
      setStorageError('Shop progress could not be saved. Browser storage may be full or disabled.')
    }
  }, [playerName])

  // Sync state.name whenever playerName changes
  useEffect(() => {
    if (playerName && playerName.toLowerCase() !== 'guest' && ref.current.name !== playerName) {
      update((s) => ({ ...s, name: playerName }))
    }
  }, [playerName, update])

  // Fetch remote nametag and badge from Supabase on mount using deterministic player ID
  useEffect(() => {
    if (supabase && playerName && playerName.toLowerCase() !== 'guest') {
      const pid = playerNameToUuid(playerName)
      supabase
        .from('players')
        .select('nametag, badge')
        .eq('id', pid)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            update((s) => ({
              ...s,
              equipped: { ...s.equipped, tag: data.nametag || s.equipped.tag },
              badge: data.badge !== undefined ? data.badge : s.badge,
              owned: data.nametag && !s.owned.includes(data.nametag) ? [...s.owned, data.nametag] : s.owned,
            }))
          }
        })
    }
  }, [playerName, update])

  const openMysteryCrate = useCallback(() => {
    const used = useToken('mysteryCrate')
    if (!used.ok) return used
    const cosmeticPool = CATALOG.filter((item) => item.price > 0 && !ref.current.owned.includes(item.id))
    if (cosmeticPool.length > 0 && Math.random() < 0.65) {
      const prize = cosmeticPool[Math.floor(Math.random() * cosmeticPool.length)]
      update((s) => ({ ...s, owned: [...s.owned, prize.id] }))
      return { ok: true, message: `Mystery Crate prize: ${prize.name} unlocked!` }
    }
    const chips = 25000 + Math.floor(Math.random() * 75001)
    credit(chips)
    return { ok: true, message: `Mystery Crate prize: ${chips.toLocaleString('en-US')} chips.` }
  }, [credit, update, useToken])

  const buy = useCallback<ShopContextValue['buy']>(
    (id) => {
      const item = ITEMS_BY_ID[id]
      if (!item) return 'unknown'
      if (ref.current.owned.includes(id)) return 'owned'
      if (!spend(item.price)) return 'poor'
      update((s) => ({
        ...s,
        owned: [...s.owned, id],
        equipped: item.category !== 'luxury' ? { ...s.equipped, [item.category]: id } : s.equipped,
      }))
      return 'bought'
    },
    [spend, update],
  )

  const equip = useCallback(
    (id: string) => {
      const item = ITEMS_BY_ID[id]
      if (!item || item.category === 'luxury') return false
      if (!ref.current.owned.includes(id) && !FREE_IDS.includes(id)) {
        return false
      }
      update((s) => ({
        ...s,
        owned: s.owned.includes(id) ? s.owned : [...s.owned, id],
        equipped: { ...s.equipped, [item.category]: id },
      }))
      return true
    },
    [update],
  )

  const unlockItem = useCallback((id: string, category: EquippableCategory = 'tag') => {
    update((s) => ({
      ...s,
      owned: s.owned.includes(id) ? s.owned : [...s.owned, id],
      equipped: { ...s.equipped, [category]: id },
    }))
  }, [update])

  const setBadge = useCallback((badge: string | null) => {
    update((s) => ({ ...s, badge }))
  }, [update])

  const claim = useCallback(() => {
    const now = Date.now()
    if (msUntilClaim(ref.current.lastClaim, now) > 0) return false
    const day = new Date(now).toISOString().slice(0, 10)
    const previousDay = ref.current.lastClaimDay || (ref.current.lastClaim ? new Date(ref.current.lastClaim).toISOString().slice(0, 10) : '')
    const previousDate = previousDay ? Date.parse(`${previousDay}T00:00:00Z`) : 0
    const currentDate = Date.parse(`${day}T00:00:00Z`)
    const gapDays = previousDate ? Math.round((currentDate - previousDate) / 86400000) : 0
    const streak = !previousDay ? 1 : gapDays === 1 ? ref.current.streak + 1 : gapDays === 0 ? ref.current.streak : gapDays === 2 && consumeStreakShield() ? ref.current.streak + 1 : 1
    credit(DAILY_AMOUNT)
    update((s) => ({ ...s, lastClaim: now, lastClaimDay: day, streak }))
    return true
  }, [credit, update, consumeStreakShield])

  const setName = useCallback((name: string) => update((s) => ({ ...s, name: cleanName(name) })), [update])

  const value = useMemo<ShopContextValue>(
    () => ({
      ...state,
      storageError,
      isOwned: (id) => state.owned.includes(id),
      buy,
      equip,
      claim,
      openMysteryCrate,
      setName,
      setBadge,
      unlockItem,
    }),
    [state, storageError, buy, equip, claim, openMysteryCrate, setName, setBadge, unlockItem],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used inside ShopProvider')
  return ctx
}
