# Settle — spec

## Problem

Mental clutter lives in Notes, texts, head, and random apps. Organizing it takes more energy than dumping it — so it never gets organized.

## Product promise

One dump box. Automatic filing. A daily brief that tells you what’s next.

## Core verbs

1. **Dump** — text or voice, zero structure
2. **Settle** — split, classify, assign
3. **Done / Later** — clear the loop

## Screens

### 1. Capture (home)

- Brand: **Settle** (hero)
- One sentence: dump anything; filing is automatic
- Large textarea + Settle CTA + optional Speak
- Session line (“Morning settle”)

### 2. Today (brief)

Auto-grouped open loops plus a ranked Next 3.

### 3. All / Ask

Filter, search, recategorize. Ask searches past dumps.

## Data model

Stored in `localStorage` key `settle.v2` (migrates from `unload.v1` / `unload.v2`).

## Platforms

- **PC:** browser
- **iOS:** Safari → Add to Home Screen (PWA)
