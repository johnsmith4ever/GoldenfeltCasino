import { useState, type FormEvent } from 'react'
import { ChipsProvider } from './state/chips'
import { ShopProvider } from './state/shop'
import { PlayerProvider, usePlayer } from './state/profile'
import { Header, type Screen } from './components/GameShell'
import Lobby from './pages/Home'
import Shop from './pages/Shop'
import Properties from './pages/Properties'
import Club from './pages/Club'
import Bank from './pages/Bank'
import Leaderboard from './pages/Leaderboard'
import Blackjack from './games/Blackjack'
import Roulette from './games/Roulette'
import Slots from './games/Slots'
import Craps from './games/Craps'
import Poker from './games/Poker'
import Baccarat from './games/Baccarat'
import SicBo from './games/SicBo'
import War from './games/War'
import HighLow from './games/HighLow'
import Keno from './games/Keno'
import Rocket from './games/Rocket'
import Wheel from './games/Wheel'
import Dice from './games/Dice'
import CoinFlip from './games/CoinFlip'

function PlayerStart() {
  const { players, createPlayer, switchPlayer } = usePlayer()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = createPlayer(name)
    if (!result.ok) setError(result.error ?? 'Could not create player.')
  }
  return (
    <div className="velvet-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel-noir gold-frame w-full max-w-md rounded-2xl p-6 text-center sm:p-8">
        <div className="font-display gold-text-bright text-4xl font-black tracking-[0.18em]">GOLDEN FELT</div>
        <div className="divider-gold mx-auto mt-4 w-40" />
        <h1 className="font-display mt-5 text-lg font-bold tracking-[0.2em] text-[#f2e6c9]">WELCOME TO THE HOUSE</h1>
        <p className="mt-2 text-[13px] font-light leading-relaxed text-[#b3a06b]">Choose a player name to begin. No password, email or sign-in required.</p>
        <form onSubmit={submit} className="mt-6 text-left">
          <label htmlFor="player-name" className="text-[10px] tracking-[0.25em] text-[#b3a06b]">PLAYER NAME · 3–16 CHARACTERS</label>
          <input id="player-name" autoFocus autoComplete="off" minLength={3} maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className="mt-2 min-h-[48px] w-full rounded border border-[#c9a227]/40 bg-black/40 px-3 text-[15px] text-[#f2e6c9] outline-none placeholder:text-[#6b5f42] focus:border-[#f6e27a]" />
          {error && <p role="alert" className="mt-2 text-[12px] text-[#ff97a3]">{error}</p>}
          <button type="submit" disabled={name.trim().length < 3 || name.trim().length > 16} className="btn-gold mt-4 min-h-[48px] w-full rounded px-5 text-[12px]">ENTER THE CASINO</button>
        </form>
        <p className="mt-5 text-[11px] leading-relaxed text-[#8a7a5c]">Progress is saved in this browser only. Clearing site data or using private mode will erase it.</p>
        {players.length > 0 && <div className="mt-6 border-t border-[#c9a227]/20 pt-4 text-left"><p className="mb-2 text-[10px] tracking-[0.25em] text-[#8a7a4d]">EXISTING PLAYERS</p><div className="flex flex-wrap gap-2">{players.map((p) => <button key={p} onClick={() => switchPlayer(p)} className="btn-ghost-gold rounded px-3 py-2 text-[10px]">{p}</button>)}</div></div>}
      </div>
    </div>
  )
}

function CasinoApp({ playerName }: { playerName: string }) {
  const [screen, setScreen] = useState<Screen>('lobby')
  return (
    <ChipsProvider>
      <ShopProvider>
        <div className="velvet-bg min-h-screen">
          <Header
            screen={screen}
            onHome={() => setScreen('lobby')}
            onShop={() => setScreen('shop')}
            onProperties={() => setScreen('properties')}
            onClub={() => setScreen('club')}
            onBank={() => setScreen('bank')}
            onLeaderboard={() => setScreen('leaderboard')}
            playerName={playerName}
          />
          <main>
            {screen === 'lobby' && <Lobby onSelect={setScreen} />}
            {screen === 'shop' && <Shop />}
            {screen === 'properties' && <Properties />}
            {screen === 'club' && <Club />}
            {screen === 'bank' && <Bank />}
            {screen === 'leaderboard' && <Leaderboard />}
            {screen === 'blackjack' && <Blackjack />}
            {screen === 'roulette' && <Roulette />}
            {screen === 'slots' && <Slots />}
            {screen === 'craps' && <Craps />}
            {screen === 'poker' && <Poker />}
            {screen === 'baccarat' && <Baccarat />}
            {screen === 'sicbo' && <SicBo />}
            {screen === 'war' && <War />}
            {screen === 'highlow' && <HighLow />}
            {screen === 'keno' && <Keno />}
            {screen === 'rocket' && <Rocket />}
            {screen === 'wheel' && <Wheel />}
            {screen === 'dice' && <Dice />}
            {screen === 'coinflip' && <CoinFlip />}
          </main>
        </div>
      </ShopProvider>
    </ChipsProvider>
  )
}

function PlayerGate() {
  const { activeName } = usePlayer()
  return activeName ? <CasinoApp key={activeName} playerName={activeName} /> : <PlayerStart />
}

export default function App() {
  return <PlayerProvider><PlayerGate /></PlayerProvider>
}
