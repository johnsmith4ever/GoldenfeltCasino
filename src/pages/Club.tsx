import { useState } from 'react'
import { useChips, fmt } from '../state/chips'
import { usePlayer } from '../state/profile'
import { useShop } from '../state/shop'
import { sfx } from '../lib/audio'
import { isClubMember, joinClub, getClubMembers } from '../lib/stakeAndClub'
import { Nametag } from '../components/Nametag'
import { Crown, Lock, Check, Award, Sparkles, Shield, Trophy } from 'lucide-react'

const ENTRANCE_FEE = 250000

const VIP_TAGS = [
  { id: 'tag-house', name: 'The House', title: 'THE HOUSE', desc: 'Obsidian noir with pulsing 24K gold border. The casino itself.' },
  { id: 'tag-baron', name: 'Diamond Baron', title: 'DIAMOND BARON', desc: 'Electric diamond cyan radiance. Master of high-stakes play.' },
  { id: 'tag-mogul', name: 'Casino Mogul', title: 'CASINO MOGUL', desc: 'Deep imperial velvet ruby with gilded filigree trim.' },
  { id: 'tag-whale', name: 'The Great Whale', title: 'HIGH ROLLER WHALE', desc: 'Midnight ocean navy and shifting iridescent turquoise.' },
  { id: 'tag-immortal', name: 'Immortal Gambler', title: 'IMMORTAL', desc: 'Cosmic violet glow with golden flames. Never folds.' },
  { id: 'tag-founder', name: 'Club Founder', title: 'CLUB FOUNDER', desc: 'Royal monarch purple with shimmering 24K gold leaf.' },
]

export default function Club() {
  const wallet = useChips()
  const player = usePlayer()
  const shop = useShop()
  const playerName = player.activeName ?? 'Player'

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [memberVersion, setMemberVersion] = useState(0)

  // Backup tools
  const [importCode, setImportCode] = useState('')
  const [exportCode, setExportCode] = useState('')
  const [showExport, setShowExport] = useState(false)

  const isMember = isClubMember(playerName)
  const members = getClubMembers()

  const handlePayEntrance = () => {
    if (wallet.balance < ENTRANCE_FEE) {
      setError(`You need ${fmt(ENTRANCE_FEE - wallet.balance)} more chips for the 250,000 entrance fee.`)
      return
    }
    if (!wallet.spend(ENTRANCE_FEE)) {
      setError('Could not process fee.')
      return
    }
    joinClub(playerName, 'High Roller Founder')
    sfx.coin()
    setMessage(`🎉 Welcome to the High Rollers Club! You are now inducted into the Hall of Fame.`)
    setError('')
    setMemberVersion((v) => v + 1)
  }

  const handleEquipVIPTag = (tagId: string, tagName: string) => {
    shop.equip(tagId)
    sfx.click()
    setMessage(`${tagName} nametag equipped!`)
    setError('')
  }

  const exportNow = () => {
    const code = player.exportSave()
    if (!code) { setError('Could not create backup.'); return }
    setExportCode(code)
    setShowExport(true)
    setMessage('Backup code generated.')
  }

  const importNow = () => {
    const result = player.importSave(importCode)
    if (!result.ok) { setError(result.error ?? 'Import failed.'); return }
    setMessage('Save imported. Reloading profile…')
    window.location.reload()
  }

  // If NOT a member, show the 250k Entrance Fee Gate
  if (!isMember) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8">
        <div className="relative overflow-hidden rounded-3xl border-2 border-[#c9a227] bg-gradient-to-b from-[#1c1404] via-[#0f0b02] to-black p-6 sm:p-10 shadow-[0_0_50px_rgba(201,162,39,0.25)] text-center">
          <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-[#f59e0b]/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-[#ef4444]/15 blur-3xl" />

          {/* Stanchion seal */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#f6e27a] bg-black/60 shadow-xl">
            <Lock size={36} className="text-[#f6e27a]" />
          </div>

          <p className="text-[11px] font-bold tracking-[0.4em] text-[#b3a06b]">MEMBERS ONLY LOUNGE</p>
          <h1 className="font-display gold-text-bright mt-2 text-3xl font-black tracking-[0.18em] sm:text-5xl">
            THE HIGH ROLLERS CLUB
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] font-light leading-relaxed text-[#cbb98a]">
            An exclusive sanctuary reserved for Golden Felt's elite. Entrance requires a one-time lifetime admission fee of <span className="font-bold text-[#fde047]">{fmt(ENTRANCE_FEE)} chips</span>.
          </p>

          <div className="divider-gold mx-auto my-6 w-40" />

          {error && <div className="mb-4 rounded-xl border border-[#ef4444]/60 bg-[#450a0a]/80 p-3 text-[12px] font-semibold text-[#fca5a5]">{error}</div>}

          {/* Perks list */}
          <div className="mx-auto mb-8 grid max-w-2xl gap-3 sm:grid-cols-3 text-left">
            <div className="rounded-xl border border-[#c9a227]/30 bg-black/50 p-4">
              <div className="text-2xl mb-1">🏛️</div>
              <div className="font-bold text-[13px] text-[#f2e6c9]">Hall of Fame</div>
              <div className="mt-1 text-[11px] text-[#8a7a4d]">Permanent induction in the lobby &amp; club.</div>
            </div>
            <div className="rounded-xl border border-[#c9a227]/30 bg-black/50 p-4">
              <div className="text-2xl mb-1">🏷️</div>
              <div className="font-bold text-[13px] text-[#f2e6c9]">VIP Nametags</div>
              <div className="mt-1 text-[11px] text-[#8a7a4d]">Unlock 6 exclusive high-roller titles &amp; styles.</div>
            </div>
            <div className="rounded-xl border border-[#c9a227]/30 bg-black/50 p-4">
              <div className="text-2xl mb-1">🍷</div>
              <div className="font-bold text-[13px] text-[#f2e6c9]">Private Suite</div>
              <div className="mt-1 text-[11px] text-[#8a7a4d]">Access to the secret members-only lounge.</div>
            </div>
          </div>

          {/* Pay Entrance Button */}
          <div className="mx-auto max-w-md">
            <button
              onClick={handlePayEntrance}
              disabled={wallet.balance < ENTRANCE_FEE}
              className="btn-gold w-full min-h-[52px] rounded-xl text-[13px] font-black tracking-[0.18em] shadow-[0_0_25px_rgba(245,158,11,0.4)] disabled:opacity-40"
            >
              PAY {fmt(ENTRANCE_FEE)} ENTRANCE FEE &amp; UNLOCK
            </button>
            <p className="mt-2 text-[11px] text-[#8a7a4d]">
              Your Balance: <span className="font-bold text-[#fde047]">{fmt(wallet.balance)} chips</span> · One-time fee
            </p>
          </div>
        </div>
      </div>
    )
  }

  // If MEMBER, render the full Club experience
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b] bg-[#2a1e05] px-3.5 py-1 text-[10px] font-black tracking-widest text-[#fde047]">
          <Crown size={12} /> LIFETIME CLUB MEMBER
        </div>
        <h1 className="font-display gold-text-bright mt-2 text-3xl font-black tracking-[0.18em] sm:text-4xl">
          THE HIGH ROLLERS CLUB
        </h1>
        <p className="mt-1 text-[13px] text-[#a89872]">VIP Nametag Lounge, Hall of Fame &amp; Player Archives · {playerName}</p>
        <div className="divider-gold mx-auto mt-3 w-48" />
      </div>

      {(error || message) && (
        <div role="status" className={`mb-5 rounded-xl border px-5 py-3 text-center text-[12px] font-semibold ${error ? 'border-[#ef4444]/60 bg-[#450a0a]/80 text-[#fca5a5]' : 'border-[#10b981]/60 bg-[#064e3b]/80 text-[#a7f3d0]'}`}>
          {error || message}
        </div>
      )}

      {/* ===================== EXCLUSIVE VIP NAMETAGS ===================== */}
      <section className="mb-10 rounded-2xl border-2 border-[#f59e0b]/60 bg-gradient-to-br from-[#1c1505] via-[#120f04] to-black p-6 shadow-[0_0_30px_rgba(245,158,11,0.2)] sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#f59e0b]/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#f59e0b] px-2 py-0.5 text-[9px] font-black tracking-wider text-[#140b02]">
                CLUB EXCLUSIVE
              </span>
              <span className="text-[10px] tracking-[0.25em] text-[#a89872]">UNLOCKED WITH MEMBERSHIP</span>
            </div>
            <h2 className="font-display gold-text-bright mt-1 text-2xl font-black tracking-wide">
              VIP NAMETAG LOUNGE
            </h2>
          </div>
          <div className="text-[11px] text-[#86efac] font-bold">✓ 6 ELITE NAMETAGS UNLOCKED</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VIP_TAGS.map((tag) => {
            const isEquipped = shop.equipped.tag === tag.id

            return (
              <div
                key={tag.id}
                className={`panel-noir flex flex-col justify-between rounded-xl p-4 border transition-all ${
                  isEquipped
                    ? 'border-[#fde047] bg-[#2a1e05]/80 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'border-[#c9a227]/25 hover:border-[#c9a227]/50'
                }`}
              >
                <div>
                  <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-black/40">
                    <Nametag tagId={tag.id} />
                  </div>
                  <h3 className="font-display font-bold text-base text-[#f2e6c9]">{tag.name}</h3>
                  <p className="mt-1 text-[11px] text-[#8a7a4d] leading-relaxed">{tag.desc}</p>
                </div>

                <div className="mt-4">
                  {isEquipped ? (
                    <button disabled className="btn-ghost-gold min-h-[40px] w-full rounded text-[11px] flex items-center justify-center gap-1.5 text-[#86efac]">
                      <Check size={14} /> ACTIVE NAMETAG
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEquipVIPTag(tag.id, tag.name)}
                      className="btn-gold min-h-[40px] w-full rounded text-[11px] font-bold"
                    >
                      EQUIP NAMETAG
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ===================== THE HALL OF FAME ===================== */}
      <section className="mb-10 rounded-2xl border-2 border-[#c9a227]/50 bg-gradient-to-br from-[#120f04] via-[#1a1406] to-black p-6 shadow-xl sm:p-7">
        <div className="mb-5 flex items-center justify-between border-b border-[#c9a227]/20 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏛️</span>
            <div>
              <p className="text-[10px] tracking-[0.3em] text-[#8a7a4d]">PERMANENT ENROLLMENT</p>
              <h2 className="font-display gold-text text-2xl font-black tracking-wide">THE HALL OF FAME</h2>
            </div>
          </div>
          <span className="rounded-full border border-[#c9a227]/40 px-3 py-1 text-[10px] font-bold text-[#f6e27a]">
            {members.length} Member{members.length !== 1 ? 's' : ''} Inducted
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, idx) => {
            const isMe = m.name.toLowerCase() === playerName.toLowerCase()
            const dateStr = new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

            return (
              <div
                key={m.name}
                className={`flex items-center gap-3.5 rounded-xl p-3.5 ${
                  isMe
                    ? 'border-2 border-[#fde047] bg-[#2a1e05]/90 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                    : 'border border-[#c9a227]/25 bg-black/40'
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f59e0b] to-[#b45309] font-display text-base font-black text-[#140b02] shadow-md">
                  #{idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-[14px] text-[#f2e6c9] truncate">{m.name}</span>
                    {isMe && <span className="rounded bg-[#ef4444]/20 px-1 text-[9px] font-black text-[#ef4444]">YOU</span>}
                  </div>
                  <div className="text-[10px] font-semibold text-[#f59e0b]">{m.title}</div>
                  <div className="text-[9px] text-[#6b5f42]">Inducted {dateStr}</div>
                </div>
                <Crown size={16} className="text-[#fde047] shrink-0" />
              </div>
            )
          })}
        </div>
      </section>

      {/* ===================== PLAYER BACKUP & RESTORE ===================== */}
      <section className="panel-noir rounded-2xl p-6 border border-[#c9a227]/25">
        <div className="mb-4">
          <p className="text-[9px] tracking-[0.3em] text-[#8a7a4d]">VAULT ARCHIVES</p>
          <h2 className="font-display gold-text text-xl font-bold tracking-wide">PLAYER SAVE &amp; BACKUP</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportNow} className="btn-gold min-h-[42px] rounded px-5 text-[10px] font-bold">
            EXPORT SAVE CODE
          </button>
        </div>
        {showExport && (
          <textarea readOnly value={exportCode} rows={4} className="mt-3 w-full rounded border border-[#c9a227]/30 bg-black/60 p-3 font-mono text-[10px] text-[#cbb98a]" />
        )}
        <div className="mt-4">
          <label htmlFor="import-code" className="text-[10px] tracking-[0.2em] text-[#b3a06b]">IMPORT SAVE CODE</label>
          <textarea id="import-code" value={importCode} onChange={(e) => setImportCode(e.target.value)} rows={3} placeholder="Paste your backup code here…" className="mt-1.5 w-full rounded border border-[#c9a227]/30 bg-black/50 p-3 font-mono text-[10px] text-[#cbb98a] outline-none focus:border-[#f6e27a]" />
          <button onClick={importNow} disabled={!importCode.trim()} className="btn-gold mt-2 min-h-[42px] w-full rounded px-5 text-[10px] font-bold">
            IMPORT SAVE
          </button>
        </div>
      </section>
    </div>
  )
}
