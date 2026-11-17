import { supabase } from './supabase'
import { type Card } from './cards'
import { type Evaluated } from './pokerEval'

export type PartyGameType = 'poker' | 'roulette' | 'blackjack' | 'dice'

export interface PartyGameInfo {
  id: PartyGameType
  name: string
  tagline: string
  icon: string
  minPlayers: number
  maxPlayers: number
  accentColor: string
  description: string
}

export const PARTY_GAMES: PartyGameInfo[] = [
  {
    id: 'poker',
    name: "Texas Hold'em Poker",
    tagline: '6-Max No-Limit VIP Poker table',
    icon: '🃏',
    minPlayers: 2,
    maxPlayers: 6,
    accentColor: '#10b981',
    description: 'Blinds, checks, raises, and full showdown hand rankings.',
  },
  {
    id: 'roulette',
    name: 'Multiplayer European Roulette',
    tagline: 'Shared live wheel and betting felt',
    icon: '🎡',
    minPlayers: 1,
    maxPlayers: 8,
    accentColor: '#ef4444',
    description: 'Place your chips together on red/black/numbers and watch the ball spin in real-time.',
  },
  {
    id: 'blackjack',
    name: 'Multiplayer Blackjack VIP',
    tagline: 'Multi-seat table against the live dealer',
    icon: '♠️',
    minPlayers: 1,
    maxPlayers: 5,
    accentColor: '#3b82f6',
    description: 'Hit, stand, double down side-by-side with your party friends.',
  },
  {
    id: 'dice',
    name: 'Lucky Dice & Craps Duel',
    tagline: 'Live synchronized dice rolls',
    icon: '🎲',
    minPlayers: 1,
    maxPlayers: 8,
    accentColor: '#f59e0b',
    description: 'Party members bet on High/Low/Totals with live animated dice rolls.',
  },
]

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

export interface PartyMember {
  id: string
  name: string
  tag: string
  badge?: string | null
  chips: number
  isHost: boolean
  isReady: boolean
  isOnline: boolean
  joinedAt: number
}

export interface PartyRoom {
  id: string
  code: string
  name: string
  hostName: string
  hostTag?: string
  hostBadge?: string | null
  game: PartyGameType
  status: 'lobby' | 'playing'
  stakes: PartyStakes
  theme: PartyTheme
  maxSeats: number
  createdAt: number
  isPrivate: boolean
  members: PartyMember[]
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

// ---------------------------------------------------------------------------
// POKER SPECIFIC INTERFACES
// ---------------------------------------------------------------------------
export type PokerStreet = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

export interface PokerSeat {
  seatId: number
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

// ---------------------------------------------------------------------------
// ROULETTE SPECIFIC INTERFACES
// ---------------------------------------------------------------------------
export type RouletteBetType = 'number' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' | 'dozen1' | 'dozen2' | 'dozen3'

export interface PartyRouletteBet {
  id: string
  playerId: string
  playerName: string
  betType: RouletteBetType
  value?: number // e.g. 17 for number bet
  amount: number
}

// ---------------------------------------------------------------------------
// BLACKJACK SPECIFIC INTERFACES
// ---------------------------------------------------------------------------
export interface PartyBlackjackHand {
  playerId: string
  playerName: string
  seatIndex: number
  bet: number
  cards: Card[]
  status: 'betting' | 'playing' | 'standing' | 'busted' | 'blackjack' | 'won' | 'lost' | 'push'
}

// ---------------------------------------------------------------------------
// DICE SPECIFIC INTERFACES
// ---------------------------------------------------------------------------
export type DiceBetChoice = 'low' | 'seven' | 'high' | 'exact'

export interface PartyDiceBet {
  id: string
  playerId: string
  playerName: string
  choice: DiceBetChoice
  targetNumber?: number
  amount: number
}

// Real private parties only — zero fake/bot rooms
export const DEFAULT_PUBLIC_ROOMS: PartyRoom[] = []

export function generatePartyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let res = ''
  for (let i = 0; i < 4; i++) {
    res += chars[Math.floor(Math.random() * chars.length)]
  }
  return res
}

// Active channels map to maintain persistent broadcast channels
const activePartyChannels = new Map<string, any>()

export function subscribeToParty(
  partyId: string,
  onBroadcast: (event: string, payload: any) => void
): { unsubscribe: () => void; send: (event: string, payload: any) => Promise<void> } {
  if (!supabase) {
    return {
      unsubscribe: () => {},
      send: async () => {},
    }
  }

  // Remove previous if any
  const prev = activePartyChannels.get(partyId)
  if (prev) {
    supabase.removeChannel(prev)
    activePartyChannels.delete(partyId)
  }

  const channel = supabase.channel(`party-room-${partyId}`, {
    config: {
      broadcast: { self: false },
    },
  })

  channel
    .on('broadcast', { event: '*' }, (payload: any) => {
      onBroadcast(payload.event, payload.payload)
    })
    .subscribe()

  activePartyChannels.set(partyId, channel)

  const send = async (event: string, payload: any) => {
    try {
      await channel.send({
        type: 'broadcast',
        event,
        payload,
      })
    } catch (err) {
      console.warn(`[PartySystem] Broadcast ${event} failed:`, err)
    }
  }

  const unsubscribe = () => {
    activePartyChannels.delete(partyId)
    if (supabase) {
      supabase.removeChannel(channel)
    }
  }

  return { unsubscribe, send }
}

export async function broadcastParty(partyId: string, event: string, payload: any): Promise<void> {
  const ch = activePartyChannels.get(partyId)
  if (ch) {
    try {
      await ch.send({
        type: 'broadcast',
        event,
        payload,
      })
      return
    } catch (err) {
      console.warn('broadcastParty cached warning:', err)
    }
  }
  if (!supabase) return
  try {
    const channel = supabase.channel(`party-room-${partyId}`)
    await channel.send({
      type: 'broadcast',
      event,
      payload,
    })
  } catch (err) {
    console.warn('broadcastParty warning:', err)
  }
}
