# Settle — handoff

Continue from here at home. This is the personal dump-box app (formerly Unload).

**GitHub (intended):** [https://github.com/Kay37/Settle](https://github.com/Kay37/Settle)  
**Design reference:** [https://barrows-lawn-co.vercel.app](https://barrows-lawn-co.vercel.app)

If the GitHub repo is still empty, copy the `unload/` folder from this Cursor cloud agent into a local clone of `Kay37/Settle` (app files belong at the **repo root**, not nested under `unload/`).

---

## What it is

One messy dump box. You type or speak. **Settle** splits thoughts, files them (Do / People / Think / Worry / Later / Note), assigns dates and people when it can, and shows a **Next 3** on Today.

You do not organize folders. Core verbs: **Dump → Settle → Done**.

Data is **local-only** (`localStorage`). No account. Vercel (or any static host) is just the app shell.

---

## Start at home

```bash
git clone https://github.com/Kay37/Settle.git
cd Settle
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`).

```bash
npm run test:classify   # classifier / date / people tests
npm run build           # production build → dist/
```

**iPhone:** deploy (below) or use a tunnel; Safari → Share → **Add to Home Screen**.

---

## Put it on Vercel (permanent URL)

Same hosting as Barrows Lawn Co.

1. Repo: `Kay37/Settle` (root = this Vite app).
2. [vercel.com/new](https://vercel.com/new) → Import the repo.
3. Framework: **Vite**. Root directory: `.`
4. Deploy → you get `settle.vercel.app` (or a project name you choose).
5. iPhone Safari: open that URL → Add to Home Screen.

CLI from the project folder:

```bash
npx vercel --prod
```

Nothing user-generated is stored on Vercel.

---

## Product map

| Screen | What it does |
|---|---|
| Dump box | Text / Speak → gold **Settle** button (⌘/Ctrl+Enter) |
| Today | Ranked Next 3, last 24h, waiting, Do / People / Worries / Think |
| All | Search (Ask), Dated / Waiting filters, categories, edit, snooze |
| Settings | Filing, preferred snooze, Shortcuts, sync (collapsed), What Settle knows |

**Snooze:** Tonight / Tomorrow on a thought (hides from Today until then).  
**Undo:** toast after a settle.  
**Learn:** if you recategorize, phrases are remembered locally.

### Shortcuts (iOS)

```
https://YOUR-HOST/?dump=YOUR_TEXT&unload=1
```

`unload=1` still means auto-submit (legacy flag). Footer **Shortcuts** copies a sample.

---

## Code map

All app code is in this folder (repo root once pushed):

```
src/App.tsx                 UI
src/index.css               Lawn-co palette + type
src/types.ts                Thought, categories
src/lib/classify.ts         Split dump + category rules
src/lib/assign.ts           Due dates, people, next action, snooze
src/lib/learn.ts            Learn from recategorize
src/lib/fileThoughts.ts     Local file + optional HTTP endpoint
src/lib/storage.ts          localStorage settle.v2
src/lib/settings.ts         Settings
src/lib/speech.ts           Web Speech API
src/lib/preview.ts          Live filing preview while typing
src/lib/peopleRadar.ts      People loops grouped by person
src/lib/syncCode.ts         Base64 sync code for phone ↔ PC
src/lib/classify.selftest.ts
src/lib/features.selftest.ts
public/pine-mark.svg        Same pine as lawn-co
public/apple-touch-icon.png iOS home screen (180)
public/icon-192.png         PWA icon
public/icon-512.png         PWA icon
api/file.ts                 Vercel filing endpoint (optional OpenAI)
scripts/generate-icons.mjs  Regenerate PNG icons
vercel.json                 Vite on Vercel
```

### Storage (don't break this)

| Key | Purpose |
|---|---|
| `settle.v2` | Thoughts + learned rules |
| `settle.settings.v1` | Settings |
| `unload.v1` / `unload.v2` / `unload.settings.v1` | Read on load, then migrated |

### Design tokens (from lawn-co)

- Forest `#1b3d2f` / charcoal `#163328`
- Cream `#f7f3ea` / sand `#e7e0d2`
- Gold `#d4a24c` (primary button)
- Teal `#2f6f6a`
- Fonts: **Bebas Neue** (SETTLE), **Instrument Serif** (headings), **DM Sans** (UI)

---

## What's already built

- Dump box + Speak
- Auto split / classify / assign (dates, people)
- Next 3 + Today brief
- Snooze, edit, undo, search, Ask
- PWA manifest (Add to Home Screen)
- Export / import JSON backup
- Lawn-co visual language + pine mark
- Relabel: product + gold button = **Settle** (loading: Settling…)

## Good next work

1. ~~**Vercel URL**~~ — connected; pushes to `main` auto-deploy.
2. ~~**Sync merge**~~ — default merge; optional replace-all toggle.
3. ~~**Stale sweep**~~ — Today shows items open &gt; 1 week.
4. ~~**People radar actions**~~ — Draft / Copy on each person loop.
5. ~~**Secure /api/file**~~ — `FILING_SECRET` + rate limit.
6. ~~**/shortcuts page**~~ — QR + step-by-step iOS setup.
7. ~~**Brain sweep**~~ — Today → quick review queue.
8. ~~**Project hints**~~ — keyword clusters + soft tag.
9. ~~**Semantic Ask**~~ — `/api/ask` when smart filing on.
10. ~~**Richer dates**~~ — this weekend, in 2 weeks, before visit.
11. ~~**Gentle insights**~~ — local nudges on Today brief.
12. ~~**Web Share**~~ — share next 3 / thoughts via iOS share sheet.
13. ~~**Mind-changed re-file**~~ — prompt when an edit shifts category.
14. ~~**iOS widget**~~ — compact `/widget` Next 3 page + Shortcuts pin steps.
15. ~~**Share into Settle**~~ — Web Share Target + iOS Share shortcut.
16. ~~**Due reminders + calendar**~~ — optional local notifications; .ics on dated thoughts.
17. ~~**Echo merge / keep both**~~, confidence chips, mention counts.
18. ~~**Mind-changed supersedes**~~, private thoughts, never-resurface, people memory.
19. ~~**Recently captured, possible steps, ··· overflow, worry styling, haptic**~~
20. ~~**Merge All + Ask, preferred snooze, mind-changed supersede, month dates**~~
21. **Custom domain** on Vercel (optional).

---

## Known limits

- This Cursor cloud session has **no GitHub login**. If `Kay37/Settle` is empty, push from home:

  ```bash
  # from the Settle app folder
  git init
  git add .
  git commit -m "Settle dump box app"
  git branch -M main
  git remote add origin https://github.com/Kay37/Settle.git
  git push -u origin main
  ```

- Temporary trycloudflare links **die**. Don't bookmark them.
- Voice is best in Chrome/Edge; Safari is spotty.
- Classifier is rules, not an LLM, unless you add a filing endpoint.

---

## How to continue in Cursor at home

1. Clone `Kay37/Settle` (or paste this folder into that repo root).
2. Open the folder in Cursor.
3. `npm install` → `npm run dev`.
4. Optional: connect the repo to Vercel so every push goes live.

That's the whole product so far: dump the mess, hit **Settle**, work the Next 3.
