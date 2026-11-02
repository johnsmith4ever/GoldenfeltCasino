# Golden Felt Casino 🎰

An educational, play-money-only casino simulation.

> **Disclaimer:** Golden Felt Casino is designed purely for educational and entertainment purposes using simulated play-money. It has **no real-money transactions, deposits, withdrawals, or cash prizes**.

## 🃏 Features & Games
- **Table Games:** European Roulette, Classic Blackjack, Baccarat, Craps, Casino War, Sic Bo
- **Card & Number Games:** Video Poker, High-Low, Keno
- **Classic Slots:** Multi-line reel slot machine simulation
- **Casino Shop & Perks:** Play-money chips, lucky charms, custom felt themes
- **Full Client-side State:** Balance, player statistics, and round history stored locally

## 🚀 Deployment (Vercel)
This project is configured for seamless deployment on [Vercel](https://vercel.com):
- **Framework Preset:** `Other` (or auto-detected)
- **Build Command:** `npm run build` (runs zero-dependency `node build.js`)
- **Output Directory:** `dist` (or `.` root)
- **SPA Routing:** Configured via `vercel.json` rewrites to support direct route navigation

## 💻 Local Development
```bash
# Build the production output
npm run build

# Preview locally
python3 -m http.server 8000
```
