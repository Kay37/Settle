# Settle

Dump mental clutter. **Settle** auto-files it into Do / People / Think / Worry / Later / Note, assigns dates and people, then gives you a **next 3**. Visual language matches [Barrows Lawn Co.](https://barrows-lawn-co.vercel.app) — forest, cream, gold, teal.

## Why this exists

Notes apps make *you* organize. Settle flips that: one messy dump box (text or voice), automatic filing, and a “what matters today” view.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Deploy on Vercel (permanent URL)

This is a static Vite app — same hosting as [barrows-lawn-co.vercel.app](https://barrows-lawn-co.vercel.app).

### Fastest: Vercel dashboard

1. This repo is [Kay37/Settle](https://github.com/Kay37/Settle).
2. [vercel.com/new](https://vercel.com/new) → Import that repo.
3. Framework: **Vite**. Root directory: `.`
4. Deploy. You’ll get a stable URL like `settle.vercel.app`.
5. On iPhone Safari: open it → **Share → Add to Home Screen**.

### Or CLI

```bash
npx vercel --prod
```

Data stays in your browser (`localStorage`). The Vercel URL is just the app shell — nothing is stored on the server.

### On iPhone

1. Open the Vercel URL in Safari.
2. **Share → Add to Home Screen**.
3. It opens like an app. Data stays in the browser (localStorage).

Voice capture uses the Web Speech API (works best in Chrome/Edge; Safari support varies).

## How to use

1. Dump anything — one line or a messy paragraph.
2. Hit **Settle** (or ⌘/Ctrl + Enter).
3. Check **Today** for the brief (urgent items float up).
4. Mark **Done**, push to **Later**, **Edit**, or fix a category.
5. Miss-tap? Hit **Undo** on the toast.

Newlines become separate thoughts. Long blobs get split on sentences.

## iOS Shortcuts

Open URLs like:

```
https://YOUR-HOST/?dump=YOUR_TEXT&unload=1
```

(`unload=1` still works as the auto-submit flag.)

In Shortcuts: Ask for Input / Dictate Text → Open URLs with that text in `dump`. Use **Shortcuts** in the footer to copy a sample.

## Optional smart filing

Browsers can’t call OpenAI directly (CORS). If you want LLM filing later, point Settings at your own tiny endpoint:

`POST { "chunks": string[] }` → `{ "items": [{ "index", "title", "category" }] }`

Until then, the on-device classifier is what powers Settle.

## Privacy

Everything stays on-device in `localStorage`. Use **Export** / **Import** for backups. No account required.

## Stack

Vite + React + TypeScript + PWA manifest. Local-first.
