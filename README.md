# Settle

Dump mental clutter. **Settle** auto-files it into Do / People / Think / Worry / Later / Note, assigns dates and people, then gives you a **next 3**. Visual language matches [Barrows Lawn Co.](https://barrows-lawn-co.vercel.app) — forest, cream, gold, teal.

**Live:** open your Vercel URL (e.g. after importing [Kay37/Settle](https://github.com/Kay37/Settle)) → Safari → **Add to Home Screen**.

## Why this exists

Notes apps make *you* organize. Settle flips that: one messy dump box (text or voice), automatic filing, and a “what matters today” view.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run test      # classifier + feature tests
npm run icons     # regenerate PWA PNG icons from pine mark
npm run build
```

## Deploy on Vercel

1. Import [Kay37/Settle](https://github.com/Kay37/Settle) at [vercel.com/new](https://vercel.com/new).
2. Framework: **Vite**. Root: `.`
3. Deploy → stable URL. iPhone: Safari → **Share → Add to Home Screen**.

Optional: add **`OPENAI_API_KEY`** in Vercel project settings, then enable **Use smart filing** and tap **Use built-in /api/file** in Settings.

Data stays in the browser (`localStorage`). The Vercel URL is just the app shell.

## How to use

1. Dump anything — one line or a messy paragraph.
2. Hit **Settle** (or ⌘/Ctrl + Enter). Preview chips show filing before you commit.
3. Check **Today** for next 3, people radar, and brief sections.
4. Mark **Done**, snooze, **Edit**, or fix a category.
5. Miss-tap? Hit **Undo** on the toast.

**Sync phone ↔ PC:** Settings → copy sync code on one device, paste on the other.

## iOS Shortcuts

```
https://YOUR-HOST/?dump=YOUR_TEXT&unload=1
```

(`unload=1` = auto-submit.) Footer **Shortcuts** copies a sample for your current host.

## Built-in filing API

`POST /api/file` with `{ "chunks": string[] }` → `{ "items": [...] }`.

Uses local rules by default. With `OPENAI_API_KEY` on Vercel, uses GPT-4o-mini and falls back to rules if the call fails.

## Privacy

Everything stays on-device in `localStorage`. Use **Export** / **Import** or sync codes for backups. No account required.

## Stack

Vite + React + TypeScript + PWA. Local-first.
