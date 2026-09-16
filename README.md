# my-unn-quiz-app 🎓

UNN computer-based testing and quiz competition portal — timed CBT exam engine,
per-course question banks (PDF/Word upload), gamified Practice Arena, focus-music
stations, live Firebase sync, and an admin control center.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/VICTORIOUS-TECH-001/my-unn-quiz-app)

## Run locally

```bash
npm install
cp .env.example .env   # then fill in your Firebase web-app keys
npm run dev
```

## Host on Netlify (free)

**Option A — one click:** press **Deploy to Netlify** above, connect GitHub, and deploy.
`netlify.toml` already sets build command (`npm run build`), publish dir (`dist`),
and the SPA `/* → /index.html` redirect.

**Option B — dashboard:**

1. [Netlify](https://app.netlify.com) → **Add new site → Import an existing project** →
   pick this repo.
2. Build command: `npm run build` · Publish directory: `dist` (auto-detected).
3. **Site settings → Environment variables** → add the Firebase keys from
   `.env.example` (`VITE_FIREBASE_*`), then **Trigger deploy**.

Every `git push` to the connected branch redeploys automatically.

## Firebase setup

1. Create a project at [Firebase Console](https://console.firebase.google.com),
   add a **Web app**, copy its config into `.env` / Netlify env vars.
2. **Firestore Database → Create database** (production mode is fine).
3. Deploy the open-access rules from this repo:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # select your project
firebase deploy --only firestore:rules
```

## Admin access 🔐

The admin portal is locked with a PIN verified against Firebase
(document `config/admin`, field `pin`).

- **Default PIN: `0420`** (seeded into Firebase on first unlock)
- Change it anytime: Admin header → **Change PIN**, or edit `config/admin`
  in the Firebase console.

## Features

- 📚 Per-course question banks — upload hundreds of questions via PDF/Word/TXT
- 🎲 Every practice/exam pulls a fresh random set (default 70, shuffled options)
- 🎮 Practice Arena with XP, streaks, instant feedback, explanations & review
- 🎧 4 focus-music stations (generative, offline-friendly) with picker + volume
- ☁️ Real-time Firebase sync for concurrent students on many devices
- 📄 Official class-list importer (PDF → roster, every user gets a dashboard)
- ✨ Animated gaming theme (ambient background, glass HUD, confetti, tickers)
