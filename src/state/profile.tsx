import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const ACTIVE_KEY = 'golden-felt-active-player-v1'
const PLAYERS_KEY = 'golden-felt-player-list-v1'
const SAVE_PREFIX = 'golden-felt-player-save-v1:'

function cleanPlayerName(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 16)
}
function slug(name: string) { return encodeURIComponent(cleanPlayerName(name).toLocaleLowerCase()) }
function readPlayers(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PLAYERS_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
function readActive(): string | null {
  try {
    const v = localStorage.getItem(ACTIVE_KEY)
    return v && v.trim() ? v : null
  } catch { return null }
}

export function playerStorageKey(namespace: string, playerName?: string | null) {
  const name = playerName ?? readActive()
  return `${SAVE_PREFIX}${name ? slug(name) : 'guest'}:${namespace}`
}

interface ProfileContextValue {
  activeName: string | null
  players: string[]
  createPlayer: (name: string) => { ok: boolean; error?: string }
  switchPlayer: (name: string) => boolean
  startNewPlayer: () => void
  exportSave: () => string
  importSave: (code: string) => { ok: boolean; error?: string }
}
const ProfileContext = createContext<ProfileContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState(readPlayers)
  const [activeName, setActiveName] = useState(readActive)

  const persistPlayers = useCallback((next: string[]) => {
    setPlayers(next)
    try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(next)) }
    catch { return false }
    return true
  }, [])

  const createPlayer = useCallback((raw: string) => {
    const name = cleanPlayerName(raw)
    if (name.length < 3 || name.length > 16) return { ok: false, error: 'Please use a name between 3 and 16 characters.' }
    const exists = players.find((p) => p.toLocaleLowerCase() === name.toLocaleLowerCase())
    const chosen = exists ?? name
    try {
      if (!exists) {
        // Migrate the original single-player build once, preserving its chips and shop items.
        const oldChips = localStorage.getItem('golden-felt-chips-v1')
        const oldShop = localStorage.getItem('golden-felt-shop-v1')
        if (oldChips && !localStorage.getItem(playerStorageKey('chips', chosen))) localStorage.setItem(playerStorageKey('chips', chosen), oldChips)
        if (oldShop && !localStorage.getItem(playerStorageKey('shop', chosen))) localStorage.setItem(playerStorageKey('shop', chosen), oldShop)
      }
      const next = exists ? players : [...players, chosen]
      if (!persistPlayers(next)) return { ok: false, error: 'Your browser could not save the player list. Check available site storage.' }
      localStorage.setItem(ACTIVE_KEY, chosen)
      setActiveName(chosen)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Saving is unavailable in this browser. Try allowing site storage or use a regular browser window.' }
    }
  }, [players, persistPlayers])

  const switchPlayer = useCallback((name: string) => {
    const existing = players.find((p) => p.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (!existing) return false
    try { localStorage.setItem(ACTIVE_KEY, existing); setActiveName(existing); return true }
    catch { return false }
  }, [players])

  const startNewPlayer = useCallback(() => {
    try { localStorage.removeItem(ACTIVE_KEY) } catch { /* the name screen remains available in memory */ }
    setActiveName(null)
  }, [])

  const exportSave = useCallback(() => {
    if (!activeName) return ''
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
    if (!activeName) return { ok: false, error: 'Create or select a player first.' }
    try {
      const code = raw.trim().replace(/^GF1\./, '')
      const parsed = JSON.parse(decodeURIComponent(escape(atob(code)))) as { format?: string; version?: number; data?: Record<string, unknown> }
      if (parsed.format !== 'golden-felt-save' || parsed.version !== 1 || !parsed.data || typeof parsed.data !== 'object') {
        return { ok: false, error: 'That save code is not a valid Golden Felt backup.' }
      }
      const prefix = playerStorageKey('', activeName)
      const previous: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(prefix)) previous[key] = localStorage.getItem(key) ?? ''
      }
      try {
        for (const key of Object.keys(previous)) localStorage.removeItem(key)
        for (const [key, value] of Object.entries(parsed.data)) {
          if (!/^[a-z0-9-]+$/i.test(key) || typeof value !== 'string') continue
          localStorage.setItem(`${prefix}${key}`, value)
        }
        return { ok: true }
      } catch {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith(prefix)) keysToRemove.push(key)
        }
        for (const key of keysToRemove) localStorage.removeItem(key)
        for (const [key, value] of Object.entries(previous)) localStorage.setItem(key, value)
        return { ok: false, error: 'The backup could not be imported because browser storage is full or disabled. Your previous save was restored.' }
      }
    } catch { return { ok: false, error: 'The save code is damaged or incomplete.' } }
  }, [activeName])

  const value = useMemo(() => ({ activeName, players, createPlayer, switchPlayer, startNewPlayer, exportSave, importSave }), [activeName, players, createPlayer, switchPlayer, startNewPlayer, exportSave, importSave])
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function usePlayer() {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider')
  return value
}
