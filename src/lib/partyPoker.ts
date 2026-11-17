import { supabase } from './supabase'
import { type Card } from './cards'
import { bestHoldem, describeHand, type Evaluated } from './pokerEval'

export type PartyTheme = 'bel-air' | 'monte-carlo' | 'superyacht'

export interface PartyStakes {
  id: string
  name: string
  sb: number
  bb: number
  minBuyIn: number
  maxBuyIn: number
}

export const PARTY_STAKES_TIERS: PartyStakes[] = [
  { id: 'casual', name: 'Casual Lounge', sb: 100, bb: 200, minBuyIn: 5000, maxBuyIn: 25000 },
  { id: 'high-roller', name: 'VIP High Roller', sb: 1000, bb: 2000, minBuyIn: 50000, maxBuyIn: 250000 },
  { id: 'whale', name: 'Sovereign Whale Apex', sb: 10000, bb: 20000, minBuyIn: 500000, maxBuyIn: 2500000 },
]

export interface PartyRoom {
  id: string
  code: string
  name: string
  hostName: string
  hostTag?: string
  hostBadge?: string | null
  stakes: PartyStakes
  theme: PartyTheme
  maxSeats: number
  createdAt: number
  isPrivate: boolean
}

export interface PartySeat {
  seatId: number // 0 to 5 (6-Max table)
  name: string
  tag: string
  badge?: string | null
  chips: number
  isHost: boolean
  isHuman: boolean
  folded: boolean
  paid: number
  currentBet: number
  acted: boolean
  lastAction: string | null
  holes: Card[]
  evaluated?: Evaluated | null
}

export interface PartyChatMessage {
  id: string
  sender: string
  text: string
  isSystem?: boolean
  timestamp: number
  emote?: string
}

export interface PartyToast {
  id: string
  sender: string
  text: string
  type: 'champagne' | 'rain' | 'toast'
  timestamp: number
}

export type PokerStreet = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

export interface PartyTableState {
  room: PartyRoom
  seats: PartySeat[]
  street: PokerStreet
  button: number
  toAct: number
  currentBet: number
  pot: number
  board: Card[]
  deck: Card[]
  winners: { seatId: number; name: string; amount: number; handName: string }[]
  handCount: number
}

// Private parties only — zero fake/bot rooms
export const DEFAULT_PUBLIC_ROOMS: PartyRoom[] = []
export const VIP_GUEST_BOTS: { name: string; tag: string; badge: string | null }[] = []

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let res = ''
  for (let i = 0; i < 4; i++) {
    res += chars[Math.floor(Math.random() * chars.length)]
  }
  return res
}

const activePartyChannels = new Map<string, any>()

export function subscribeToPartyRoom(
  roomId: string,
  onBroadcast: (event: string, payload: any) => void
): { unsubscribe: () => void; send: (event: string, payload: any) => Promise<void> } {
  if (!supabase) {
    return {
      unsubscribe: () => {},
      send: async () => {},
    }
  }

  // Reuse existing channel if already connected for this room
  let channel = activePartyChannels.get(roomId)
  if (channel) {
    supabase.removeChannel(channel)
    activePartyChannels.delete(roomId)
  }

  channel = supabase.channel(`poker-party-${roomId}`, {
    config: {
      broadcast: { self: false },
    },
  })

  channel
    .on('broadcast', { event: '*' }, (payload: any) => {
      onBroadcast(payload.event, payload.payload)
    })
    .subscribe()

  activePartyChannels.set(roomId, channel)

  const send = async (event: string, payload: any) => {
    try {
      await channel.send({
        type: 'broadcast',
        event,
        payload,
      })
    } catch (err) {
      console.warn(`[PartyPoker] broadcast ${event} failed:`, err)
    }
  }

  const unsubscribe = () => {
    activePartyChannels.delete(roomId)
    if (supabase) {
      supabase.removeChannel(channel)
    }
  }

  return { unsubscribe, send }
}

export async function broadcastPartyEvent(roomId: string, event: string, payload: any): Promise<void> {
  const ch = activePartyChannels.get(roomId)
  if (ch) {
    try {
      await ch.send({
        type: 'broadcast',
        event,
        payload,
      })
      return
    } catch (err) {
      console.warn('broadcastPartyEvent cached warning:', err)
    }
  }
  if (!supabase) return
  try {
    const channel = supabase.channel(`poker-party-${roomId}`)
    await channel.send({
      type: 'broadcast',
      event,
      payload,
    })
  } catch (err) {
    console.warn('broadcastPartyEvent warning:', err)
  }
}

export function evaluateShowdown(
  seats: PartySeat[],
  board: Card[],
  pot: number
): { winners: { seatId: number; name: string; amount: number; handName: string }[]; evaluatedSeats: PartySeat[] } {
  const activeSeats = seats.filter((s) => !s.folded && s.holes.length === 2)
  if (activeSeats.length === 0) {
    return { winners: [], evaluatedSeats: seats }
  }

  if (activeSeats.length === 1) {
    const w = activeSeats[0]
    return {
      winners: [{ seatId: w.seatId, name: w.name, amount: pot, handName: 'All Opponents Folded' }],
      evaluatedSeats: seats,
    }
  }

  // Full 5-card evaluation
  const evaluated = activeSeats.map((s) => {
    const ev = bestHoldem(s.holes, board)
    return { seatId: s.seatId, name: s.name, ev }
  })

  // Compare evaluated scores
  evaluated.sort((a, b) => b.ev.score - a.ev.score)
  const bestScore = evaluated[0].ev.score
  const winningEvaluated = evaluated.filter((e) => e.ev.score === bestScore)

  const splitAmount = Math.floor(pot / winningEvaluated.length)
  const winners = winningEvaluated.map((w) => ({
    seatId: w.seatId,
    name: w.name,
    amount: splitAmount,
    handName: describeHand(w.ev),
  }))

  const updatedSeats = seats.map((s) => {
    const evObj = evaluated.find((e) => e.seatId === s.seatId)
    return {
      ...s,
      evaluated: evObj ? evObj.ev : null,
    }
  })

  return { winners, evaluatedSeats: updatedSeats }
}
