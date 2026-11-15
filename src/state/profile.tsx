import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ensureAnonymousSession, migrateOrCreatePlayer } from '../lib/supabase'

const ACTIVE_KEY = 'golden-felt-active-player-v1'
const PLAYERS_KEY = 'golden-felt-player-list-v1'
const SAVE_PREFIX = 'golden-felt-player-save-v1:'

// Purge any legacy 'guest' active identity on startup
try {
  const active = localStorage.getItem(ACTIVE_KEY)
  if (active && active.toLowerCase().trim() === 'guest') {
    localStorage.removeItem(ACTIVE_KEY)
  }
} catch {}

export function cleanPlayerName(value: string) {
  // Strip unsafe characters, keep alphanumeric, spaces, dots, dashes, underscores
  return value.trim().replace(/\s+/g, ' ').replace(/[^\w\s.-]/gu, '').slice(0, 16)
}

function slug(name: string) { return encodeURIComponent(cleanPlayerName(name).toLocaleLowerCase()) }

function readPlayers(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PLAYERS_KEY) ?? '[]')
    const list: string[] = Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.toLowerCase().trim() !== 'guest' && x.trim() !== '')
      : []

    // Always scan localStorage to discover all existing player identities so no old account is ever lost
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(SAVE_PREFIX) && k.endsWith(':chips')) {
        const match = k.match(new RegExp(`^${SAVE_PREFIX}(.+):chips$`))
        if (match && match[1]) {
          const rawSlug = match[1]
          if (rawSlug.toLowerCase() !== 'guest') {
            const decoded = decodeURIComponent(rawSlug)
            const clean = cleanPlayerName(decoded)
            if (clean && clean.toLowerCase() !== 'guest' && !list.some((p) => p.toLowerCase() === clean.toLowerCase())) {
              list.push(clean)
            }
          }
        }
      }
    }

    if (list.length === 0 && localStorage.getItem('golden-felt-chips-v1')) {
      list.push('Player')
    }

    // Never allow 'guest' in the player list
    const filtered = list.filter((p) => p.toLowerCase() !== 'guest' && p.trim() !== '')

    // Persist complete list
    try {
      localStorage.setItem(PLAYERS_KEY, JSON.stringify(filtered))
    } catch {}

    return filtered
  } catch { return [] }
}

function readActive(): string | null {
  try {
    const v = localStorage.getItem(ACTIVE_KEY)
    if (v && v.trim() && v.toLowerCase().trim() !== 'guest') return v.trim()
    const existing = readPlayers()
    if (existing.length > 0) {
      try { localStorage.setItem(ACTIVE_KEY, existing[0]) } catch {}
      return existing[0]
    }
    return null
  } catch { return null }
}

export function playerStorageKey(namespace: string, playerName?: string | null) {
  const active = readActive()
  const name = playerName ?? active
  const clean = name ? cleanPlayerName(name) : ''
  const finalName = clean && clean.toLowerCase() !== 'guest' ? clean : 'player'
  return `${SAVE_PREFIX}${slug(finalName)}:${namespace}`
}

interface ProfileContextValue {
  activeName: string | null
  players: string[]
  createPlayer: (name: string) => { ok: boolean; error?: string }
  updatePlayerName: (name: string) => { ok: boolean; error?: string }
  switchPlayer: (name: string) => boolean
  startNewPlayer: () => void
  exportSave: () => string
  importSave: (code: string) => { ok: boolean; error?: string }
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState(readPlayers)
  const [activeName, setActiveName] = useState(readActive)

  // Establish stable anonymous auth on load
  useEffect(() => {
    ensureAnonymousSession().then((uid) => {
      if (uid && activeName && activeName.toLowerCase() !== 'guest') {
        let localChips = 5000
        try {
          const raw = localStorage.getItem(playerStorageKey('chips', activeName))
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Number.isFinite(parsed?.balance)) localChips = parsed.balance
          }
        } catch {}
        migrateOrCreatePlayer(activeName, localChips)
      }
    })
  }, [activeName])

  const persistPlayers = useCallback((next: string[]) => {
    const cleanList = next.filter((p) => p.toLowerCase() !== 'guest' && p.trim() !== '')
    setPlayers(cleanList)
    try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(cleanList)) }
    catch { return false }
    return true
  }, [])

  const createPlayer = useCallback((raw: string) => {
    const name = cleanPlayerName(raw)
    if (name.length < 3 || name.length > 16) {
      return { ok: false, error: 'Please use a name between 3 and 16 characters.' }
    }
    if (name.toLowerCase() === 'guest') {
      return { ok: false, error: 'The name "Guest" is reserved. Please choose a real player name.' }
    }
    const exists = players.find((p) => p.toLocaleLowerCase() === name.toLocaleLowerCase())
    const chosen = exists ?? name
    try {
      if (!exists) {
        const oldChips = localStorage.getItem('golden-felt-chips-v1')
        const oldShop = localStorage.getItem('golden-felt-shop-v1')
        if (oldChips && !localStorage.getItem(playerStorageKey('chips', chosen))) localStorage.setItem(playerStorageKey('chips', chosen), oldChips)
        if (oldShop && !localStorage.getItem(playerStorageKey('shop', chosen))) localStorage.setItem(playerStorageKey('shop', chosen), oldShop)
      }
      const next = exists ? players : [...players, chosen]
      if (!persistPlayers(next)) return { ok: false, error: 'Your browser could not save the player list.' }
      localStorage.setItem(ACTIVE_KEY, chosen)
      setActiveName(chosen)

      // Sync into Supabase players row
      let chipsVal = 5000
      try {
        const raw = localStorage.getItem(playerStorageKey('chips', chosen))
        if (raw) {
          const p = JSON.parse(raw)
          if (Number.isFinite(p?.balance)) chipsVal = p.balance
        }
      } catch {}
      migrateOrCreatePlayer(chosen, chipsVal)

      return { ok: true }
    } catch {
      return { ok: false, error: 'Saving is unavailable in this browser.' }
    }
  }, [players, persistPlayers])

  // Permanent immutable identity: name changes are permanently disabled
  const updatePlayerName = useCallback((_raw: string) => {
    return {
      ok: false,
      error: 'Player names are permanent and locked to your casino identity. Name changes have been permanently disabled.',
    }
  }, [])

  const switchPlayer = useCallback((name: string) => {
    const existing = players.find((p) => p.toLocaleLowerCase() === name.toLocaleLowerCase())
    const target = existing ?? cleanPlayerName(name)
    if (!target || target.toLowerCase() === 'guest') return false
    try {
      localStorage.setItem(ACTIVE_KEY, target)
      setActiveName(target)
      window.dispatchEvent(new Event('player-switched'))
      return true
    } catch {
      return false
    }
  }, [players])

  const startNewPlayer = useCallback(() => {
    try { localStorage.removeItem(ACTIVE_KEY) } catch {}
    setActiveName(null)
  }, [])

  const exportSave = useCallback(() => {
    if (!activeName || activeName.toLowerCase() === 'guest') return ''
    const prefix = playerStorageKey('', activeName)
    const data: Record<string, string> = {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(prefix)) data[key.slice(prefix.length)] = localStorage.getItem(key) ?? ''
      }
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({ format: 'golden-felt-save', version: 1, player: activeName, data }))))
      return `GF1.${encoded}`
    } catch { return '' }
  }, [activeName])

  const importSave = useCallback((raw: string) => {
    if (!activeName || activeName.toLowerCase() === 'guest') return { ok: false, error: 'Create or select a player first.' }
    try {
      const code = raw.trim().replace(/^GF1\./, '')
      const parsed = JSON.parse(decodeURIComponent(escape(atob(code)))) as { format?: string; version?: number; data?: Record<string, unknown> }
      if (parsed.format !== 'golden-felt-save' || parsed.version !== 1 || !parsed.data || typeof parsed.data !== 'object') {
        return { ok: false, error: 'That save code is not a valid Golden Felt backup.' }
      }
      const prefix = playerStorageKey('', activeName)
      for (const [key, value] of Object.entries(parsed.data)) {
        if (!/^[a-z0-9-]+$/i.test(key) || typeof value !== 'string') continue
        localStorage.setItem(`${prefix}${key}`, value)
      }
      return { ok: true }
    } catch {
      return { ok: false, error: 'The backup code is invalid.' }
    }
  }, [activeName])

  const value = useMemo(() => ({
    activeName,
    players,
    createPlayer,
    updatePlayerName,
    switchPlayer,
    startNewPlayer,
    exportSave,
    importSave,
  }), [activeName, players, createPlayer, updatePlayerName, switchPlayer, startNewPlayer, exportSave, importSave])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function usePlayer() {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider')
  return value
}
