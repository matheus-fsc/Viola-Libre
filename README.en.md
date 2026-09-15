# Viola Libre

**The Open, Mathematical Chord Book** for viola caipira, guitar, cavaquinho and other
string instruments.

[English](./README.en.md) · [Português](./README.md)

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)

Unlike rigid systems, Viola Libre **computes** chord shapes from intervals and semitone
equations. That is what makes it possible to switch tuning instantly (Cebolão Ré, Cebolão
Mi, Rio Abaixo and so on) or change the note of any single string and have everything
recalculated on the spot.

It is a **community-run, open source, non-profit** project: no ads, no monetization, no
paywall. The goal is to give students and masters of the instrument free, minimal access.

> **A note on vocabulary.** *Cifra* is the Brazilian chord-sheet format: lyrics with chord
> names written above them. This document calls it a **chord chart**. *Viola caipira* is a
> specific ten-string Brazilian instrument and keeps its name, as do its tunings.

---

## Features

- **Chord Dictionary** — slash chords, inversions and smart anatomical variations, ranked
  by how easy they are to play.
- **Explore Charts** — browse by artist and song, with the chord chart rendered on screen.
- **Practice and Theory** — scale practice (including duetted scales on the viola caipira)
  and interval visualization straight on the instrument neck.
- **Playing by Ear** — an interactive melody sequencer and a key detector to help you work
  songs out by ear.
- **Timing Editor** — sync a chord chart to audio or video (auto-scroll, loops, jumps).
- **Favorites and My Charts** — save favorite fingerings and build the chord sheet for a song.
- **Preferences** — instrument, language, chart display and third-party permissions in one
  place, kept in the browser only.

---

## Tech stack

- **[React 19](https://react.dev/)** + **TypeScript**
- **[Vite](https://vite.dev/)** — build and dev server
- **[Tailwind CSS 4](https://tailwindcss.com/)** — styling (classic Windows XP theme)
- **[React Router 7](https://reactrouter.com/)** — routing
- **[Zustand](https://zustand.docs.pmnd.rs/)** — global state
- **[Zod](https://zod.dev/)** — schema validation
- **[soundfont-player](https://github.com/danigb/soundfont-player)** — instrument audio
- **[Vitest](https://vitest.dev/)** — tests

---

## Architecture

The code separates the **music engine** (pure logic, no UI) from **presentation** (React
components). `App.tsx` is a single "window" that swaps its content per tab, based on the
current route.

```
src/
├── engine/       # PURE music engine (no React): chords, intervals, tunings, audio
├── i18n/         # Interface language: dictionaries, typed keys, language store
│   └── locales/  #   pt-BR.ts (source of truth) and en.ts
├── components/   # Reusable UI (neck, diagrams, selectors, timing editor…)
│   ├── timing/   #   Timing editor: timeline, tracks, assisted mode, wizards
│   └── MelodySequenceEditor/  # Piano roll and melody sequencer
├── pages/        # One folder per route (cifras, minhasCifras, preferencias, termos)
├── services/     # API client and data helpers
├── stores/       # Global state (Zustand): player, timing, wizards, chart text
├── hooks/        # Hooks (artist/song filter, auto-scroll, isMobile…)
├── utils/        # Helpers (preferences, line classification)
├── App.tsx       # Application shell (window + tab navigation)
└── main.tsx      # Entry point
```

### Module map (feature → where it lives)

| Feature                   | Main files |
| ------------------------- | ---------- |
| Chord and tuning engine   | `src/engine/chordCalculator.ts`, `intervals.ts`, `tunings.ts`, `types.ts` |
| Audio                     | `src/engine/AudioEngine.ts` (voice registry: oscillator, string, soundfont) |
| Chord Dictionary          | `src/components/ChordFinder.tsx`, `FretboardDiagram.tsx`, `InteractiveFretboard.tsx` |
| Explore Charts            | `src/pages/cifras/*` (`ArtistList`, `SongList`, `CifraViewer`, `CifrasApp`) |
| Timing Editor             | `src/components/TimingEditor.tsx`, `src/components/timing/*`, `src/stores/useTiming*` |
| Chart ↔ audio (grid)      | `src/components/timing/CifraGridEditor.tsx`, `src/services/cifraUtils.ts` |
| Playing by Ear            | `src/components/EarTranscription.tsx`, `src/components/MelodySequenceEditor/*` |
| Practice and Theory       | `src/components/ScaleTrainer.tsx`, `ViolaDuets.tsx`, `TheoryGuide.tsx`, `InteractivePiano.tsx` |
| Tab transposition         | `src/engine/tabTransposer.ts`, `src/components/TabTransposerBlock.tsx` |
| Interface language        | `src/i18n/*`, `src/components/SeletorDeIdioma.tsx` |
| Preferences               | `src/pages/preferencias/Preferencias.tsx` (gathers the selectors that already existed) |
| API / data                | `src/services/api.ts`, `authApi.ts`, `timingApi.ts` |

### Core abstractions (start here)

These are the most connected nodes in the codebase, and understanding them unlocks the rest:

- **`Tuning`** (`src/engine/types.ts`) — the tuning (the notes of the strings). Everything
  in the engine revolves around it.
- **`chordCalculator.ts`** — generates the voicings (shapes) of a chord for a given tuning.
- **`noteNameToPitchClass()` / `midiToNoteName()`** (`src/engine/`) — note ↔ number
  conversion, the basis of nearly everything.
- **`App()`** (`src/App.tsx`) — the shell; understand how tabs and routes are resolved.
- **`CifraViewer()`** (`src/pages/cifras/CifraViewer.tsx`) — the chart rendering hub (the
  most connected component in the project).
- **`TimingEditor()`** + **`PlayerState`** — the sync editor and its playback state.

> 🗺️ **Navigable code map:** the [`graphify-out/`](./graphify-out) directory holds a
> knowledge graph of the project. Read
> [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) for a high-level view of
> modules, dependencies and god nodes. Autonomous agents should read
> [`AGENTS.md`](./AGENTS.md).

---

## Running locally

### Requirements

- **Node.js 20+** and npm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# edit .env with the API URL and key (see below)

# 3. Start the dev server
npm run dev
```

The app comes up at `http://localhost:5173`.

### Environment variables

| Variable             | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `VITE_API_BASE_URL`  | Base URL of the API (charts, artists, statistics).          |
| `VITE_API_KEY`       | Key for the protected routes (view counts, favorites POST). |

### Scripts

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Dev server with hot reload.                      |
| `npm run build`   | Type-check (`tsc -b`), production build and license labels. |
| `npm run preview` | Serves the production build locally.             |
| `npm run test`    | Runs the test suite (Vitest).                    |
| `npm run lint`    | Checks the code with ESLint.                     |
| `npm run librejs:verify` | Checks that the build satisfies GNU LibreJS. |
| `npm run sitemap` | Regenerates `public/sitemap.xml` from the collection (hits the API). |
| `npm run sitemap:verify` | Checks the sitemap against `robots.txt` and the protocol limits. |

---

## Interface language (i18n)

The interface speaks **Portuguese (pt-BR)** and **English**. The chord chart collection
itself is not translated: song titles, artist names, lyrics and chord names belong to the
source, and translating them would be inventing data that does not exist. What changes is
the frame around the content.

### How it works

- `src/i18n/locales/pt-BR.ts` is the **source of truth**. The `Dicionario` type is derived
  from it, so `en.ts` is checked against it: a missing or misspelled key fails `tsc -b`.
  There is no silent fallback, and therefore no way to ship a half-translated screen
  without noticing.
- `src/i18n/index.ts` holds the language store and the `t()` function. Inside a component
  use `useT()`, which re-renders on a language change; outside one (helpers, metadata), the
  standalone `t` reads the current language without subscribing.
- `useIdioma()` returns the active language. The choice is kept in `localStorage`, and only
  the first visit falls back to the browser's `navigator.language`.
- The selector lives in `src/components/SeletorDeIdioma.tsx`, rendered inside the About
  dialog, which is the one door that exists at every screen width.
- Switching the language also updates `<html lang>` and the `og:locale` meta tag.

No i18n library is used, on purpose. Every dependency that reaches the browser needs a
license label for GNU LibreJS (see below), and what this site needs from i18n is a table
lookup plus `{variable}` substitution. The typed `Chave` union already provides what a
library would really buy here: a compile error when a key does not exist.

### Adding a string

1. Add the key to `src/i18n/locales/pt-BR.ts`, in the namespace that matches the screen.
2. Run `npx tsc -b`. It will fail, naming the key missing from `en.ts`.
3. Add the English text and use it with `t('namespace.key')`.

### Writing rules

- **No em dashes.** Interface text is read on narrow screens and by screen readers, where
  an em dash becomes a long pause with no function. Use a comma, a colon or a full stop.
  When translating an existing Portuguese string, strip the em dash from the Portuguese
  side too, as part of the same change.
- **Interpolate, do not concatenate.** `t('key', { count: n })` with `{count}` inside the
  text, never `t('a') + n + t('b')`: word order differs between languages.
- **Keys describe the place, not the text.** `filtros.casaMinima`, not `casaInicialMinima`.

### Coverage

The whole interface goes through the dictionary: tabs and window chrome, the desktop home,
the chart explorer, the chart viewer, the chord dictionary, practice and theory, playing by
ear, the timing editor, favorites, the print sheet, preferences and the three documents
(terms, privacy, acknowledgements).

What stays out, on purpose:

- **The lyrics and the body of a chart.** They belong to the source, not to the reader.
- **Proper names.** Artists, songs, companies, projects, and the viola tunings
  ("Cebolão", "Rio Abaixo").
- **Musical data.** Note names, degrees, chord symbols and the C major scale table on
  Cebolão: they are the same in any language.
- **Identifiers the engine returns.** `'Fácil' | 'Média' | 'Difícil'` is a type, and the
  regression suite compares against it; translation happens at the boundary, in
  `src/i18n/musica.ts`.

### The engine does not write sentences

`src/engine/detectKey.ts` analyses a chart and has things to say about it ("ii of a ii-V to
vi", "V→I cadence played"). It returns those as a **descriptor**, not as text: an `id` for
what happened, plus the values that go into the sentence. The sentence is written by
`src/i18n/musica.ts`, in the language of the screen.

The gain is not only translation. A test asserting `detalhe.id === 'subV'` asserts the
musical behaviour; one asserting the whole sentence broke when somebody moved a comma, and
stayed silent when the rule changed and the sentence happened to stay the same. Mode names
("jônio", "mixolídio") stay in Portuguese inside the engine because there they are
identifiers, and `musica.ts` maps them to Ionian and Mixolydian at render time.

The translated legal documents carry, in the English version only, a note that the
Portuguese text prevails in case of any divergence.

To check that nothing slipped through, `src/i18n/i18n.test.ts` covers key parity,
interpolation variables, absence of em dashes, and forgotten translations (identical text
in both languages, with an exception list that says why each entry is there).

---

## Free software end to end (GNU LibreJS)

It is not enough for the repository to be free: the JavaScript that reaches the visitor's
browser has to be free as well, and it has to *prove* it in a way a machine can read. That
is what [GNU LibreJS](https://www.gnu.org/software/librejs/) requires, and without that
proof it blocks the bundle and the site goes blank for anyone using the extension.

The practical problem is that Vite emits a hashed filename on every build
(`assets/index-BvBM4xs7.js`), so no hand-written declaration survives the next deploy. That
is why the labels are **generated**, not maintained:

- `scripts/librejs-labels.mjs` runs at the end of `npm run build`. It stamps the
  `@license` / `@license-end` pair inside every emitted `.js`, packs the source matching the
  commit that produced that bundle with `git archive`, and writes `dist/jslicense.html` with
  the [Web Labels](https://www.gnu.org/licenses/javascript-labels.html) table.
- `index.html` carries `<a href="/jslicense.html" rel="jslicense">` **outside `#root`**. It
  has to be in the served HTML: LibreJS decides whether to release the bundle before React
  mounts, and a link rendered by the footer would arrive far too late.
- `scripts/librejs-verify.mjs` (`npm run librejs:verify`) redoes the check and fails CI if an
  unlabeled chunk, an inline `<script>` without a license, or a CDN library shows up.

Two product decisions follow from this:

- **YouTube.** The YouTube IFrame API is proprietary software, so the script is never
  injected on its own initiative. The player appears as an explicit invitation, and
  auto-scroll asks before measuring the song's duration in a hidden player. Declining breaks
  nothing: scrolling goes back to inferring time from the BPM. The answer is stored and can
  be changed from the Privacy Policy.
- **No analytics.** No statistics script runs in a visitor's browser. The metrics this
  project uses are server-side and do not depend on any JavaScript. The `script-src` in
  `public/_headers` is the complete list of what may execute here: adding a host means
  deciding to load third-party code, and its license has to be checked first.

To test: `npm run build && npm run preview`, then open the preview with the extension on.
`npm run dev` does **not** pass LibreJS, and it should not: the dev server serves unbundled
modules and injects the HMR client and React Refresh, which are code generated at runtime.
Compliance applies to what is published.

---

## Indexing and accessibility

The site is an SPA: one `index.html` and everything else mounted on the client. That creates
two problems that do not announce themselves, and both have already bitten this project.

**Per-route metadata.** `index.html` carries a title, a description and a
`<link rel="canonical">` as a fallback for anyone who does not run JavaScript. If that were
all, every route would declare itself a duplicate of the home page, which is exactly what
happened while the canonical was fixed. The fix is `useSeo` (`src/hooks/useSeo.ts`), which
**updates** the tags already in the `<head>` instead of appending new ones, guaranteeing one
of each. The fixed sections live in `src/utils/seoRoutes.ts` (paths there, text in the
dictionaries under `seo.*`); chart routes build theirs from the loaded song.

> When you add a route, call `useSeo` in it. Without that it inherits the previous route's
> metadata, and Google treats it as a copy.

**Sitemap.** `public/sitemap.xml` is generated (`npm run sitemap`), not hand-written: the
collection holds around 133 thousand artists and 490 thousand charts, and a manual list is
stale the next day. The selection is **curated**: fixed pages, featured artists per genre,
and the most viewed and most liked songs. Dumping half a million client-rendered URLs would
burn the crawl budget without indexing anything; the ceiling grows through an environment
variable (`SITEMAP_MAX_URLS`) as the site earns authority.

The generator does **not** run inside `npm run build`, on purpose: the API sits behind nginx
and fail2ban and drops bursts. At concurrency 8, 80% of the requests failed *silently*,
producing a short sitemap that looked healthy. It now makes one request at a time, with a
pause, and reports the failure rate at the end. What keeps the file fresh is the cron in
`.github/workflows/sitemap.yml`.

`npm run sitemap:verify` runs in CI and cross-checks the sitemap against `robots.txt`. That
check exists because of a bug that survived several deploys: `robots.txt` carried
`Disallow: /cifras` and kept the entire collection out of Google. Announcing a URL in the
sitemap while forbidding its crawl is a contradiction, and now it fails the build.

**Accessibility.** The Windows XP theme uses `select-none` and beveled borders, which
historically led to `focus:outline-none` scattered across some 40 places with nothing put in
its stead. The `:focus-visible` rule in `src/index.css` is the floor: it uses `!important`
deliberately, because the Tailwind utility has higher specificity and would win. Do not
remove it to "clean up" the CSS. It is the only thing giving a focus indicator to anyone
navigating by keyboard.

---

## Contributing

Contributions are welcome, from chord corrections to new features.

1. **Follow the graph.** Before hunting for files, read
   [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) to find the right module.
2. **Fork** and branch off `main` (`git checkout -b my-improvement`).
3. **Keep the visual language.** The UI follows the Windows XP theme with Tailwind classes
   and literal hex colors already used in the project. Follow the neighboring components
   rather than inventing a new style.
4. **Engine without UI.** Music logic goes in `src/engine/` (pure, testable); components
   only consume it.
5. **New interface text goes through the dictionary.** No hard-coded strings in components,
   and no em dashes. See the i18n section above.
6. **Before opening the PR**, make sure this passes:
   ```bash
   npm run lint && npm run test && npm run build && npm run librejs:verify && npm run sitemap:verify
   ```
7. **Open a Pull Request** describing the change. Every contribution is licensed under the
   AGPL-3.0.

Found a bug or have an idea? Open an issue on GitHub.

---

## Content and rights

The **source code** of this project is original work and licensed as open source (see
below). Part of the **text content** (lyrics and chord charts) may belong to third parties
or have been submitted by the community. Viola Libre claims no ownership over song lyrics.
Rights holders may request removal through the email address given on the
[Terms of Use](./src/pages/termos/TermosDeUso.tsx) page.

---

## License

Distributed under the **[GNU Affero General Public License v3.0](./LICENSE)** (AGPL-3.0).

That means any modified version, **including one hosted as a web service**, has to keep its
source open and available to its users.

```
Viola Libre, the open and mathematical chord book of Brazilian roots music
Copyright (C) 2026 Matheus Coelho

This program is free software: you can redistribute it and/or modify it
under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
General Public License for more details.
```
