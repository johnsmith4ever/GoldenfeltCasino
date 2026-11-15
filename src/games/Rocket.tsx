import { GameShell } from '../components/GameShell'
import { Ban, AlertTriangle } from 'lucide-react'

export default function Rocket() {
  return (
    <GameShell screen="rocket">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/40 bg-gradient-to-b from-[#2a050a] via-[#1a0407] to-black p-8 sm:p-12 shadow-[0_0_50px_rgba(239,68,68,0.25)]">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500/50 bg-red-950/60 shadow-[0_0_25px_rgba(239,68,68,0.4)]">
            <Ban size={40} className="text-red-400" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3.5 py-1 text-[10px] font-black tracking-widest text-red-300 mb-4">
            <AlertTriangle size={12} /> GAME PERMANENTLY DECOMMISSIONED
          </div>

          <h2 className="font-display text-2xl font-black tracking-wider text-red-100 sm:text-3xl mb-4">
            ROCKET HAS BEEN REMOVED
          </h2>

          <p className="mx-auto max-w-lg text-[14px] leading-relaxed text-[#fca5a5]">
            Rocket has been removed. It was really annoying to patch the money glitches, so please stop trying to find ways to cause hyperinflation.
          </p>

          <div className="mt-8 border-t border-red-500/20 pt-6">
            <p className="text-[11px] text-[#8a7a4d]">
              Please enjoy our fair, exploit-free table classics and token games on the casino floor.
            </p>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
