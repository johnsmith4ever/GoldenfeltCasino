import { investInGlobalStake, joinGlobalClub } from './supabase'

export interface StakePoolData {
  contributions: Record<string, number>
  totalPool: number
}

const STAKE_KEY = 'golden-felt-stake-pool-v1'
const CLUB_KEY = 'golden-felt-club-members-v1'

export function getStakePool(): StakePoolData {
  try {
    const raw = localStorage.getItem(STAKE_KEY)
    let contributions: Record<string, number> = {}
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.contributions === 'object') {
        for (const [k, v] of Object.entries(parsed.contributions)) {
          const num = Number(v)
          if (Number.isFinite(num) && num > 0) {
            contributions[k] = num
          }
        }
      }
    }
    const totalPool = Object.values(contributions).reduce((sum, v) => sum + v, 0)
    return { contributions, totalPool }
  } catch {
    return { contributions: {}, totalPool: 0 }
  }
}

export function investInStakePool(
  playerName: string,
  amount: number
): { totalPool: number; myContribution: number; myPercent: number } {
  const current = getStakePool()
  const cleanName = playerName.trim() || 'Player'
  const existingKey = Object.keys(current.contributions).find(
    (k) => k.toLowerCase() === cleanName.toLowerCase()
  )
  const key = existingKey ?? cleanName
  const myCurrent = current.contributions[key] || 0
  current.contributions[key] = myCurrent + amount

  try {
    localStorage.setItem(STAKE_KEY, JSON.stringify({ contributions: current.contributions }))
    window.dispatchEvent(new Event('stake-pool-updated'))
    investInGlobalStake(playerName, amount).catch(() => {})
  } catch {}

  const totalPool = Object.values(current.contributions).reduce((sum, v) => sum + (Number(v) || 0), 0)
  const myContribution = current.contributions[key]
  const myPercent = totalPool > 0 ? (myContribution / totalPool) * 100 : 0
  return { totalPool, myContribution, myPercent }
}

export function getPlayerStake(playerName: string): { totalPool: number; contribution: number; percent: number } {
  const current = getStakePool()
  const cleanName = (playerName || '').trim()
  const existingKey = Object.keys(current.contributions).find(
    (k) => k.toLowerCase() === cleanName.toLowerCase()
  )
  const contribution = existingKey ? current.contributions[existingKey] : 0
  const percent = current.totalPool > 0 ? (contribution / current.totalPool) * 100 : 0
  return { totalPool: current.totalPool, contribution, percent }
}

export interface ClubMember {
  name: string
  joinedAt: number
  title: string
}

export function getClubMembers(): ClubMember[] {
  try {
    const raw = localStorage.getItem(CLUB_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function isClubMember(playerName: string): boolean {
  if (!playerName) return false
  const members = getClubMembers()
  return members.some((m) => m.name.toLowerCase() === playerName.toLowerCase())
}

export function joinClub(playerName: string, title = 'High Roller'): ClubMember[] {
  const members = getClubMembers()
  const exists = members.find((m) => m.name.toLowerCase() === playerName.toLowerCase())
  if (!exists) {
    const newMember: ClubMember = {
      name: playerName,
      joinedAt: Date.now(),
      title,
    }
    const updated = [...members, newMember]
    try {
      localStorage.setItem(CLUB_KEY, JSON.stringify(updated))
      joinGlobalClub(playerName, title).catch(() => {})
    } catch {}
    return updated
  }
  return members
}

