import { investInGlobalStake, joinGlobalClub, fetchGlobalStakeInvestors } from './supabase'

export interface StakePoolData {
  contributions: Record<string, number>
  totalPool: number
}

const STAKE_KEY = 'golden-felt-stake-pool-v10'
const CLUB_KEY = 'golden-felt-club-members-v1'

export function getStakePool(): StakePoolData {
  try {
    // Purge all legacy versions containing dummy mock data
    for (let i = 1; i <= 9; i++) {
      localStorage.removeItem(`golden-felt-stake-pool-v${i}`)
    }

    const raw = localStorage.getItem(STAKE_KEY)
    let contributions: Record<string, number> = {}

    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.contributions === 'object') {
        for (const [k, v] of Object.entries(parsed.contributions)) {
          const num = Number(v)
          const lower = k.toLowerCase().trim()
          // Never allow seeded mock names
          if (['the house', 'kiarash', 'johnsmith', 'nik', 'toby', 'ethan', 'george', 'abhay'].includes(lower)) {
            continue
          }
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
  const cleanName = playerName.trim() || 'Player'
  const current = getStakePool()
  const myCurrent = current.contributions[cleanName] || 0
  current.contributions[cleanName] = myCurrent + amount
  const totalPool = Object.values(current.contributions).reduce((sum, v) => sum + v, 0)

  try {
    localStorage.setItem(STAKE_KEY, JSON.stringify(current))
    window.dispatchEvent(new Event('stake-pool-updated'))
    investInGlobalStake(cleanName, amount).then(() => {
      syncStakePoolFromSupabase().catch(() => {})
    }).catch(() => {})
  } catch {}

  const myContribution = current.contributions[cleanName]
  const myPercent = totalPool > 0 ? (myContribution / totalPool) * 100 : 0
  return { totalPool, myContribution, myPercent }
}

export function getPlayerStake(playerName: string): { totalPool: number; contribution: number; percent: number } {
  const current = getStakePool()
  const cleanTarget = (playerName || 'Player').trim().toLowerCase()
  let contribution = 0
  for (const [k, v] of Object.entries(current.contributions)) {
    if (k.toLowerCase().trim() === cleanTarget) {
      contribution += v
    }
  }
  const totalPool = current.totalPool > 0 ? current.totalPool : Object.values(current.contributions).reduce((a, b) => a + b, 0)
  const percent = totalPool > 0 ? Math.round((contribution / totalPool) * 1000) / 10 : 0
  return { totalPool, contribution, percent }
}

export async function syncStakePoolFromSupabase(): Promise<StakePoolData> {
  try {
    const remote = await fetchGlobalStakeInvestors()
    const currentLocal = getStakePool()
    if (remote && remote.length > 0) {
      const contributions: Record<string, number> = {}
      for (const inv of remote) {
        const name = (inv.player_name || '').trim()
        if (name && inv.tokens_staked > 0) {
          contributions[name] = inv.tokens_staked
        }
      }
      // Preserve local contribution if higher (pending sync)
      for (const [k, v] of Object.entries(currentLocal.contributions)) {
        if (!contributions[k] || contributions[k] < v) {
          contributions[k] = v
        }
      }
      const totalPool = Object.values(contributions).reduce((a, b) => a + b, 0)
      const data: StakePoolData = { contributions, totalPool }
      localStorage.setItem(STAKE_KEY, JSON.stringify(data))
      window.dispatchEvent(new Event('stake-pool-updated'))
      return data
    }
  } catch (err) {
    console.warn('Failed to sync stake pool from Supabase:', err)
  }
  return getStakePool()
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
