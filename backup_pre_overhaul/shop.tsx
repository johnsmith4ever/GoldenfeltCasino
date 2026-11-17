import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useChips } from './chips'
import { playerStorageKey, usePlayer } from './profile'
import { supabase, ensureAnonymousSession } from '../lib/supabase'

export const DAILY_AMOUNT = 5000
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const NAME_MAX = 16
export const CURRENT_TAG_RESET_VERSION = 10

// Startup sweep: automatically reset all players' decks (card backs) and table felts across localStorage
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('golden-felt') && k.endsWith(':shop')) {
        const val = localStorage.getItem(k)
        if (val) {
          try {
            const parsed = JSON.parse(val)
            if (parsed && typeof parsed === 'object') {
              const ver = typeof parsed.tagResetVersion === 'number' ? parsed.tagResetVersion : 0
              if (ver < CURRENT_TAG_RESET_VERSION) {
                const cleanedOwned = Array.isArray(parsed.owned)
                  ? parsed.owned.filter((id: string) => {
                    const item = ITEMS_BY_ID[id]
                    if (!item) return false
                    if ((item.category === 'felt' || item.category === 'back') && (item.tokenCost ?? 0) > 0) {
                      return false
                    }
                    if (item.category === 'tag' && id !== 'tag-guest') {
                      return false
                    }
                    return true
                  })
                  : ['felt-classic', 'back-classic', 'tag-guest']
                if (!cleanedOwned.includes('felt-classic')) cleanedOwned.push('felt-classic')
                if (!cleanedOwned.includes('back-classic')) cleanedOwned.push('back-classic')
                if (!cleanedOwned.includes('tag-guest')) cleanedOwned.push('tag-guest')
                parsed.owned = cleanedOwned
                parsed.equipped = {
                  ...(parsed.equipped || {}),
                  felt: 'felt-classic',
                  back: 'back-classic',
                }
                parsed.tagResetVersion = CURRENT_TAG_RESET_VERSION
                localStorage.setItem(k, JSON.stringify(parsed))
              }
            }
          } catch { }
        }
      }
    }
  }
} catch { }

export type Category = 'felt' | 'back' | 'tag' | 'luxury'

export interface ShopItem {
  id: string
  category: Category
  name: string
  desc: string
  price: number
  tokenCost?: number
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
  // Table felts (Tokens only)
  { id: 'felt-classic', category: 'felt', name: 'House Felt', desc: 'Each table keeps its own classic colour.', price: 0, tokenCost: 0, css: '' },
  { id: 'felt-royal', category: 'felt', name: 'Royal Blue', desc: 'Deep sapphire baize, very high-stakes.', price: 0, tokenCost: 50, css: 'felt-royal' },
  { id: 'felt-violet', category: 'felt', name: 'Midnight Violet', desc: 'A moody plum felt for late-night play.', price: 0, tokenCost: 100, css: 'felt-violet' },
  { id: 'felt-teal', category: 'felt', name: 'Imperial Teal', desc: 'Cool teal with a jewel-like glow.', price: 0, tokenCost: 250, css: 'felt-teal' },
  { id: 'felt-crimson', category: 'felt', name: 'Imperial Crimson', desc: 'Deep blood-red luxury velvet for high rollers.', price: 0, tokenCost: 500, css: 'felt-red' },
  { id: 'felt-gold', category: 'felt', name: 'Gold Leaf', desc: 'Burnished bronze-gold. Pure indulgence.', price: 0, tokenCost: 1000, css: 'felt-gold' },
  { id: 'felt-obsidian', category: 'felt', name: 'Black Obsidian', desc: 'Pitch-black ultra-sleek noir felt.', price: 0, tokenCost: 2500, css: 'felt-noir' },

  // Card backs (Tokens only)
  { id: 'back-classic', category: 'back', name: 'Crimson Lattice', desc: 'The house standard.', price: 0, tokenCost: 0, css: '' },
  { id: 'back-sapphire', category: 'back', name: 'Sapphire', desc: 'Blue lattice with a silver edge.', price: 0, tokenCost: 50, css: 'card-back-sapphire' },
  { id: 'back-emerald', category: 'back', name: 'Emerald', desc: 'Green lattice, gold trim.', price: 0, tokenCost: 100, css: 'card-back-emerald' },
  { id: 'back-onyx', category: 'back', name: 'Onyx', desc: 'Black with fine gold linework.', price: 0, tokenCost: 250, css: 'card-back-onyx' },
  { id: 'back-dragon', category: 'back', name: 'Imperial Dragon', desc: 'Gilded dragon scales in crimson and gold.', price: 0, tokenCost: 500, css: 'card-back-goldfoil' },
  { id: 'back-goldfoil', category: 'back', name: 'Gold Foil', desc: 'Polished gold from corner to corner.', price: 0, tokenCost: 1000, css: 'card-back-goldfoil' },
  { id: 'back-hologram', category: 'back', name: 'Prismatic Hologram', desc: 'Iridescent holographic foil with shifting colours.', price: 0, tokenCost: 2500, css: 'card-back-sapphire' },

  // Nametags - Levels 1 to 12 (Paid tier progression)
  { id: 'tag-guest', category: 'tag', name: 'Level 1: Novice', desc: 'A plain, understated bronze nameplate.', price: 0, css: 'tag-guest', title: 'NOVICE', level: 1 },
  { id: 'tag-silver', category: 'tag', name: 'Level 2: Regular', desc: 'Brushed silver. Quietly confident.', price: 25000, css: 'tag-silver', title: 'REGULAR', level: 2 },
  { id: 'tag-gold', category: 'tag', name: 'Level 3: Member', desc: 'A polished 18K gold nameplate.', price: 75000, css: 'tag-gold', title: 'MEMBER', level: 3 },
  { id: 'tag-crimson', category: 'tag', name: 'Level 4: High Roller', desc: 'Crimson velvet plate for big spenders.', price: 150000, css: 'tag-crimson', title: 'HIGH ROLLER', level: 4 },
  { id: 'tag-emerald', category: 'tag', name: 'Level 5: VIP Club', desc: 'Emerald plate, velvet-rope status.', price: 350000, css: 'tag-emerald', title: 'VIP CLUB', level: 5 },
  { id: 'tag-legend', category: 'tag', name: 'Level 6: Golden Legend', desc: 'Animated shimmering 24K gold nameplate.', price: 750000, css: 'tag-legend', title: 'LEGEND', level: 6 },
  { id: 'tag-baron', category: 'tag', name: 'Level 7: Diamond Baron', desc: 'Electric diamond cyan glow with ice crystal trim.', price: 1500000, css: 'tag-baron', title: 'DIAMOND BARON', level: 7 },
  { id: 'tag-mogul', category: 'tag', name: 'Level 8: Casino Mogul', desc: 'Rich imperial ruby plate with 24K gold filigree.', price: 3500000, css: 'tag-mogul', title: 'CASINO MOGUL', level: 8 },
  { id: 'tag-whale', category: 'tag', name: 'Level 9: Apex Whale', desc: 'Deep ocean navy with iridescent turquoise reflections.', price: 7500000, css: 'tag-whale', title: 'APEX WHALE', level: 9 },
  { id: 'tag-house', category: 'tag', name: 'Level 10: The House', desc: 'Obsidian & pulsing gold border. You are the house.', price: 15000000, css: 'tag-house', title: 'THE HOUSE', level: 10 },
  { id: 'tag-immortal', category: 'tag', name: 'Level 11: Immortal Gambler', desc: 'Cosmic electric violet & golden solar flare aura.', price: 30000000, css: 'tag-immortal', title: 'IMMORTAL', level: 11 },
  { id: 'tag-founder', category: 'tag', name: 'Level 12: Supreme Founder', desc: 'Royal purple velvet & supreme 24K imperial seal.', price: 60000000, css: 'tag-founder', title: 'FOUNDER', level: 12 },

  // Random Luxury Collectibles & Trophies
  { id: 'lux-horseshoe', category: 'luxury', name: 'Solid Gold Lucky Horseshoe', desc: 'Hand-forged 24K bullion. Brings good fortune to every table.', price: 35000, css: '', icon: '🧲' },
  { id: 'lux-dice', category: 'luxury', name: 'Diamond-Studded Obsidian Dice', desc: 'Weighted precision dice with real diamond pips for luck.', price: 75000, css: '', icon: '🎲' },
  { id: 'lux-champagne', category: 'luxury', name: 'Dom Pérignon Vintage VIP Service', desc: 'Chilled crystal bottle delivered directly to your high-stakes table.', price: 125000, css: '', icon: '🍾' },
  { id: 'lux-rolex', category: 'luxury', name: 'Goldenfelt Royal Chronometer', desc: 'Swiss movement 18K solid-gold timepiece engraved with MMXXVI.', price: 35000, css: '', icon: '⌚' },
  { id: 'lux-penthouse', category: 'luxury', name: 'Casino Penthouse Rooftop Key', desc: 'Unlocks the master rooftop penthouse suite overlooking the casino strip.', price: 750000, css: '', icon: '🗝️' },
  { id: 'lux-jet', category: 'luxury', name: 'Private Gulfstream Casino Jet', desc: 'Fly directly to Monaco and Macau in the ultimate private luxury jet.', price: 1500000, css: '', icon: '✈️' },
]

export const ITEMS_BY_ID: Record<string, ShopItem> = Object.fromEntries(CATALOG.map((i) => [i.id, i]))

export type EquippableCategory = 'felt' | 'back' | 'tag'

const DEFAULT_EQUIPPED: Record<EquippableCategory, string> = {
  felt: 'felt-classic',
  back: 'back-classic',
  tag: 'tag-guest',
}

const FREE_IDS = CATALOG.filter((i) => i.price === 0 && (!i.tokenCost || i.tokenCost === 0)).map((i) => i.id)

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
    const isOldVersion = (p.tagResetVersion ?? 0) < CURRENT_TAG_RESET_VERSION

    const owned = new Set<string>(FREE_IDS)
    if (Array.isArray(p.owned)) {
      for (const id of p.owned) {
        if (typeof id === 'string' && ITEMS_BY_ID[id]) {
          // If migrating from v2 where all felts/backs were mistakenly included in FREE_IDS:
          if (isOldVersion && (ITEMS_BY_ID[id].tokenCost ?? 0) > 0) {
            continue
          }
          if (isOldVersion && ITEMS_BY_ID[id].category === 'tag' && id !== 'tag-guest') {
            continue
          }
          owned.add(id)
        }
      }
    }

    const equipped = { ...DEFAULT_EQUIPPED }
    for (const cat of ['felt', 'back', 'tag'] as EquippableCategory[]) {
      if (isOldVersion && (cat === 'felt' || cat === 'back')) {
        equipped[cat] = DEFAULT_EQUIPPED[cat]
        continue
      }
      const id = p.equipped?.[cat]
      if (typeof id === 'string' && ITEMS_BY_ID[id]?.category === cat && owned.has(id)) {
        equipped[cat] = id
      }
    }

    const result: ShopState = {
      lastClaim: typeof p.lastClaim === 'number' ? p.lastClaim : 0,
      lastClaimDay: typeof p.lastClaimDay === 'string' ? p.lastClaimDay : (typeof p.lastClaim === 'number' && p.lastClaim ? new Date(p.lastClaim).toISOString().slice(0, 10) : ''),
      streak: Number.isFinite(p.streak) ? Math.max(0, p.streak) : 0,
      owned: [...owned],
      equipped,
      name: playerName && playerName.toLowerCase() !== 'guest' ? cleanName(playerName) : (typeof p.name === 'string' && p.name.toLowerCase() !== 'guest' ? cleanName(p.name) : 'Player'),
      badge: typeof p.badge === 'string' ? p.badge : null,
      tagResetVersion: CURRENT_TAG_RESET_VERSION,
    }

    if (isOldVersion) {
      try {
        localStorage.setItem(playerStorageKey('shop', playerName), JSON.stringify(result))
      } catch { }
    }

    return result
  } catch {
    return fresh
  }
}

/** Milliseconds until the daily gift can be claimed again (0 = ready now). */
export function msUntilClaim(lastClaim: number, now: number): number {
  const elapsed = now - lastClaim
  // Clock rollback must extend the cooldown, never bypass it.
  return Math.max(0, DAILY_COOLDOWN_MS - elapsed)
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Re-renders the caller every `intervalMs` and returns the current time. */
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
    try { localStorage.setItem(playerStorageKey('shop', playerName), JSON.stringify(next)); setStorageError('') }
    catch { setStorageError('Shop progress could not be saved. Browser storage may be full or disabled.') }
  }, [playerName])

  // Sync state.name whenever playerName changes
  useEffect(() => {
    if (playerName && playerName.toLowerCase() !== 'guest' && ref.current.name !== playerName) {
      update((s) => ({ ...s, name: playerName }))
    }
  }, [playerName, update])

  // Fetch remote nametag and badge from Supabase on mount
  useEffect(() => {
    if (supabase && playerName && playerName.toLowerCase() !== 'guest') {
      ensureAnonymousSession().then((uid) => {
        if (uid && supabase) {
          supabase
            .from('players')
            .select('nametag, badge')
            .eq('id', uid)
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
      return { ok: true, message: `Mystery Crate prize: ${prize.name} unlocked.` }
    }
    const chips = 500 + Math.floor(Math.random() * 1501)
    credit(chips)
    return { ok: true, message: `Mystery Crate prize: ${chips.toLocaleString('en-US')} chips.` }
  }, [credit, update, useToken])

  const buy = useCallback<ShopContextValue['buy']>(
    (id) => {
      const item = ITEMS_BY_ID[id]
      if (!item) return 'unknown'
      // Nametags, felts and backs with token costs CANNOT be bought with chips — tokens only!
      if (item.category === 'tag' || (item.tokenCost ?? 0) > 0) return 'unknown'
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
      // Cannot equip unless owned or free default
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
