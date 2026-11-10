import { useCallback, useEffect, useRef, useState } from 'react'
import { useChips } from './chips'

export type Spots = Record<string, number>
const sum = (s: Spots) => Object.values(s).reduce((a, b) => a + b, 0)

function load(key: string): Spots {
  try {
    const p = JSON.parse(localStorage.getItem(key) ?? '{}')
    const out: Spots = {}
    for (const [k, v] of Object.entries(p)) if (typeof v === 'number' && v > 0 && Number.isFinite(v)) out[k] = v
    return out
  } catch { return {} }
}
function save(key: string, s: Spots) {
  try { localStorage.setItem(key, JSON.stringify(s)) } catch { /* storage blocked */ }
}

/**
 * Bets on one or more spots (a bet area, a number, a side bet...). Chips are taken from the balance as they are
 * placed, given back by clear(), and handed back automatically if you leave the table before the round starts.
 * The previous round's bets are remembered so a rebet is one tap.
 */
export function useSpots(storeKey: string, gameId?: string) {
  const { balance, bet, refund, markHand } = useChips()
  const [spots, setSpotsState] = useState<Spots>({})
  const [locked, setLocked] = useState(false)
  const [last, setLast] = useState<Spots>(() => load(storeKey))
  const [carried, setCarried] = useState(false)
  const ref = useRef<Spots>({})
  const lockedRef = useRef(false)

  const setSpots = useCallback((next: Spots) => { ref.current = next; setSpotsState(next) }, [])

  const add = useCallback((key: string, amount: number): boolean => {
    if (lockedRef.current || amount <= 0) return false
    if (!bet(amount, false)) return false
    setSpots({ ...ref.current, [key]: (ref.current[key] ?? 0) + amount })
    setCarried(false)
    return true
  }, [bet, setSpots])

  /** Take everything back off the table. */
  const clear = useCallback(() => {
    if (lockedRef.current) return
    const t = sum(ref.current)
    if (t > 0) refund(t)
    setSpots({})
    setCarried(false)
  }, [refund, setSpots])

  /** Remove the chips on one spot. */
  const clearSpot = useCallback((key: string) => {
    if (lockedRef.current || !ref.current[key]) return
    refund(ref.current[key])
    const next = { ...ref.current }
    delete next[key]
    setSpots(next)
    setCarried(false)
  }, [refund, setSpots])

  /** Commit the bets to a round: they can no longer be changed, and are remembered for the rebet. */
  const lock = useCallback(() => {
    lockedRef.current = true
    setLocked(true)
    const snap = { ...ref.current }
    setLast(snap)
    save(storeKey, snap)
    markHand(gameId, sum(snap))
  }, [gameId, markHand, storeKey])

  /** Round finished: wipe the table and unlock. */
  const reset = useCallback(() => {
    lockedRef.current = false
    setLocked(false)
    setSpots({})
  }, [setSpots])

  const lastTotal = sum(last)
  const restore = useCallback((): boolean => {
    if (lockedRef.current) return false
    const t = sum(last)
    if (t <= 0 || !bet(t, false)) return false
    setSpots({ ...last })
    setCarried(true)
    return true
  }, [bet, last, setSpots])

  useEffect(() => () => {
    if (!lockedRef.current) { const t = sum(ref.current); if (t > 0) refund(t) }
  }, [refund])

  return { spots, total: sum(spots), locked, add, clear, clearSpot, lock, reset, last, lastTotal, restore, carried, setCarried, balance }
}
