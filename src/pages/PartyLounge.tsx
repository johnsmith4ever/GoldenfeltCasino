import { useEffect, useState, useMemo, useCallback, useRef, type RefObject } from 'react'
import {
  Users,
  Sparkles,
  ArrowLeft,
  Crown,
  Wine,
  Coins,
  Volume2,
  VolumeX,
  MessageSquare,
  Send,
  KeyRound,
  Copy,
  Check,
  Play,
  Share2,
  UserX,
  Lock,
} from 'lucide-react'
import { useChips, fmt } from '../state/chips'
import { usePlayer } from '../state/profile'
import { sfx, isMuted, setMuted } from '../lib/audio'
import { Nametag } from '../components/Nametag'
import { PlayingCard } from '../components/PlayingCard'
import { GoldBurst } from '../components/GameShell'
import { Die } from '../components/Die'
import { newDeck, bjValue, type Card } from '../lib/cards'
import { bestHoldem, describeHand } from '../lib/pokerEval'
import {
  type PartyRoom,
  type PartyChatMessage,
  type PartyToast,
  type PartyGameType,
  type PokerStreet,
  type PokerSeat,
  type PartyRouletteBet,
  type RouletteBetType,
  type PartyBlackjackHand,
  type PartyDiceBet,
  type DiceBetChoice,
  PARTY_GAMES,
  PARTY_STAKES_TIERS,
  DEFAULT_PUBLIC_ROOMS,
  generatePartyCode,
  subscribeToParty,
  broadcastParty,
} from '../lib/partySystem'

// European Roulette Wheel Constants
const ROULETTE_WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const ROULETTE_REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const SEG = 360 / 37
const BOX = 300
const SCALE = BOX / 400
const R_TRACK = 190 * SCALE
const R_POCKET = 170 * SCALE
const mod = (a: number, n: number) => ((a % n) + n) % n
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)

function ballRadius(p: number): number {
  if (p < 0.04) return R_POCKET + (R_TRACK - R_POCKET) * (p / 0.04)
  if (p < 0.62) return R_TRACK
  if (p < 0.84) {
    const s = (p - 0.62) / 0.22
    return R_TRACK + (R_POCKET - R_TRACK) * s * s + 6 * (1 - s) * Math.abs(Math.sin(s * Math.PI * 3))
  }
  return R_POCKET
}

function ballJitter(p: number): number {
  if (p < 0.62 || p >= 0.84) return 0
  const s = (p - 0.62) / 0.22
  return 8 * (1 - s) * Math.sin(s * Math.PI * 5)
}

function placeWheelAndBall(
  wheel: SVGSVGElement | null,
  ball: HTMLDivElement | null,
  wheelDeg: number,
  ballRelDeg: number,
  r: number
) {
  if (wheel) wheel.style.transform = `rotate(${wheelDeg}deg)`
  if (ball) {
    const a = ((wheelDeg + ballRelDeg) * Math.PI) / 180
    ball.style.transform = `translate(${BOX / 2 + r * Math.sin(a)}px, ${BOX / 2 - r * Math.cos(a)}px)`
  }
}

function roulettePocketColor(n: number): string {
  if (n === 0) return '#0e5c3a'
  return ROULETTE_REDS.has(n) ? '#a3001f' : '#141419'
}

function RouletteWheelSvg({
  wheelRef,
  ballRef,
  highlight,
}: {
  wheelRef: RefObject<SVGSVGElement | null>
  ballRef: RefObject<HTMLDivElement | null>
  highlight: number | null
}) {
  const cx = 200, cy = 200
  const pockets = ROULETTE_WHEEL.map((n, i) => {
    const a0 = (i * SEG - SEG / 2 - 90) * (Math.PI / 180)
    const a1 = (i * SEG + SEG / 2 - 90) * (Math.PI / 180)
    const r0 = 118, r1 = 182
    const p = (r: number, a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    const path = `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
    const midA = (i * SEG - 90) * (Math.PI / 180)
    const textR = 152
    const tx = cx + textR * Math.cos(midA)
    const ty = cy + textR * Math.sin(midA)
    const rot = i * SEG + (n > 9 ? -90 : -90)
    const color = roulettePocketColor(n)
    const isLit = highlight === n

    return (
      <g key={n}>
        <path d={path} fill={color} stroke="#c9a227" strokeWidth="0.8" />
        {isLit && <path d={path} fill="#fde047" opacity="0.6" />}
        <text
          x={tx}
          y={ty}
          fill="#f6e27a"
          fontSize="11"
          fontWeight="bold"
          fontFamily="'Cinzel', serif"
          textAnchor="middle"
          dominantBaseline="central"
          transform={`rotate(${rot + 90}, ${tx}, ${ty})`}
        >
          {n}
        </text>
      </g>
    )
  })

  return (
    <div className="relative mx-auto" style={{ width: BOX, height: BOX }}>
      {/* Top pointer indicating winning pocket */}
      <div className="pointer-events-none absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
        <div
          className="h-0 w-0 border-l-[9px] border-r-[9px] border-t-[16px] border-l-transparent border-r-transparent"
          style={{ borderTopColor: '#f6e27a', filter: 'drop-shadow(0 0 6px rgba(246,226,122,0.8))' }}
        />
      </div>

      <svg
        ref={wheelRef}
        viewBox="0 0 400 400"
        width={BOX}
        height={BOX}
        className="roulette-wheel will-change-transform drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
      >
        <circle cx="200" cy="200" r="198" fill="#1b1408" stroke="#f6e27a" strokeWidth="3" />
        <circle cx="200" cy="200" r="185" fill="#2a1f0a" stroke="#c9a227" strokeWidth="1" />
        {pockets}
        <circle cx="200" cy="200" r="116" fill="#140f06" stroke="#f6e27a" strokeWidth="2" />
        <circle cx="200" cy="200" r="60" fill="#2a1f0a" stroke="#c9a227" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="18" fill="#f6e27a" />
      </svg>
      <div
        ref={ballRef}
        className="roulette-ball pointer-events-none will-change-transform"
        aria-hidden="true"
      />
    </div>
  )
}

export default function PartyLounge({ onBack }: { onBack: () => void }) {
  const { balance, bet, payout } = useChips()
  const { activeName } = usePlayer()
  const myName = activeName || 'HighRoller'

  // Lobby vs Room State
  const [activeRoom, setActiveRoom] = useState<PartyRoom | null>(null)
  const [publicRooms, setPublicRooms] = useState<PartyRoom[]>(() => {
    try {
      const saved = localStorage.getItem('golden-felt-party-rooms-v2')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return DEFAULT_PUBLIC_ROOMS
  })

  // Modals & Code Input
  const [showHostModal, setShowHostModal] = useState(false)
  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false)
  const [showChangeGameModal, setShowChangeGameModal] = useState(false)
  const [inputCode, setInputCode] = useState('')
  const [joinCodeError, setJoinCodeError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Host Form State
  const [hostRoomName, setHostRoomName] = useState('')
  const [hostGame, setHostGame] = useState<PartyGameType>('poker')
  const [hostStakesTier, setHostStakesTier] = useState('high-roller')
  const [hostIsPrivate] = useState(true)

  // Social & Party Chat State
  const [chatMessages, setChatMessages] = useState<PartyChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [floatingEmotes, setFloatingEmotes] = useState<{ id: string; sender: string; emote: string }[]>([])
  const [recentToast, setRecentToast] = useState<PartyToast | null>(null)
  const [burstCount, setBurstCount] = useState(0)
  const [isAudioMuted, setIsAudioMuted] = useState(isMuted())

  // -------------------------------------------------------------------------
  // GAME STATES: POKER
  // -------------------------------------------------------------------------
  const [pokerSeats, setPokerSeats] = useState<PokerSeat[]>([])
  const [pokerBoard, setPokerBoard] = useState<Card[]>([])
  const [pokerDeck, setPokerDeck] = useState<Card[]>([])
  const [pokerPot, setPokerPot] = useState(0)
  const [pokerCurrentBet, setPokerCurrentBet] = useState(0)
  const [pokerToAct, setPokerToAct] = useState<number>(-1)
  const [pokerStreet, setPokerStreet] = useState<PokerStreet>('waiting')
  const [pokerButton, setPokerButton] = useState(0)
  const [pokerWinners, setPokerWinners] = useState<{ seatId: number; name: string; amount: number; handName: string }[]>([])

  // -------------------------------------------------------------------------
  // GAME STATES: ROULETTE
  // -------------------------------------------------------------------------
  const [rouletteBets, setRouletteBets] = useState<PartyRouletteBet[]>([])
  const [rouletteSelectedBet, setRouletteSelectedBet] = useState<RouletteBetType>('red')
  const [rouletteChipSize, setRouletteChipSize] = useState<number>(500)
  const [rouletteSpinning, setRouletteSpinning] = useState(false)
  const [rouletteWinningNum, setRouletteWinningNum] = useState<number | null>(null)
  const [rouletteLastWinners, setRouletteLastWinners] = useState<{ name: string; amount: number }[]>([])
  const wheelSvgRef = useRef<SVGSVGElement | null>(null)
  const ballDivRef = useRef<HTMLDivElement | null>(null)
  const wheelRotRef = useRef<number>(0)
  const ballIdxRef = useRef<number>(0)
  const rouletteRafRef = useRef<number>(0)

  // -------------------------------------------------------------------------
  // GAME STATES: BLACKJACK
  // -------------------------------------------------------------------------
  const [bjShoe, setBjShoe] = useState<Card[]>([])
  const [bjDealerCards, setBjDealerCards] = useState<Card[]>([])
  const [bjHands, setBjHands] = useState<PartyBlackjackHand[]>([])
  const [bjActiveIndex, setBjActiveIndex] = useState<number>(-1)
  const [bjPhase, setBjPhase] = useState<'betting' | 'dealing' | 'players' | 'dealer' | 'settled'>('betting')

  // -------------------------------------------------------------------------
  // GAME STATES: DICE / CRAPS
  // -------------------------------------------------------------------------
  const [diceBets, setDiceBets] = useState<PartyDiceBet[]>([])
  const [diceChoice, setDiceChoice] = useState<DiceBetChoice>('high')
  const [diceBetAmt, setDiceBetAmt] = useState<number>(500)
  const [diceRolling, setDiceRolling] = useState(false)
  const [diceD1, setDiceD1] = useState(3)
  const [diceD2, setDiceD2] = useState(4)
  const [diceLastResult, setDiceLastResult] = useState<{ total: number; winners: { name: string; amount: number }[] } | null>(null)

  // Room references for callbacks
  const roomRef = useRef<PartyRoom | null>(activeRoom)
  useEffect(() => {
    roomRef.current = activeRoom
  }, [activeRoom])

  // Is current player host?
  const isHost = useMemo(() => {
    if (!activeRoom) return false
    return activeRoom.hostName.toLowerCase() === myName.toLowerCase()
  }, [activeRoom, myName])

  // Save public rooms list
  const saveRooms = (rooms: PartyRoom[]) => {
    setPublicRooms(rooms)
    try {
      localStorage.setItem('golden-felt-party-rooms-v2', JSON.stringify(rooms))
    } catch {}
  }

  // URL Invite Code Auto-Join (?party=CODE or ?join=CODE)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const codeParam = params.get('party') || params.get('join')
      if (codeParam && !activeRoom) {
        const found = publicRooms.find((r) => r.code.toUpperCase() === codeParam.trim().toUpperCase())
        if (found) {
          enterRoom(found)
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Enter room setup
  const enterRoom = (room: PartyRoom) => {
    // Add current player to members if not present
    let members = [...room.members]
    const existing = members.find((m) => m.name.toLowerCase() === myName.toLowerCase())
    if (!existing) {
      members.push({
        id: `mem-${Date.now()}`,
        name: myName,
        tag: 'tag-silver',
        badge: 'badge-silver-crown',
        chips: balance,
        isHost: room.hostName.toLowerCase() === myName.toLowerCase(),
        isReady: room.hostName.toLowerCase() === myName.toLowerCase(),
        isOnline: true,
        joinedAt: Date.now(),
      })
    }

    const updatedRoom: PartyRoom = {
      ...room,
      members,
    }

    setActiveRoom(updatedRoom)
    setChatMessages([
      {
        id: 'sys-welcome',
        sender: 'Casino Hostess',
        text: `Welcome to ${room.name}! Share code ${room.code} with friends to party together! 🥂`,
        isSystem: true,
        timestamp: Date.now(),
      },
    ])
    sfx.click()
  }

  // Physics-based Roulette Spin Animation (Synchronized for Host & Party Guests)
  const animateRouletteSpin = useCallback((winningNum: number, onComplete?: () => void) => {
    const idx = ROULETTE_WHEEL.indexOf(winningNum)
    if (idx === -1) return

    setRouletteSpinning(true)
    setRouletteWinningNum(null)
    sfx.spin()

    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const T = reduced ? 1400 : 4200
    const w0 = wheelRotRef.current
    const prevIdx = ballIdxRef.current
    // Wheel turns clockwise and slows to a stop with the winning pocket under the top pointer.
    const wTotal = 360 * (reduced ? 1 : 3 + Math.floor(Math.random() * 2)) + mod(-(w0 + idx * SEG), 360)
    // Ball orbits counter to wheel (relative), starting from where it was resting.
    const r0 = 360 * (reduced ? 1 : 6 + Math.floor(Math.random() * 2)) + mod((prevIdx - idx) * SEG, 360)
    const K = 2.4
    const start = performance.now()

    cancelAnimationFrame(rouletteRafRef.current)
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / T)
      const rel = idx * SEG + r0 * Math.pow(1 - p, K) + ballJitter(p)
      placeWheelAndBall(wheelSvgRef.current, ballDivRef.current, w0 + wTotal * easeOutCubic(p), rel, ballRadius(p))
      if (p < 1) {
        rouletteRafRef.current = requestAnimationFrame(frame)
      } else {
        wheelRotRef.current = w0 + wTotal
        ballIdxRef.current = idx
        setRouletteSpinning(false)
        setRouletteWinningNum(winningNum)
        sfx.reelStop()
        if (onComplete) onComplete()
      }
    }
    rouletteRafRef.current = requestAnimationFrame(frame)
  }, [])

  // Place roulette wheel & ball on mount or status change
  useEffect(() => {
    if (activeRoom?.status === 'playing' && activeRoom?.game === 'roulette') {
      placeWheelAndBall(
        wheelSvgRef.current,
        ballDivRef.current,
        wheelRotRef.current,
        ballIdxRef.current * SEG,
        R_POCKET
      )
    }
  }, [activeRoom?.status, activeRoom?.game])

  // Cleanup roulette animation frame on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rouletteRafRef.current)
    }
  }, [])

  // Realtime Broadcast Sender
  const sendPartyEvent = useCallback((event: string, payload: any) => {
    if (!activeRoom) return
    broadcastParty(activeRoom.id, event, payload)
  }, [activeRoom])

  // -------------------------------------------------------------------------
  // SUPABASE REALTIME MULTIPLAYER SYNC
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!activeRoom) return

    const { unsubscribe, send } = subscribeToParty(activeRoom.id, (event, payload) => {
      // 1. Social & Atmosphere Events
      if (event === 'chat_message') {
        setChatMessages((prev) => [...prev, payload])
        sfx.chip()
      } else if (event === 'floating_emote') {
        setFloatingEmotes((prev) => [...prev, payload])
        setTimeout(() => {
          setFloatingEmotes((prev) => prev.filter((e) => e.id !== payload.id))
        }, 2200)
      } else if (event === 'party_toast') {
        setRecentToast(payload)
        sfx.bigWin()
        setBurstCount((b) => b + 1)
        setTimeout(() => setRecentToast(null), 4500)
      }
      // 2. Member & Roster Events
      else if (event === 'player_joined') {
        setActiveRoom((cur) => {
          if (!cur) return null
          const exists = cur.members.some((m) => m.name.toLowerCase() === payload.name.toLowerCase())
          if (exists) return cur
          const nextMembers = [...cur.members, payload]
          return { ...cur, members: nextMembers }
        })
      } else if (event === 'player_left') {
        setActiveRoom((cur) => {
          if (!cur) return null
          const nextMembers = cur.members.filter((m) => m.name.toLowerCase() !== payload.name.toLowerCase())
          // Host transfer if host left
          let nextHost = cur.hostName
          if (cur.hostName.toLowerCase() === payload.name.toLowerCase() && nextMembers.length > 0) {
            nextHost = nextMembers[0].name
            nextMembers[0].isHost = true
          }
          return { ...cur, hostName: nextHost, members: nextMembers }
        })
      } else if (event === 'player_ready_toggle') {
        setActiveRoom((cur) => {
          if (!cur) return null
          const nextMembers = cur.members.map((m) =>
            m.name.toLowerCase() === payload.name.toLowerCase() ? { ...m, isReady: payload.isReady } : m
          )
          return { ...cur, members: nextMembers }
        })
      } else if (event === 'game_changed') {
        setActiveRoom((cur) => (cur ? { ...cur, game: payload.game } : null))
        sfx.deal()
      } else if (event === 'game_started') {
        setActiveRoom((cur) => (cur ? { ...cur, status: 'playing' } : null))
        sfx.bigWin()
      } else if (event === 'game_return_lobby') {
        setActiveRoom((cur) => (cur ? { ...cur, status: 'lobby' } : null))
        sfx.click()
      }
      // 3. Poker Specific Events
      else if (event === 'poker_hand_deal') {
        setPokerSeats(payload.seats)
        setPokerDeck(payload.deck || [])
        setPokerBoard(payload.board || [])
        setPokerPot(payload.pot)
        setPokerCurrentBet(payload.currentBet)
        setPokerButton(payload.buttonSeat)
        setPokerToAct(payload.toAct)
        setPokerStreet(payload.street)
        setPokerWinners([])
        sfx.deal()
        const mySeat = payload.seats.find((s: PokerSeat) => s.name.toLowerCase() === myName.toLowerCase())
        if (mySeat && mySeat.paid > 0) {
          bet(mySeat.paid, true, 'poker')
        }
      } else if (event === 'poker_action') {
        setPokerSeats(payload.nextSeats)
        setPokerPot(payload.nextPot)
        setPokerCurrentBet(payload.nextCurrentBet)
        setPokerToAct(payload.nextToAct)
        if (payload.action === 'fold' || payload.action === 'check') sfx.click()
        else sfx.chip()
      } else if (event === 'poker_advance_street') {
        setPokerStreet(payload.street)
        setPokerBoard(payload.board)
        setPokerDeck(payload.deck || [])
        setPokerSeats(payload.seats)
        setPokerPot(payload.pot)
        setPokerToAct(payload.toAct)
        setPokerCurrentBet(payload.currentBet)
        if (payload.winners) setPokerWinners(payload.winners)
        if (payload.street === 'showdown') {
          const mySeat = payload.seats.find((s: PokerSeat) => s.name.toLowerCase() === myName.toLowerCase())
          if (mySeat && payload.winners && payload.winners.some((w: any) => w.seatId === mySeat.seatId)) {
            const w = payload.winners.find((x: any) => x.seatId === mySeat.seatId)
            payout(w.amount)
            setBurstCount((b) => b + 1)
            sfx.bigWin()
          } else {
            sfx.win()
          }
        } else {
          sfx.deal()
        }
      }
      // 4. Roulette Specific Events
      else if (event === 'roulette_bet_placed') {
        setRouletteBets((prev) => [...prev, payload])
        sfx.chip()
      } else if (event === 'roulette_spin_start') {
        animateRouletteSpin(payload.winningNum)
      } else if (event === 'roulette_spin_settle') {
        setRouletteSpinning(false)
        setRouletteWinningNum(payload.winningNum)
        setRouletteLastWinners(payload.winners)
        setRouletteBets([])
        if (payload.winners && payload.winners.some((w: any) => w.name.toLowerCase() === myName.toLowerCase())) {
          const myW = payload.winners.find((w: any) => w.name.toLowerCase() === myName.toLowerCase())
          payout(myW.amount)
          setBurstCount((b) => b + 1)
          sfx.bigWin()
        } else {
          sfx.win()
        }
      }
      // 5. Blackjack Specific Events
      else if (event === 'bj_round_start') {
        setBjDealerCards(payload.dealerCards)
        setBjHands(payload.hands)
        setBjActiveIndex(payload.activeIndex)
        setBjPhase('players')
        sfx.deal()
      } else if (event === 'bj_player_action') {
        setBjHands(payload.hands)
        setBjActiveIndex(payload.activeIndex)
        sfx.chip()
      } else if (event === 'bj_settled') {
        setBjDealerCards(payload.dealerCards)
        setBjHands(payload.hands)
        setBjPhase('settled')
        if (payload.winners && payload.winners.some((w: any) => w.name.toLowerCase() === myName.toLowerCase())) {
          const winAmt = payload.winners.find((w: any) => w.name.toLowerCase() === myName.toLowerCase()).amount
          payout(winAmt)
          setBurstCount((b) => b + 1)
          sfx.bigWin()
        } else {
          sfx.win()
        }
      }
      // 6. Dice Specific Events
      else if (event === 'dice_bet_placed') {
        setDiceBets((prev) => [...prev, payload])
        sfx.chip()
      } else if (event === 'dice_roll_result') {
        setDiceRolling(false)
        setDiceD1(payload.d1)
        setDiceD2(payload.d2)
        setDiceLastResult(payload.result)
        setDiceBets([])
        if (payload.result.winners.some((w: any) => w.name.toLowerCase() === myName.toLowerCase())) {
          const winObj = payload.result.winners.find((w: any) => w.name.toLowerCase() === myName.toLowerCase())
          payout(winObj.amount)
          setBurstCount((b) => b + 1)
          sfx.bigWin()
        } else {
          sfx.win()
        }
      }
    })

    // Announce player arrival
    send('player_joined', {
      id: `mem-${Date.now()}`,
      name: myName,
      tag: 'tag-silver',
      badge: 'badge-silver-crown',
      chips: balance,
      isHost: isHost,
      isReady: isHost,
      isOnline: true,
      joinedAt: Date.now(),
    })

    return () => {
      send('player_left', { name: myName })
      unsubscribe()
    }
  }, [activeRoom?.id, myName, isHost, bet, payout, balance])

  // -------------------------------------------------------------------------
  // HOST & PARTY MANAGEMENT CONTROLS
  // -------------------------------------------------------------------------
  const handleHostCreate = () => {
    const stakes = PARTY_STAKES_TIERS.find((t) => t.id === hostStakesTier) || PARTY_STAKES_TIERS[1]
    const name = hostRoomName.trim() || `${myName}'s VIP Party`
    const newRoom: PartyRoom = {
      id: `party-${Date.now()}`,
      code: generatePartyCode(),
      name,
      hostName: myName,
      hostTag: 'tag-gold',
      hostBadge: 'badge-silver-crown',
      game: hostGame,
      status: 'lobby',
      stakes,
      theme: 'bel-air' as const,
      maxSeats: 8,
      createdAt: Date.now(),
      isPrivate: hostIsPrivate,
      members: [
        {
          id: `mem-${Date.now()}`,
          name: myName,
          tag: 'tag-gold',
          badge: 'badge-silver-crown',
          chips: balance,
          isHost: true,
          isReady: true,
          isOnline: true,
          joinedAt: Date.now(),
        },
      ],
    }

    const updated = [newRoom, ...publicRooms]
    saveRooms(updated)
    setShowHostModal(false)
    setHostRoomName('')
    enterRoom(newRoom)
  }

  const handleJoinByCode = (customCode?: string) => {
    const clean = (customCode || inputCode).trim().toUpperCase()
    if (!clean) return
    const found = publicRooms.find((r) => r.code.toUpperCase() === clean)
    if (found) {
      setShowJoinCodeModal(false)
      setInputCode('')
      setJoinCodeError('')
      enterRoom(found)
    } else if (clean.length === 4) {
      const remoteRoom: PartyRoom = {
        id: `party-${clean.toLowerCase()}`,
        code: clean,
        name: `VIP Table ${clean}`,
        hostName: 'Host',
        hostTag: 'tag-gold',
        hostBadge: 'badge-silver-crown',
        game: 'poker',
        status: 'lobby',
        stakes: PARTY_STAKES_TIERS[1],
        theme: 'bel-air',
        maxSeats: 8,
        createdAt: Date.now(),
        isPrivate: true,
        members: [
          {
            id: `mem-${Date.now()}`,
            name: myName,
            tag: 'tag-gold',
            badge: 'badge-silver-crown',
            chips: balance,
            isHost: false,
            isReady: false,
            isOnline: true,
            joinedAt: Date.now(),
          },
        ],
      }
      setShowJoinCodeModal(false)
      setInputCode('')
      setJoinCodeError('')
      enterRoom(remoteRoom)
    } else {
      setJoinCodeError(`Party code "${clean}" must be 4 characters. Verify the code and try again.`)
    }
  }

  const handleCopyCode = () => {
    if (!activeRoom) return
    navigator.clipboard.writeText(activeRoom.code)
    setCodeCopied(true)
    sfx.tick()
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleCopyLink = () => {
    if (!activeRoom) return
    const link = `${window.location.origin}${window.location.pathname}?party=${activeRoom.code}`
    navigator.clipboard.writeText(link)
    setLinkCopied(true)
    sfx.tick()
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleToggleReady = () => {
    if (!activeRoom) return
    const me = activeRoom.members.find((m) => m.name.toLowerCase() === myName.toLowerCase())
    const nextReady = !me?.isReady
    sendPartyEvent('player_ready_toggle', { name: myName, isReady: nextReady })
    setActiveRoom((cur) => {
      if (!cur) return null
      return {
        ...cur,
        members: cur.members.map((m) =>
          m.name.toLowerCase() === myName.toLowerCase() ? { ...m, isReady: nextReady } : m
        ),
      }
    })
    sfx.click()
  }

  const handleKickPlayer = (memberName: string) => {
    if (!isHost || !activeRoom) return
    sendPartyEvent('player_left', { name: memberName })
    setActiveRoom((cur) => {
      if (!cur) return null
      return {
        ...cur,
        members: cur.members.filter((m) => m.name.toLowerCase() !== memberName.toLowerCase()),
      }
    })
    sfx.click()
  }

  const handleTransferHost = (newHostName: string) => {
    if (!isHost || !activeRoom) return
    setActiveRoom((cur) => {
      if (!cur) return null
      const nextMembers = cur.members.map((m) => ({
        ...m,
        isHost: m.name.toLowerCase() === newHostName.toLowerCase(),
      }))
      return { ...cur, hostName: newHostName, members: nextMembers }
    })
    sendPartyEvent('chat_message', {
      id: `sys-host-${Date.now()}`,
      sender: 'Casino Hostess',
      text: `👑 ${myName} transferred party hosting rights to ${newHostName}!`,
      isSystem: true,
      timestamp: Date.now(),
    })
    sfx.win()
  }

  const handleChangeGame = (newGame: PartyGameType) => {
    if (!isHost || !activeRoom) return
    sendPartyEvent('game_changed', { game: newGame })
    setActiveRoom((cur) => (cur ? { ...cur, game: newGame } : null))
    setShowChangeGameModal(false)
    sfx.deal()
  }

  const handleStartPartyGame = () => {
    if (!isHost || !activeRoom) return
    sendPartyEvent('game_started', {})
    setActiveRoom((cur) => (cur ? { ...cur, status: 'playing' } : null))
    sfx.bigWin()

    // Initialize game specific boards
    if (activeRoom.game === 'poker') {
      initializePoker()
    } else if (activeRoom.game === 'blackjack') {
      initializeBlackjack()
    }
  }

  const handleReturnToLobby = () => {
    sendPartyEvent('game_return_lobby', {})
    setActiveRoom((cur) => (cur ? { ...cur, status: 'lobby' } : null))
    sfx.click()
  }

  const handleLeaveParty = () => {
    if (activeRoom) {
      sendPartyEvent('player_left', { name: myName })
    }
    setActiveRoom(null)
    sfx.click()
  }

  // -------------------------------------------------------------------------
  // SOCIAL ACTIONS (CHAMPAGNE, CHAT, EMOTES)
  // -------------------------------------------------------------------------
  const handlePopChampagne = () => {
    if (balance < 10000) return
    bet(10000, false, 'party')
    const toast: PartyToast = {
      id: `toast-${Date.now()}`,
      sender: myName,
      text: `${myName} popped a vintage bottle of Dom Pérignon! 🍾🥂 Toast to the entire party!`,
      type: 'champagne',
      timestamp: Date.now(),
    }
    setRecentToast(toast)
    sendPartyEvent('party_toast', toast)
    sfx.bigWin()
    setBurstCount((c) => c + 1)
    setTimeout(() => setRecentToast(null), 4500)
  }

  const handleSendChat = () => {
    if (!chatInput.trim() || !activeRoom) return
    const msg: PartyChatMessage = {
      id: `msg-${Date.now()}`,
      sender: myName,
      text: chatInput.trim(),
      timestamp: Date.now(),
    }
    setChatMessages((prev) => [...prev, msg])
    sendPartyEvent('chat_message', msg)
    setChatInput('')
    sfx.tick()
  }

  const handleSendEmote = (emote: string) => {
    if (!activeRoom) return
    const payload = {
      id: `emote-${Date.now()}`,
      sender: myName,
      emote,
    }
    setFloatingEmotes((prev) => [...prev, payload])
    sendPartyEvent('floating_emote', payload)
    sfx.tick()
    setTimeout(() => {
      setFloatingEmotes((prev) => prev.filter((e) => e.id !== payload.id))
    }, 2200)
  }

  // -------------------------------------------------------------------------
  // GAME INITIALIZERS
  // -------------------------------------------------------------------------
  const initializePoker = () => {
    if (!activeRoom) return
    const seats: PokerSeat[] = activeRoom.members.slice(0, 6).map((m, idx) => ({
      seatId: idx,
      name: m.name,
      tag: m.tag,
      badge: m.badge,
      chips: m.chips,
      isHost: m.isHost,
      isHuman: true,
      folded: false,
      paid: 0,
      currentBet: 0,
      acted: false,
      lastAction: null,
      holes: [],
    }))
    setPokerSeats(seats)
    setPokerPot(0)
    setPokerBoard([])
    setPokerStreet('waiting')
  }

  const startPokerHand = () => {
    if (!activeRoom) return
    const shuf = newDeck()
    const sb = activeRoom.stakes.sb
    const bb = activeRoom.stakes.bb
    const nextBtn = (pokerButton + 1) % pokerSeats.length
    const sbSeat = (nextBtn + 1) % pokerSeats.length
    const bbSeat = (nextBtn + 2) % pokerSeats.length

    const updatedSeats = pokerSeats.map((s, idx) => {
      const c1 = shuf.pop()!
      const c2 = shuf.pop()!
      let betAmt = 0
      if (idx === sbSeat) betAmt = Math.min(s.chips, sb)
      if (idx === bbSeat) betAmt = Math.min(s.chips, bb)

      return {
        ...s,
        chips: Math.max(0, s.chips - betAmt),
        paid: betAmt,
        currentBet: betAmt,
        folded: false,
        acted: false,
        lastAction: idx === sbSeat ? `SB ${fmt(betAmt)}` : idx === bbSeat ? `BB ${fmt(betAmt)}` : null,
        holes: [c1, c2],
      }
    })

    const nextToAct = (nextBtn + 3) % pokerSeats.length
    setPokerSeats(updatedSeats)
    setPokerDeck(shuf)
    setPokerBoard([])
    setPokerPot(sb + bb)
    setPokerCurrentBet(bb)
    setPokerButton(nextBtn)
    setPokerToAct(nextToAct)
    setPokerStreet('preflop')
    setPokerWinners([])

    sendPartyEvent('poker_hand_deal', {
      seats: updatedSeats,
      deck: shuf,
      board: [],
      pot: sb + bb,
      currentBet: bb,
      buttonSeat: nextBtn,
      toAct: nextToAct,
      street: 'preflop',
    })
    sfx.deal()
  }

  const handlePokerAction = (action: 'fold' | 'check' | 'call' | 'raise', amount = 0) => {
    const curSeatIndex = pokerSeats.findIndex((s) => s.name.toLowerCase() === myName.toLowerCase())
    if (curSeatIndex === -1 || pokerToAct !== curSeatIndex) return
    const curSeat = pokerSeats[curSeatIndex]

    let nextSeats = [...pokerSeats]
    let addedPot = 0
    let nextCurrentBet = pokerCurrentBet

    if (action === 'fold') {
      nextSeats[curSeatIndex] = { ...curSeat, folded: true, lastAction: 'FOLD', acted: true }
      sfx.click()
    } else if (action === 'check') {
      nextSeats[curSeatIndex] = { ...curSeat, lastAction: 'CHECK', acted: true }
      sfx.click()
    } else if (action === 'call') {
      const callAmt = Math.min(curSeat.chips, pokerCurrentBet - curSeat.currentBet)
      addedPot += callAmt
      bet(callAmt, false, 'poker')
      nextSeats[curSeatIndex] = {
        ...curSeat,
        chips: curSeat.chips - callAmt,
        paid: curSeat.paid + callAmt,
        currentBet: curSeat.currentBet + callAmt,
        lastAction: `CALL ${fmt(callAmt)}`,
        acted: true,
      }
      sfx.chip()
    } else if (action === 'raise') {
      const toAdd = Math.min(curSeat.chips, amount - curSeat.currentBet)
      addedPot += toAdd
      nextCurrentBet = curSeat.currentBet + toAdd
      bet(toAdd, false, 'poker')
      nextSeats = nextSeats.map((s, idx) => ({
        ...s,
        acted: idx === curSeatIndex,
        ...(idx === curSeatIndex
          ? {
              chips: s.chips - toAdd,
              paid: s.paid + toAdd,
              currentBet: nextCurrentBet,
              lastAction: `RAISE ${fmt(nextCurrentBet)}`,
            }
          : {}),
      }))
      sfx.chip()
    }

    const nextPot = pokerPot + addedPot
    setPokerPot(nextPot)
    setPokerCurrentBet(nextCurrentBet)
    setPokerSeats(nextSeats)

    let nextToAct = (curSeatIndex + 1) % pokerSeats.length
    let loopCount = 0
    while ((nextSeats[nextToAct].folded || nextSeats[nextToAct].chips === 0) && loopCount < pokerSeats.length) {
      nextToAct = (nextToAct + 1) % pokerSeats.length
      loopCount++
    }

    const remaining = nextSeats.filter((s) => !s.folded)
    const roundFinished = remaining.length <= 1 || remaining.every((s) => s.acted && s.currentBet === nextCurrentBet)

    sendPartyEvent('poker_action', {
      action,
      amount,
      nextSeats,
      nextPot,
      nextCurrentBet,
      nextToAct,
      roundFinished,
    })

    if (roundFinished) {
      if (isHost) {
        setTimeout(() => advancePokerStreet(pokerBoard, pokerDeck, nextSeats, nextPot), 600)
      }
    } else {
      setPokerToAct(nextToAct)
    }
  }

  const advancePokerStreet = (curBoard: Card[], curDeck: Card[], curSeats: PokerSeat[], curPot: number) => {
    const active = curSeats.filter((s) => !s.folded)
    if (active.length <= 1) {
      // Winner by fold
      const winner = active[0]
      const winArr = [{ seatId: winner.seatId, name: winner.name, amount: curPot, handName: 'Opponents Folded' }]
      setPokerWinners(winArr)
      setPokerStreet('showdown')
      sendPartyEvent('poker_advance_street', {
        street: 'showdown',
        board: curBoard,
        deck: curDeck,
        seats: curSeats,
        pot: curPot,
        toAct: -1,
        currentBet: 0,
        winners: winArr,
      })
      if (winner.name.toLowerCase() === myName.toLowerCase()) {
        payout(curPot)
        setBurstCount((b) => b + 1)
        sfx.bigWin()
      }
      return
    }

    const nextSeats = curSeats.map((s) => ({ ...s, currentBet: 0, acted: false }))
    const d = [...curDeck]

    if (pokerStreet === 'preflop') {
      d.pop()
      const flop = [d.pop()!, d.pop()!, d.pop()!]
      setPokerBoard(flop)
      setPokerDeck(d)
      setPokerStreet('flop')
      setPokerCurrentBet(0)
      setPokerSeats(nextSeats)
      setPokerToAct((pokerButton + 1) % pokerSeats.length)
      sendPartyEvent('poker_advance_street', {
        street: 'flop',
        board: flop,
        deck: d,
        seats: nextSeats,
        pot: curPot,
        toAct: (pokerButton + 1) % pokerSeats.length,
        currentBet: 0,
      })
      sfx.deal()
    } else if (pokerStreet === 'flop') {
      d.pop()
      const turn = d.pop()!
      const nBoard = [...curBoard, turn]
      setPokerBoard(nBoard)
      setPokerDeck(d)
      setPokerStreet('turn')
      setPokerCurrentBet(0)
      setPokerSeats(nextSeats)
      setPokerToAct((pokerButton + 1) % pokerSeats.length)
      sendPartyEvent('poker_advance_street', {
        street: 'turn',
        board: nBoard,
        deck: d,
        seats: nextSeats,
        pot: curPot,
        toAct: (pokerButton + 1) % pokerSeats.length,
        currentBet: 0,
      })
      sfx.deal()
    } else if (pokerStreet === 'turn') {
      d.pop()
      const river = d.pop()!
      const nBoard = [...curBoard, river]
      setPokerBoard(nBoard)
      setPokerDeck(d)
      setPokerStreet('river')
      setPokerCurrentBet(0)
      setPokerSeats(nextSeats)
      setPokerToAct((pokerButton + 1) % pokerSeats.length)
      sendPartyEvent('poker_advance_street', {
        street: 'river',
        board: nBoard,
        deck: d,
        seats: nextSeats,
        pot: curPot,
        toAct: (pokerButton + 1) % pokerSeats.length,
        currentBet: 0,
      })
      sfx.deal()
    } else if (pokerStreet === 'river') {
      // Evaluate Showdown
      const evaluated = active.map((s) => {
        const ev = bestHoldem(s.holes, curBoard)
        return { seatId: s.seatId, name: s.name, ev }
      })
      evaluated.sort((a, b) => b.ev.score - a.ev.score)
      const topScore = evaluated[0].ev.score
      const topWinners = evaluated.filter((e) => e.ev.score === topScore)
      const splitAmt = Math.floor(curPot / topWinners.length)
      const winners = topWinners.map((w) => ({
        seatId: w.seatId,
        name: w.name,
        amount: splitAmt,
        handName: describeHand(w.ev),
      }))
      setPokerWinners(winners)
      setPokerStreet('showdown')
      sendPartyEvent('poker_advance_street', {
        street: 'showdown',
        board: curBoard,
        deck: curDeck,
        seats: curSeats,
        pot: curPot,
        toAct: -1,
        currentBet: 0,
        winners,
      })
      if (winners.some((w) => w.name.toLowerCase() === myName.toLowerCase())) {
        payout(splitAmt)
        setBurstCount((b) => b + 1)
        sfx.bigWin()
      }
    }
  }

  // -------------------------------------------------------------------------
  // ROULETTE HANDLERS
  // -------------------------------------------------------------------------
  const handlePlaceRouletteBet = () => {
    if (rouletteSpinning || balance < rouletteChipSize) return
    if (!bet(rouletteChipSize, false, 'roulette')) return
    sfx.chip()

    const betObj: PartyRouletteBet = {
      id: `rb-${Date.now()}-${Math.random()}`,
      playerId: myName,
      playerName: myName,
      betType: rouletteSelectedBet,
      value: undefined,
      amount: rouletteChipSize,
    }
    setRouletteBets((prev) => [...prev, betObj])
    sendPartyEvent('roulette_bet_placed', betObj)
  }

  const handleSpinRoulette = () => {
    if (!isHost || rouletteSpinning || rouletteBets.length === 0) return
    const winning = ROULETTE_WHEEL[Math.floor(Math.random() * ROULETTE_WHEEL.length)]

    // Broadcast spin start immediately to all party members
    sendPartyEvent('roulette_spin_start', { winningNum: winning })

    // Animate wheel on host, then evaluate & broadcast results upon ball landing
    animateRouletteSpin(winning, () => {
      // Evaluate bets
      const winners: { name: string; amount: number }[] = []
      const isRed = ROULETTE_REDS.has(winning)

      for (const b of rouletteBets) {
        let win = false
        let payoutMult = 0

        if (b.betType === 'number' && b.value === winning) {
          win = true
          payoutMult = 36
        } else if (b.betType === 'red' && isRed && winning !== 0) {
          win = true
          payoutMult = 2
        } else if (b.betType === 'black' && !isRed && winning !== 0) {
          win = true
          payoutMult = 2
        } else if (b.betType === 'even' && winning !== 0 && winning % 2 === 0) {
          win = true
          payoutMult = 2
        } else if (b.betType === 'odd' && winning !== 0 && winning % 2 === 1) {
          win = true
          payoutMult = 2
        } else if (b.betType === 'low' && winning >= 1 && winning <= 18) {
          win = true
          payoutMult = 2
        } else if (b.betType === 'high' && winning >= 19 && winning <= 36) {
          win = true
          payoutMult = 2
        }

        if (win) {
          const wonAmt = b.amount * payoutMult
          winners.push({ name: b.playerName, amount: wonAmt })
        }
      }

      sendPartyEvent('roulette_spin_settle', { winningNum: winning, winners })
      setRouletteLastWinners(winners)
      setRouletteBets([])
      if (winners.some((w) => w.name.toLowerCase() === myName.toLowerCase())) {
        const myWin = winners.find((w) => w.name.toLowerCase() === myName.toLowerCase())!.amount
        payout(myWin)
        setBurstCount((c) => c + 1)
        sfx.bigWin()
      } else {
        sfx.win()
      }
    })
  }

  // -------------------------------------------------------------------------
  // BLACKJACK HANDLERS
  // -------------------------------------------------------------------------
  const initializeBlackjack = () => {
    if (!activeRoom) return
    const shoe = newDeck()
    setBjShoe(shoe)
    const hands: PartyBlackjackHand[] = activeRoom.members.map((m, idx) => ({
      playerId: m.id,
      playerName: m.name,
      seatIndex: idx,
      bet: 1000,
      cards: [],
      status: 'betting',
    }))
    setBjHands(hands)
    setBjDealerCards([])
    setBjPhase('betting')
  }

  const handleStartBjRound = () => {
    if (!isHost || bjHands.length === 0) return
    const shuf = [...bjShoe]
    if (shuf.length < 20) {
      shuf.push(...newDeck())
    }

    const nextHands = bjHands.map((h) => {
      const c1 = shuf.pop()!
      const c2 = shuf.pop()!
      if (h.playerName.toLowerCase() === myName.toLowerCase()) {
        bet(h.bet, true, 'blackjack')
      }
      return { ...h, cards: [c1, c2], status: 'playing' as const }
    })

    const dCard1 = shuf.pop()!
    setBjShoe(shuf)
    setBjDealerCards([dCard1])
    setBjHands(nextHands)
    setBjActiveIndex(0)
    setBjPhase('players')

    sendPartyEvent('bj_round_start', {
      dealerCards: [dCard1],
      hands: nextHands,
      activeIndex: 0,
    })
    sfx.deal()
  }

  const handleBjHit = () => {
    if (bjActiveIndex === -1 || bjHands[bjActiveIndex]?.playerName.toLowerCase() !== myName.toLowerCase()) return
    const curHand = bjHands[bjActiveIndex]
    const shuf = [...bjShoe]
    const nextCard = shuf.pop()!
    const updatedCards = [...curHand.cards, nextCard]
    const val = bjValue(updatedCards).total
    const busted = val > 21

    const updatedHands = bjHands.map((h, i) =>
      i === bjActiveIndex
        ? {
            ...h,
            cards: updatedCards,
            status: (busted ? 'busted' : 'playing') as any,
          }
        : h
    )

    let nextIdx = bjActiveIndex
    if (busted) {
      nextIdx = bjActiveIndex + 1 < bjHands.length ? bjActiveIndex + 1 : -1
    }

    setBjShoe(shuf)
    setBjHands(updatedHands)
    setBjActiveIndex(nextIdx)
    sfx.chip()

    sendPartyEvent('bj_player_action', {
      hands: updatedHands,
      activeIndex: nextIdx,
    })

    if (nextIdx === -1) {
      setTimeout(() => settleBlackjackDealer(updatedHands, shuf), 800)
    }
  }

  const handleBjStand = () => {
    if (bjActiveIndex === -1 || bjHands[bjActiveIndex]?.playerName.toLowerCase() !== myName.toLowerCase()) return
    const updatedHands = bjHands.map((h, i) =>
      i === bjActiveIndex ? { ...h, status: 'standing' as const } : h
    )
    const nextIdx = bjActiveIndex + 1 < bjHands.length ? bjActiveIndex + 1 : -1
    setBjHands(updatedHands)
    setBjActiveIndex(nextIdx)
    sfx.click()

    sendPartyEvent('bj_player_action', {
      hands: updatedHands,
      activeIndex: nextIdx,
    })

    if (nextIdx === -1) {
      setTimeout(() => settleBlackjackDealer(updatedHands, bjShoe), 800)
    }
  }

  const settleBlackjackDealer = (hands: PartyBlackjackHand[], shuf: Card[]) => {
    let dCards = [...bjDealerCards]
    const s = [...shuf]
    while (bjValue(dCards).total < 17 && s.length > 0) {
      dCards.push(s.pop()!)
    }
    const dVal = bjValue(dCards).total
    const winners: { name: string; amount: number }[] = []

    const finalHands = hands.map((h) => {
      const pVal = bjValue(h.cards).total
      let st = h.status
      if (st === 'busted') {
        st = 'lost'
      } else if (dVal > 21 || pVal > dVal) {
        st = 'won'
        winners.push({ name: h.playerName, amount: h.bet * 2 })
      } else if (pVal === dVal) {
        st = 'push'
        winners.push({ name: h.playerName, amount: h.bet })
      } else {
        st = 'lost'
      }
      return { ...h, status: st }
    })

    setBjDealerCards(dCards)
    setBjHands(finalHands)
    setBjPhase('settled')
    sendPartyEvent('bj_settled', { dealerCards: dCards, hands: finalHands, winners })

    if (winners.some((w) => w.name.toLowerCase() === myName.toLowerCase())) {
      const myWin = winners.find((w) => w.name.toLowerCase() === myName.toLowerCase())!.amount
      payout(myWin)
      setBurstCount((b) => b + 1)
      sfx.bigWin()
    } else {
      sfx.win()
    }
  }

  // -------------------------------------------------------------------------
  // DICE / CRAPS HANDLERS
  // -------------------------------------------------------------------------
  const handlePlaceDiceBet = () => {
    if (balance < diceBetAmt) return
    if (!bet(diceBetAmt, false, 'dice')) return
    sfx.chip()

    const betObj: PartyDiceBet = {
      id: `db-${Date.now()}-${Math.random()}`,
      playerId: myName,
      playerName: myName,
      choice: diceChoice,
      amount: diceBetAmt,
    }
    setDiceBets((prev) => [...prev, betObj])
    sendPartyEvent('dice_bet_placed', betObj)
  }

  const handleRollDice = () => {
    if (diceRolling || diceBets.length === 0) return
    const d1 = Math.floor(1 + Math.random() * 6)
    const d2 = Math.floor(1 + Math.random() * 6)
    const total = d1 + d2
    setDiceRolling(true)
    sfx.deal()

    setTimeout(() => {
      const winners: { name: string; amount: number }[] = []
      for (const b of diceBets) {
        let win = false
        let mult = 0
        if (b.choice === 'low' && total >= 2 && total <= 6) {
          win = true
          mult = 2
        } else if (b.choice === 'high' && total >= 8 && total <= 12) {
          win = true
          mult = 2
        } else if (b.choice === 'seven' && total === 7) {
          win = true
          mult = 4
        }
        if (win) {
          winners.push({ name: b.playerName, amount: b.amount * mult })
        }
      }

      const res = { total, winners }
      setDiceRolling(false)
      setDiceD1(d1)
      setDiceD2(d2)
      setDiceLastResult(res)
      setDiceBets([])
      sendPartyEvent('dice_roll_result', { d1, d2, result: res })

      if (winners.some((w) => w.name.toLowerCase() === myName.toLowerCase())) {
        const myWin = winners.find((w) => w.name.toLowerCase() === myName.toLowerCase())!.amount
        payout(myWin)
        setBurstCount((b) => b + 1)
        sfx.bigWin()
      } else {
        sfx.win()
      }
    }, 1800)
  }

  // -------------------------------------------------------------------------
  // RENDER: LOBBY & DIRECTORY VIEW
  // -------------------------------------------------------------------------
  if (!activeRoom) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-[#c9a227]/30 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={onBack}
                className="btn-ghost-gold flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs"
              >
                <ArrowLeft size={13} /> CASINO
              </button>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#f59e0b]/50 bg-[#78350f]/40 px-2.5 py-0.5 text-[10px] font-bold text-[#fde047]">
                <Sparkles size={11} /> LIVE PARTY MULTIPLAYER
              </span>
            </div>
            <h1 className="font-display gold-text-bright text-3xl font-black tracking-[0.16em] sm:text-4xl">
              PRIVATE VIP PARTY SALON
            </h1>
            <p className="text-xs text-[#a89872] mt-0.5">
              All tables are 100% private. Play Texas Hold'em, European Roulette, Blackjack, or Craps with friends via private invite code or direct link.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowJoinCodeModal(true)}
              className="btn-ghost-gold flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold"
            >
              <KeyRound size={14} /> ENTER CODE
            </button>
            <button
              onClick={() => setShowHostModal(true)}
              className="btn-gold flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black shadow-[0_0_20px_rgba(246,226,122,0.3)]"
            >
              <Crown size={15} /> HOST PRIVATE TABLE
            </button>
          </div>
        </div>

        {/* Quick Join Bar */}
        <div className="mb-8 rounded-2xl border border-[#c9a227]/40 bg-gradient-to-r from-black/90 via-[#1c1505]/80 to-black/90 p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#f6e27a]/40 bg-[#2a2105] shadow">
              <KeyRound size={22} className="text-[#f6e27a]" />
            </div>
            <div>
              <div className="font-display text-sm font-bold tracking-wider text-[#f6e27a] flex items-center gap-2">
                <span>HAVE A PRIVATE INVITATION CODE?</span>
                <span className="rounded bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-black text-emerald-400">
                  INSTANT ACCESS
                </span>
              </div>
              <p className="text-xs text-[#cbb98a] mt-0.5">
                Enter your host's 4-character VIP code to join their private table immediately.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              maxLength={4}
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value.toUpperCase())
                setJoinCodeError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinByCode()
              }}
              placeholder="ABCD"
              className="w-28 rounded-xl border-2 border-[#c9a227]/50 bg-black px-3 py-2 text-center font-mono text-sm font-black tracking-widest text-[#fde047] placeholder:text-[#5c5235] outline-none focus:border-[#f6e27a]"
            />
            <button
              onClick={() => handleJoinByCode()}
              disabled={inputCode.trim().length !== 4}
              className="btn-gold rounded-xl px-5 py-2.5 text-xs font-black shrink-0 disabled:opacity-40 shadow-lg"
            >
              JOIN TABLE →
            </button>
          </div>
        </div>

        {/* Private Games Available to Host */}
        <div className="mb-4 flex items-center gap-4">
          <h2 className="font-display text-[13px] font-bold tracking-[0.4em] text-[#b3a06b]">
            AVAILABLE PRIVATE MULTIPLAYER TABLES
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-[#c9a227]/40 to-transparent" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {PARTY_GAMES.map((game) => (
            <div
              key={game.id}
              className="panel-noir rounded-2xl border border-[#c9a227]/30 bg-gradient-to-b from-[#1a1403]/90 via-black to-black p-5 shadow-xl hover:border-[#f6e27a] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{game.icon}</span>
                  <span className="rounded bg-[#2a2105] border border-[#f6e27a]/50 px-2 py-0.5 text-[9px] font-black text-[#fde047] flex items-center gap-1">
                    <Lock size={9} /> PRIVATE
                  </span>
                </div>
                <h3 className="font-display gold-text text-base font-bold leading-tight mb-1">
                  {game.name}
                </h3>
                <p className="text-[11px] text-[#a89872] line-clamp-2 mb-4 leading-relaxed">
                  {game.description}
                </p>
                <div className="space-y-1 text-[11px] text-[#cbb98a] mb-4 bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8a7a4d]">Capacity:</span>
                    <span className="font-bold text-[#f6e27a]">{game.minPlayers}–{game.maxPlayers} Players</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8a7a4d]">Format:</span>
                    <span className="font-bold text-emerald-400">Invite-Only</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setHostGame(game.id)
                  setShowHostModal(true)
                }}
                className="btn-gold w-full rounded-xl py-2 text-xs font-black flex items-center justify-center gap-1.5 shadow-md"
              >
                <Crown size={13} /> HOST THIS TABLE →
              </button>
            </div>
          ))}
        </div>

        {/* Modal: Host Party */}
        {showHostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="panel-noir rounded-2xl border-2 border-[#f6e27a] bg-gradient-to-b from-[#1f1704] via-black to-black p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-[#c9a227]/30 pb-3">
                <div className="flex items-center gap-2">
                  <Crown size={18} className="text-[#f6e27a]" />
                  <h3 className="font-display gold-text-bright text-lg font-bold">
                    HOST A PRIVATE VIP TABLE
                  </h3>
                </div>
                <button onClick={() => setShowHostModal(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#a89872] uppercase font-bold tracking-wider mb-1">
                    PARTY NAME
                  </label>
                  <input
                    type="text"
                    value={hostRoomName}
                    onChange={(e) => setHostRoomName(e.target.value)}
                    placeholder={`${myName}'s VIP Party`}
                    className="w-full rounded-xl border border-[#c9a227]/40 bg-black/80 px-3 py-2 text-xs text-[#f2e6c9] outline-none focus:border-[#f6e27a]"
                  />
                </div>

                <div>
                  <label className="block text-[#a89872] uppercase font-bold tracking-wider mb-1">
                    SELECT INITIAL CASINO GAME
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PARTY_GAMES.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setHostGame(g.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          hostGame === g.id
                            ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-md'
                            : 'border-white/10 bg-black/40 text-gray-400'
                        }`}
                      >
                        <div className="text-lg">{g.icon}</div>
                        <div className="font-bold text-xs mt-1">{g.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[#a89872] uppercase font-bold tracking-wider mb-1">
                    STAKES TIER
                  </label>
                  <select
                    value={hostStakesTier}
                    onChange={(e) => setHostStakesTier(e.target.value)}
                    className="w-full rounded-xl border border-[#c9a227]/40 bg-black/80 px-3 py-2 text-xs text-[#f2e6c9] outline-none"
                  >
                    {PARTY_STAKES_TIERS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Min Buy-In: {fmt(t.minBuyIn)} Chips)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <div className="flex items-center gap-2 text-[#f6e27a]">
                    <Lock size={14} />
                    <span className="font-bold">Private VIP Table (Invite-Only)</span>
                  </div>
                  <span className="rounded bg-black/60 border border-[#f6e27a]/40 px-2 py-0.5 text-[10px] text-[#f6e27a] font-mono">
                    EXCLUSIVE
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#c9a227]/30 pt-4">
                <button onClick={() => setShowHostModal(false)} className="btn-ghost-gold rounded-xl px-4 py-2 text-xs">
                  CANCEL
                </button>
                <button onClick={handleHostCreate} className="btn-gold rounded-xl px-5 py-2 text-xs font-black shadow-lg">
                  OPEN PRIVATE TABLE →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Join By Code */}
        {showJoinCodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="panel-noir rounded-2xl border-2 border-[#f6e27a] bg-gradient-to-b from-[#1f1704] via-black to-black p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-[#c9a227]/30 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-[#f6e27a]" />
                  <h3 className="font-display gold-text-bright text-lg font-bold">
                    JOIN BY PARTY CODE
                  </h3>
                </div>
                <button onClick={() => setShowJoinCodeModal(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#cbb98a]">
                  Enter the 4-character invite code provided by the party host:
                </p>
                <input
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GF88"
                  className="w-full text-center tracking-[0.3em] font-mono text-2xl font-black rounded-xl border border-[#c9a227]/60 bg-black/90 py-3 text-[#f6e27a] outline-none"
                />
                {joinCodeError && <p className="text-xs text-red-400 font-bold">{joinCodeError}</p>}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#c9a227]/30 pt-4">
                <button onClick={() => setShowJoinCodeModal(false)} className="btn-ghost-gold rounded-xl px-4 py-2 text-xs">
                  CANCEL
                </button>
                <button onClick={() => handleJoinByCode()} className="btn-gold rounded-xl px-5 py-2 text-xs font-black">
                  JOIN PRIVATE TABLE →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RENDER: ACTIVE PARTY (LOBBY VIEW OR LIVE GAME VIEW)
  // -------------------------------------------------------------------------
  const currentGameInfo = PARTY_GAMES.find((g) => g.id === activeRoom.game) || PARTY_GAMES[0]
  const myMember = activeRoom.members.find((m) => m.name.toLowerCase() === myName.toLowerCase())
  const readyCount = activeRoom.members.filter((m) => m.isReady).length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
      {burstCount > 0 && <GoldBurst trigger={burstCount} />}

      {/* Floating Reaction Emotes */}
      {floatingEmotes.map((e) => (
        <div
          key={e.id}
          className="fixed pointer-events-none z-50 text-4xl animate-bounce"
          style={{
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {e.emote}
        </div>
      ))}

      {/* Champagne Toast Banner */}
      {recentToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl border-2 border-[#fde047] bg-gradient-to-r from-[#78350f] via-black to-[#78350f] p-4 text-center shadow-[0_0_35px_rgba(253,224,71,0.5)] animate-bounce max-w-lg">
          <div className="text-3xl mb-1">🍾🥂✨</div>
          <div className="font-display gold-text-bright text-sm font-black tracking-wider uppercase">
            CHAMPAGNE TOAST!
          </div>
          <p className="text-xs text-[#fef08a] mt-1">{recentToast.text}</p>
        </div>
      )}

      {/* Party Navigation Bar */}
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={activeRoom.status === 'playing' ? handleReturnToLobby : handleLeaveParty}
            className="btn-ghost-gold flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold"
          >
            <ArrowLeft size={13} /> {activeRoom.status === 'playing' ? 'PARTY LOBBY' : 'LEAVE PARTY'}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display gold-text-bright text-xl font-black tracking-wider">
                {activeRoom.name}
              </h2>
              <span className="rounded bg-[#2a2105] border border-[#fde047]/40 px-2 py-0.5 text-[10px] font-bold text-[#fde047]">
                CODE: {activeRoom.code}
              </span>
              <span className="rounded bg-emerald-950/60 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                {currentGameInfo.name}
              </span>
            </div>
            <div className="text-[11px] text-[#8a7a4d]">
              Host: <b className="text-[#f6e27a]">{activeRoom.hostName}</b> · {activeRoom.members.length} Players Connected · Stakes: {activeRoom.stakes.name}
            </div>
          </div>
        </div>

        {/* Quick Social & Share Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            className="btn-ghost-gold flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold"
            title="Copy invitation code"
          >
            {codeCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{codeCopied ? 'COPIED!' : 'COPY CODE'}</span>
          </button>
          <button
            onClick={handleCopyLink}
            className="btn-ghost-gold flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold"
            title="Copy direct invite link"
          >
            {linkCopied ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            <span>{linkCopied ? 'LINK COPIED!' : 'SHARE LINK'}</span>
          </button>
          <button
            onClick={handlePopChampagne}
            className="rounded-xl border border-[#fbbf24] bg-gradient-to-r from-[#78350f] to-[#451a03] px-3.5 py-1.5 text-xs font-black text-[#fde047] hover:scale-105 transition-transform flex items-center gap-1.5 shadow-md"
            title="Pop a bottle of Dom Pérignon for the party (10,000 chips)"
          >
            <Wine size={14} /> POP CHAMPAGNE
          </button>
          <button
            onClick={() => {
              const m = !isAudioMuted
              setMuted(m)
              setIsAudioMuted(m)
            }}
            className="btn-ghost-gold rounded-lg p-2"
          >
            {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. LOBBY VIEW (BEFORE GAME STARTS)                                     */}
      {/* ===================================================================== */}
      {activeRoom.status === 'lobby' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: Game Card & Player Roster (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Selected Game Card Banner */}
            <div className="panel-noir rounded-3xl border-2 border-[#f6e27a]/60 bg-gradient-to-r from-[#1f1704] via-black to-[#1f1704] p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-5xl drop-shadow">{currentGameInfo.icon}</span>
                <div>
                  <span className="text-[10px] font-bold tracking-[0.25em] text-[#8a7a4d] uppercase">
                    CURRENT PARTY GAME
                  </span>
                  <h3 className="font-display gold-text-bright text-2xl font-black">
                    {currentGameInfo.name}
                  </h3>
                  <p className="text-xs text-[#cbb98a] mt-0.5 max-w-md">
                    {currentGameInfo.description}
                  </p>
                </div>
              </div>

              {isHost && (
                <button
                  onClick={() => setShowChangeGameModal(true)}
                  className="btn-ghost-gold rounded-xl px-4 py-2 text-xs font-bold shrink-0"
                >
                  CHANGE GAME ▾
                </button>
              )}
            </div>

            {/* Player Roster Card */}
            <div className="panel-noir rounded-3xl border border-[#c9a227]/30 bg-black/80 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#f6e27a]" />
                  <h3 className="font-display text-sm font-bold tracking-wider text-[#f2e6c9]">
                    PARTY MEMBERS ({activeRoom.members.length} / {activeRoom.maxSeats})
                  </h3>
                </div>
                <div className="text-xs text-emerald-400 font-bold">
                  {readyCount} of {activeRoom.members.length} Players Ready
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {activeRoom.members.map((m) => {
                  const isMe = m.name.toLowerCase() === myName.toLowerCase()
                  return (
                    <div
                      key={m.id || m.name}
                      className={`panel-noir rounded-2xl p-3.5 border transition-all flex items-center justify-between ${
                        isMe
                          ? 'border-[#f6e27a] bg-[#2a2105]/60'
                          : 'border-white/10 bg-black/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <Nametag name={m.name} tagId={m.tag} badge={m.badge} compact />
                          <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-black" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-[#f2e6c9] truncate">{m.name}</span>
                            {m.isHost && (
                              <span className="rounded bg-[#f6e27a] text-black text-[8px] font-black px-1">
                                HOST
                              </span>
                            )}
                            {isMe && (
                              <span className="rounded bg-black/60 border border-white/20 text-[#f6e27a] text-[8px] font-bold px-1">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#8a7a4d] tabular-nums">{fmt(m.chips)} chips</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.isReady ? (
                          <span className="rounded-full bg-emerald-950/80 border border-emerald-500 px-2 py-0.5 text-[9px] font-black text-emerald-400">
                            READY
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-950/80 border border-amber-500 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                            WAITING
                          </span>
                        )}

                        {/* Host controls on other members */}
                        {isHost && !m.isHost && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTransferHost(m.name)}
                              title="Make this player host"
                              className="text-gray-500 hover:text-[#f6e27a] p-1"
                            >
                              <Crown size={13} />
                            </button>
                            <button
                              onClick={() => handleKickPlayer(m.name)}
                              title="Kick player from party"
                              className="text-gray-500 hover:text-red-400 p-1"
                            >
                              <UserX size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Lobby Action Bar */}
              <div className="mt-6 border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={handleToggleReady}
                  className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all ${
                    myMember?.isReady
                      ? 'border border-amber-500/80 bg-amber-950/80 text-amber-300'
                      : 'border border-emerald-500 bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900'
                  }`}
                >
                  {myMember?.isReady ? 'MARK NOT READY' : "I'M READY TO PLAY"}
                </button>

                {isHost ? (
                  <button
                    onClick={handleStartPartyGame}
                    className="btn-gold rounded-xl px-8 py-3 text-sm font-black shadow-[0_0_25px_rgba(246,226,122,0.35)] flex items-center gap-2"
                  >
                    <Play size={16} /> START PARTY GAME →
                  </button>
                ) : (
                  <div className="text-xs text-[#8a7a4d] italic">
                    Waiting for host {activeRoom.hostName} to start the game...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Party Chat & Emote Reactions (4 cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between panel-noir rounded-3xl border border-[#c9a227]/30 bg-black/90 p-4 shadow-xl h-[560px]">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={15} className="text-[#f6e27a]" />
                  <span className="font-display text-xs font-bold tracking-wider text-[#f2e6c9]">
                    PARTY CHAT
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">● LIVE</span>
              </div>

              {/* Quick Reactions Bar */}
              <div className="flex items-center justify-between gap-1 mb-3 bg-white/5 rounded-xl p-1.5 border border-white/5">
                {['🥂', '🎉', '🔥', '👑', '😎', '💰', '🃏'].map((em) => (
                  <button
                    key={em}
                    onClick={() => handleSendEmote(em)}
                    className="text-lg hover:scale-125 transition-transform p-1"
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* Messages Feed */}
              <div className="space-y-2 overflow-y-auto max-h-[350px] pr-1 no-scrollbar text-xs">
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl p-2 leading-relaxed ${
                      m.isSystem
                        ? 'bg-[#2a2105]/50 border border-[#fde047]/20 text-[#fde047] italic text-[11px]'
                        : 'bg-white/5 border border-white/5 text-[#f2e6c9]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#8a7a4d] mb-0.5">
                      <span className="font-bold text-[#f6e27a]">{m.sender}</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div>{m.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input box */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Toast the party or chat..."
                className="flex-1 rounded-xl border border-[#c9a227]/30 bg-black/80 px-3 py-2 text-xs text-[#f2e6c9] placeholder:text-gray-600 focus:border-[#f6e27a] focus:outline-none"
              />
              <button onClick={handleSendChat} className="btn-gold rounded-xl p-2 text-xs" title="Send message">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. PLAYING VIEW: TEXAS HOLD'EM POKER                                  */}
      {/* ===================================================================== */}
      {activeRoom.status === 'playing' && activeRoom.game === 'poker' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 panel-noir rounded-3xl border-2 border-[#c9a227]/40 bg-gradient-to-b from-[#140507] via-[#0d140e] to-black p-4 sm:p-6 shadow-2xl relative min-h-[520px] flex flex-col justify-between">
            {/* Table Surface Oval */}
            <div className="relative w-full h-[380px] rounded-[180px] border-4 border-[#3d240d] bg-gradient-to-b from-[#0e4228] to-[#062415] shadow-inner flex flex-col items-center justify-center p-4">
              <div className="absolute inset-4 rounded-[160px] border border-[#d4af37]/30 pointer-events-none" />

              {/* Central Pot & Board */}
              <div className="flex flex-col items-center justify-center text-center z-10 my-auto">
                <div className="text-[10px] tracking-[0.25em] text-[#d4af37] font-bold uppercase mb-1">
                  COMMUNITY POT
                </div>
                <div className="font-display gold-text-bright text-3xl font-black tabular-nums drop-shadow mb-3 flex items-center gap-2">
                  <Coins size={22} className="text-[#fde047]" /> {fmt(pokerPot)}
                </div>

                {/* 5 Community Cards */}
                <div className="flex items-center gap-2 min-h-[65px]">
                  {pokerBoard.length === 0 && pokerStreet !== 'waiting' && (
                    <div className="text-xs text-[#8a7a4d] italic">Dealing Flop...</div>
                  )}
                  {pokerBoard.map((c, i) => (
                    <PlayingCard key={i} card={c} size="sm" dealDelay={i * 80} />
                  ))}
                </div>

                {pokerStreet === 'showdown' && pokerWinners.length > 0 && (
                  <div className="mt-3 rounded-full border border-[#fde047] bg-[#2a2105]/95 px-5 py-1.5 text-xs font-black text-[#fde047] shadow-xl animate-bounce">
                    🏆 {pokerWinners[0].name} WINS {fmt(pokerWinners[0].amount)} ({pokerWinners[0].handName})
                  </div>
                )}
              </div>

              {/* Seated Players Around Table */}
              <div className="absolute inset-2 pointer-events-none flex items-center justify-between">
                {pokerSeats.map((s, idx) => {
                  const isMe = s.name.toLowerCase() === myName.toLowerCase()
                  const isTurn = pokerToAct === idx && pokerStreet !== 'waiting' && pokerStreet !== 'showdown'
                  return (
                    <div
                      key={s.seatId}
                      className={`pointer-events-auto panel-noir rounded-2xl p-2.5 text-center transition-all ${
                        isTurn
                          ? 'border-2 border-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.4)] scale-105'
                          : isMe
                          ? 'border-2 border-[#f6e27a]/60 bg-[#1f1704]/90'
                          : 'border border-white/10 bg-black/60'
                      } ${s.folded ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Nametag name={s.name} tagId={s.tag} badge={s.badge} compact />
                        {pokerButton === idx && (
                          <span className="rounded-full bg-[#f6e27a] text-black font-black text-[8px] px-1 shadow">
                            D
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-[#fde047] tabular-nums mt-0.5">
                        {fmt(isMe ? balance : s.chips)}
                      </div>

                      {/* Cards */}
                      <div className="mt-1 flex justify-center -space-x-2">
                        {isMe && s.holes.length === 2 ? (
                          <>
                            <PlayingCard card={s.holes[0]} size="xs" />
                            <PlayingCard card={s.holes[1]} size="xs" />
                          </>
                        ) : pokerStreet === 'showdown' && s.holes.length === 2 && !s.folded ? (
                          <>
                            <PlayingCard card={s.holes[0]} size="xs" />
                            <PlayingCard card={s.holes[1]} size="xs" />
                          </>
                        ) : s.holes.length === 2 && !s.folded ? (
                          <>
                            <div className="w-6 h-9 rounded border border-white/20 bg-gradient-to-br from-[#800] to-[#300] shadow" />
                            <div className="w-6 h-9 rounded border border-white/20 bg-gradient-to-br from-[#800] to-[#300] shadow" />
                          </>
                        ) : null}
                      </div>

                      {s.lastAction && (
                        <div className="text-[9px] font-black text-[#a7f3d0] mt-1">{s.lastAction}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Poker Controls */}
            <div className="mt-4 border-t border-white/10 pt-3 flex flex-wrap items-center justify-between gap-3">
              {pokerStreet === 'waiting' || pokerStreet === 'showdown' ? (
                <div className="w-full flex items-center justify-center gap-3">
                  <button
                    onClick={startPokerHand}
                    className="btn-gold rounded-xl px-10 py-3 text-sm font-black shadow-[0_0_20px_rgba(246,226,122,0.3)]"
                  >
                    DEAL NEXT HAND
                  </button>
                </div>
              ) : pokerToAct !== -1 && pokerSeats[pokerToAct]?.name.toLowerCase() === myName.toLowerCase() ? (
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1a1403]/90 rounded-2xl p-3 border border-[#f6e27a]/40 shadow-xl">
                  <div className="flex items-center gap-2">
                    <span className="animate-ping h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="font-display text-xs font-black text-[#fde047] tracking-wider uppercase">
                      YOUR TURN TO ACT
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => handlePokerAction('fold')} className="btn-crimson rounded-xl px-4 py-2 text-xs font-bold">
                      FOLD
                    </button>
                    {pokerCurrentBet <= (pokerSeats[pokerToAct]?.currentBet || 0) ? (
                      <button onClick={() => handlePokerAction('check')} className="btn-ghost-gold rounded-xl px-5 py-2 text-xs font-bold">
                        CHECK
                      </button>
                    ) : (
                      <button onClick={() => handlePokerAction('call')} className="btn-gold rounded-xl px-5 py-2 text-xs font-black">
                        CALL {fmt(Math.min(balance, pokerCurrentBet - (pokerSeats[pokerToAct]?.currentBet || 0)))}
                      </button>
                    )}
                    <button
                      onClick={() => handlePokerAction('raise', pokerCurrentBet + (activeRoom?.stakes.bb || 1000) * 2)}
                      className="rounded-xl border border-emerald-500 bg-emerald-950/80 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900"
                    >
                      RAISE
                    </button>
                    <button
                      onClick={() => handlePokerAction('raise', balance)}
                      className="rounded-xl border border-amber-500 bg-amber-950/80 px-4 py-2 text-xs font-black text-[#fde047] hover:bg-amber-900"
                    >
                      ALL-IN
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full text-center text-xs text-[#8a7a4d] italic py-2">
                  Waiting for {pokerSeats[pokerToAct]?.name || 'player'} to act...
                </div>
              )}
            </div>
          </div>

          {/* Social Chat */}
          <div className="lg:col-span-4 flex flex-col justify-between panel-noir rounded-3xl border border-[#c9a227]/30 bg-black/90 p-4 shadow-xl h-[520px]">
            <PartySocialChat
              messages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              onSend={handleSendChat}
              onEmote={handleSendEmote}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. PLAYING VIEW: MULTIPLAYER EUROPEAN ROULETTE                        */}
      {/* ===================================================================== */}
      {activeRoom.status === 'playing' && activeRoom.game === 'roulette' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 panel-noir rounded-3xl border-2 border-[#ef4444]/40 bg-gradient-to-b from-[#1a0505] via-black to-black p-5 shadow-2xl space-y-5">
            {/* Live Spinning Wheel */}
            <div className="panel-noir rounded-2xl border border-white/10 p-4 flex flex-col items-center justify-center bg-black/60">
              <RouletteWheelSvg wheelRef={wheelSvgRef} ballRef={ballDivRef} highlight={rouletteWinningNum} />
              {rouletteWinningNum !== null && !rouletteSpinning && (
                <div className="flex flex-col items-center gap-2 mt-3">
                  <div className="flex items-center gap-2 rounded-full border border-[#fde047] bg-[#2a2105] px-4 py-1.5 text-xs font-black text-[#fde047] shadow-lg animate-bounce">
                    <span>WINNING NUMBER:</span>
                    <span className={`px-2 py-0.5 rounded text-white ${roulettePocketColor(rouletteWinningNum) === '#a3001f' ? 'bg-red-600' : rouletteWinningNum === 0 ? 'bg-emerald-600' : 'bg-black'}`}>
                      {rouletteWinningNum}
                    </span>
                  </div>
                  {rouletteLastWinners.length > 0 && (
                    <div className="text-[11px] font-bold text-emerald-400">
                      Winners: {rouletteLastWinners.map((w) => `${w.name} (+${fmt(w.amount)})`).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Shared Bets Board */}
            <div className="rounded-2xl border border-[#c9a227]/30 bg-[#0e3d2c]/60 p-4 shadow-inner">
              <div className="text-[10px] tracking-widest text-[#f6e27a] uppercase font-bold mb-3 flex items-center justify-between">
                <span>MULTIPLAYER BETTING BOARD ({rouletteBets.length} Active Bets)</span>
                <span className="text-gray-300">Chip: {fmt(rouletteChipSize)}</span>
              </div>

              {/* Quick Outside Bets */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-3">
                {(['red', 'black', 'even', 'odd', 'low', 'high'] as RouletteBetType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setRouletteSelectedBet(t); sfx.click() }}
                    className={`rounded-xl py-2 text-xs font-black uppercase transition-all ${
                      rouletteSelectedBet === t
                        ? 'border-2 border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-md'
                        : t === 'red'
                        ? 'bg-red-800 text-white border border-red-500/50'
                        : t === 'black'
                        ? 'bg-neutral-900 text-white border border-neutral-700'
                        : 'bg-black/60 text-[#cbb98a] border border-white/10'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="flex items-center gap-2">
                  {[100, 500, 1000, 5000].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => { setRouletteChipSize(sz); sfx.chip() }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        rouletteChipSize === sz ? 'bg-[#f6e27a] text-black' : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      {fmt(sz)}
                    </button>
                  ))}
                  <button
                    onClick={handlePlaceRouletteBet}
                    disabled={rouletteSpinning || balance < rouletteChipSize}
                    className="btn-gold rounded-xl px-5 py-2 text-xs font-black shadow-md disabled:opacity-40"
                  >
                    PLACE BET
                  </button>
                </div>

                {isHost ? (
                  <button
                    onClick={handleSpinRoulette}
                    disabled={rouletteSpinning || rouletteBets.length === 0}
                    className="btn-crimson rounded-xl px-7 py-2.5 text-xs font-black shadow-xl disabled:opacity-40"
                  >
                    {rouletteSpinning ? 'SPINNING...' : 'SPIN WHEEL!'}
                  </button>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/60 px-5 py-2 text-xs font-bold text-gray-400">
                    {rouletteSpinning ? 'WHEEL IS SPINNING...' : 'WAITING FOR HOST TO SPIN...'}
                  </div>
                )}
              </div>

              {/* Placed Bets Feed */}
              {rouletteBets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                  {rouletteBets.map((b) => (
                    <span key={b.id} className="rounded-full bg-black/60 border border-white/20 px-2.5 py-0.5 text-[10px] text-[#fde047]">
                      {b.playerName}: {b.betType} ({fmt(b.amount)})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Social Chat */}
          <div className="lg:col-span-4 flex flex-col justify-between panel-noir rounded-3xl border border-[#c9a227]/30 bg-black/90 p-4 shadow-xl h-[520px]">
            <PartySocialChat
              messages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              onSend={handleSendChat}
              onEmote={handleSendEmote}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. PLAYING VIEW: MULTIPLAYER BLACKJACK VIP                            */}
      {/* ===================================================================== */}
      {activeRoom.status === 'playing' && activeRoom.game === 'blackjack' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 panel-noir rounded-3xl border-2 border-[#3b82f6]/40 bg-gradient-to-b from-[#0a1428] via-black to-black p-5 shadow-2xl space-y-5">
            {/* Dealer Box */}
            <div className="panel-noir rounded-2xl border border-white/10 p-4 text-center bg-[#071828]/60">
              <span className="text-[10px] tracking-widest text-[#93c5fd] uppercase font-bold">
                HOUSE DEALER ({bjDealerCards.length ? `${bjValue(bjDealerCards).total} PTS` : 'DEALER'})
              </span>
              <div className="flex justify-center gap-2 mt-2 min-h-[75px]">
                {bjDealerCards.map((c, i) => (
                  <PlayingCard key={i} card={c} size="sm" />
                ))}
              </div>
            </div>

            {/* Players Table Boxes */}
            <div className="grid gap-3 sm:grid-cols-3">
              {bjHands.map((h, idx) => {
                const isMe = h.playerName.toLowerCase() === myName.toLowerCase()
                const isActive = bjActiveIndex === idx
                return (
                  <div
                    key={h.playerId || h.playerName}
                    className={`panel-noir rounded-2xl p-3 text-center border transition-all ${
                      isActive
                        ? 'border-2 border-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.4)]'
                        : isMe
                        ? 'border border-[#f6e27a]/60 bg-[#1f1704]'
                        : 'border border-white/10 bg-black/60'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#f2e6c9]">{h.playerName}</div>
                    <div className="text-[10px] text-[#8a7a4d]">Bet: {fmt(h.bet)}</div>
                    <div className="flex justify-center gap-1 my-2 min-h-[55px]">
                      {h.cards.map((c, i) => (
                        <PlayingCard key={i} card={c} size="xs" />
                      ))}
                    </div>
                    <div className="text-xs font-black text-[#fde047]">
                      {h.cards.length ? `${bjValue(h.cards).total} PTS` : ''}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-emerald-400 mt-1">{h.status}</div>
                  </div>
                )
              })}
            </div>

            {/* Blackjack Controls */}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              {bjPhase === 'betting' || bjPhase === 'settled' ? (
                <button onClick={handleStartBjRound} className="btn-gold rounded-xl px-8 py-2.5 text-xs font-black shadow-lg">
                  DEAL BLACKJACK ROUND
                </button>
              ) : bjActiveIndex !== -1 && bjHands[bjActiveIndex]?.playerName.toLowerCase() === myName.toLowerCase() ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-[#fde047]">YOUR TURN:</span>
                  <button onClick={handleBjHit} className="btn-gold rounded-xl px-6 py-2 text-xs font-black">
                    HIT
                  </button>
                  <button onClick={handleBjStand} className="btn-crimson rounded-xl px-6 py-2 text-xs font-bold">
                    STAND
                  </button>
                </div>
              ) : (
                <div className="text-xs text-[#8a7a4d] italic">
                  Waiting for {bjHands[bjActiveIndex]?.playerName || 'player'}...
                </div>
              )}
            </div>
          </div>

          {/* Social Chat */}
          <div className="lg:col-span-4 flex flex-col justify-between panel-noir rounded-3xl border border-[#c9a227]/30 bg-black/90 p-4 shadow-xl h-[520px]">
            <PartySocialChat
              messages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              onSend={handleSendChat}
              onEmote={handleSendEmote}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. PLAYING VIEW: LUCKY DICE & CRAPS DUEL                             */}
      {/* ===================================================================== */}
      {activeRoom.status === 'playing' && activeRoom.game === 'dice' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 panel-noir rounded-3xl border-2 border-[#f59e0b]/40 bg-gradient-to-b from-[#1a1103] via-black to-black p-5 shadow-2xl space-y-5">
            {/* Rolling Arena */}
            <div className="panel-noir rounded-2xl border border-white/10 p-6 flex flex-col items-center justify-center bg-black/60">
              <span className="text-[10px] tracking-widest text-[#fde047] uppercase font-bold mb-3">
                LIVE CASINO DICE ({diceRolling ? 'ROLLING...' : `TOTAL: ${diceD1 + diceD2}`})
              </span>
              <div className="flex items-center gap-6 my-2">
                <Die value={diceD1} size={80} rolling={diceRolling} />
                <Die value={diceD2} size={80} rolling={diceRolling} delay={100} />
              </div>
              {diceLastResult && (
                <div className="mt-3 text-xs text-[#86efac] font-bold">
                  Last Roll: {diceLastResult.total} · {diceLastResult.winners.length} Winners Paid!
                </div>
              )}
            </div>

            {/* Bets Board */}
            <div className="rounded-2xl border border-[#f59e0b]/30 bg-[#2a1705]/60 p-4">
              <div className="text-[10px] tracking-widest text-[#fde047] uppercase font-bold mb-2">
                CHOOSE OUTCOME ({diceBets.length} Bets Placed)
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { id: 'low', label: 'LOW (2-6)', pays: '2x' },
                  { id: 'seven', label: 'LUCKY 7', pays: '4x' },
                  { id: 'high', label: 'HIGH (8-12)', pays: '2x' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setDiceChoice(c.id as DiceBetChoice); sfx.click() }}
                    className={`rounded-xl py-3 text-center transition-all ${
                      diceChoice === c.id
                        ? 'border-2 border-[#fde047] bg-[#78350f] text-[#fde047]'
                        : 'border border-white/10 bg-black/40 text-gray-300'
                    }`}
                  >
                    <div className="font-black text-xs">{c.label}</div>
                    <div className="text-[10px] text-[#f6e27a]">Pays {c.pays}</div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <div className="flex items-center gap-2">
                  {[100, 500, 1000, 5000].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => { setDiceBetAmt(sz); sfx.chip() }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        diceBetAmt === sz ? 'bg-[#f6e27a] text-black' : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      {fmt(sz)}
                    </button>
                  ))}
                  <button onClick={handlePlaceDiceBet} className="btn-gold rounded-xl px-5 py-2 text-xs font-black">
                    PLACE BET
                  </button>
                </div>

                <button
                  onClick={handleRollDice}
                  disabled={diceRolling || diceBets.length === 0}
                  className="btn-gold rounded-xl px-7 py-2.5 text-xs font-black shadow-lg disabled:opacity-40"
                >
                  ROLL DICE!
                </button>
              </div>
            </div>
          </div>

          {/* Social Chat */}
          <div className="lg:col-span-4 flex flex-col justify-between panel-noir rounded-3xl border border-[#c9a227]/30 bg-black/90 p-4 shadow-xl h-[520px]">
            <PartySocialChat
              messages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              onSend={handleSendChat}
              onEmote={handleSendEmote}
            />
          </div>
        </div>
      )}

      {/* Modal: Change Game (Host Only) */}
      {showChangeGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="panel-noir rounded-2xl border-2 border-[#f6e27a] bg-gradient-to-b from-[#1f1704] via-black to-black p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-display gold-text-bright text-lg font-bold mb-3">
              CHANGE PARTY GAME
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {PARTY_GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleChangeGame(g.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    activeRoom.game === g.id
                      ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                      : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="text-2xl">{g.icon}</div>
                  <div className="font-bold text-xs mt-1">{g.name}</div>
                  <div className="text-[10px] text-gray-400">{g.minPlayers}-{g.maxPlayers} Players</div>
                </button>
              ))}
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setShowChangeGameModal(false)} className="btn-ghost-gold rounded-xl px-4 py-2 text-xs">
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PartySocialChat({
  messages,
  chatInput,
  setChatInput,
  onSend,
  onEmote,
}: {
  messages: PartyChatMessage[]
  chatInput: string
  setChatInput: (s: string) => void
  onSend: () => void
  onEmote: (e: string) => void
}) {
  return (
    <>
      <div>
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <MessageSquare size={15} className="text-[#f6e27a]" />
            <span className="font-display text-xs font-bold tracking-wider text-[#f2e6c9]">
              PARTY CHAT &amp; REACTIONS
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">● LIVE</span>
        </div>

        <div className="flex items-center justify-between gap-1 mb-3 bg-white/5 rounded-xl p-1.5 border border-white/5">
          {['🥂', '🎉', '🔥', '👑', '😎', '💰', '🃏'].map((em) => (
            <button
              key={em}
              onClick={() => onEmote(em)}
              className="text-lg hover:scale-125 transition-transform p-1"
            >
              {em}
            </button>
          ))}
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[320px] pr-1 no-scrollbar text-xs">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-2 leading-relaxed ${
                m.isSystem
                  ? 'bg-[#2a2105]/50 border border-[#fde047]/20 text-[#fde047] italic text-[11px]'
                  : 'bg-white/5 border border-white/5 text-[#f2e6c9]'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-[#8a7a4d] mb-0.5">
                <span className="font-bold text-[#f6e27a]">{m.sender}</span>
                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div>{m.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-white/10 flex items-center gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder="Toast or chat with the party..."
          className="flex-1 rounded-xl border border-[#c9a227]/30 bg-black/80 px-3 py-2 text-xs text-[#f2e6c9] placeholder:text-gray-600 focus:border-[#f6e27a] focus:outline-none"
        />
        <button onClick={onSend} className="btn-gold rounded-xl p-2 text-xs" title="Send message">
          <Send size={14} />
        </button>
      </div>
    </>
  )
}
