# Graph Report - .  (2026-07-10)

## Corpus Check
- 89 files · ~113,957 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 690 nodes · 1482 edges · 35 communities (29 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.78)
- Token cost: 109,883 input · 0 output

## Community Hubs (Navigation)
- App Shell & Modals
- Ear Transcription & Presets
- Artist/Song Browser
- Timing Timeline & Tracks
- Melody Sequence & Piano Roll
- NPM Dependencies
- Tab Transposer & Tunings
- Cifra Grid & Chord Text
- Audio Engine & Voices
- Assisted Mode Recording
- BPM Analysis Pipeline
- Line Link Wizard
- Timing Editor Player
- TS App Config
- TS Node Config
- Auto-Scroll & Overlays
- BPM Seeder Worker
- Timing API Client
- Interactive Piano & Theory
- App Entry & Feature Set
- Loop Salto Wizard
- Timing Selection State
- Social Icon Sprite
- YouTube Player API
- Hero Illustration Design
- Chord Finder
- Line Link Pass State
- SongBPM Scraper
- Brand Identity & Favicon
- TS Root Config

## God Nodes (most connected - your core abstractions)
1. `CifraViewer()` - 34 edges
2. `TimingEditor()` - 27 edges
3. `noteNameToPitchClass()` - 19 edges
4. `PlayerState` - 19 edges
5. `App()` - 18 edges
6. `Tuning` - 18 edges
7. `formatSeconds()` - 17 edges
8. `compilerOptions` - 17 edges
9. `midiToNoteName()` - 16 edges
10. `AssistedModeState` - 16 edges

## Surprising Connections (you probably didn't know these)
- `/src/main.tsx (module entry)` --conceptually_related_to--> `Viola Libre`  [INFERRED]
  index.html → README.md
- `App()` --references--> `react`  [EXTRACTED]
  src/App.tsx → package.json
- `InteractiveFretboard()` --references--> `react`  [EXTRACTED]
  src/components/InteractiveFretboard.tsx → package.json
- `Site Favicon (violet arrow glyph)` --conceptually_related_to--> `Vite Logo`  [INFERRED]
  public/favicon.svg → src/assets/vite.svg
- `PlaybackProvider()` --references--> `react`  [EXTRACTED]
  src/components/MelodySequenceEditor/PlaybackContext.tsx → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Cascata de Fontes de BPM** — bpm_seeder_prompt_deezer, bpm_seeder_prompt_acousticbrainz, bpm_seeder_prompt_getsongbpm, bpm_seeder_prompt_audio_fallback [EXTRACTED 1.00]
- **Contrato da API Interna de BPM** — bpm_seeder_prompt_claim_endpoint, bpm_seeder_prompt_submit_endpoint, bpm_seeder_prompt_status_endpoint [EXTRACTED 1.00]

## Communities (35 total, 6 thin omitted)

### Community 0 - "App Shell & Modals"
Cohesion: 0.05
Nodes (73): App(), FavoriteVoicing, ChordEditorModal(), EditorLoginModal(), EditorLoginModalProps, FretboardDiagram(), FretboardDiagramProps, IconCopy() (+65 more)

### Community 1 - "Ear Transcription & Presets"
Cohesion: 0.07
Nodes (58): ChordEditorModalProps, anunciacaoPresetData, createDefaultMelody(), EarTranscription(), EarTranscriptionProps, getMajorHarmonizedField(), getMinorHarmonizedField(), KeyConfig (+50 more)

### Community 2 - "Artist/Song Browser"
Cohesion: 0.06
Nodes (43): InfiniteLoader(), Props, ArtistSongFilterResult, ArtistSongTab, normalizeAccents(), useArtistSongFilter(), ArtistList(), bufferKey() (+35 more)

### Community 3 - "Timing Timeline & Tracks"
Cohesion: 0.05
Nodes (46): CifraGridEditorProps, InlineMarkerDot(), InlineMarkerDotProps, MARKER_DOT_SYMBOL, DragState, MarkerMetaEntry, ModifyPopupState, TimingTimeline() (+38 more)

### Community 4 - "Melody Sequence & Piano Roll"
Cohesion: 0.11
Nodes (32): react, PauseIcon(), PlayIcon(), RedoIcon(), RestartIcon(), RobotIcon(), StarIcon(), UndoIcon() (+24 more)

### Community 5 - "NPM Dependencies"
Cohesion: 0.05
Nodes (36): dependencies, axios, fuse.js, lucide-react, react-dom, react-router-dom, soundfont-player, tailwindcss (+28 more)

### Community 6 - "Tab Transposer & Tunings"
Cohesion: 0.12
Nodes (26): Props, TabTransposerBlock(), ContentSegment, detectRawTabBlocks(), detectSourceTuning(), findBestPosition(), getTuningLabelsHighToLow(), getTuningMidiHighToLow() (+18 more)

### Community 7 - "Cifra Grid & Chord Text"
Cohesion: 0.15
Nodes (18): Block, CifraGridEditor(), dotOpacity(), parseBlocks(), getRegionColor(), buildChordLineText(), buildReflowedPair(), ChordPos (+10 more)

### Community 8 - "Audio Engine & Voices"
Cohesion: 0.10
Nodes (6): AudioEngine, InstrumentVoice, OscillatorVoice, PluckedStringVoice, SoundFontVoice, VOICE_REGISTRY

### Community 9 - "Assisted Mode Recording"
Cohesion: 0.14
Nodes (6): AssistedModeOverlay(), SectionType, AssistedModeState, DupWarning, PT_LABELS, useAssistedModeStore

### Community 10 - "BPM Analysis Pipeline"
Cohesion: 0.13
Nodes (19): AcousticBrainz via MusicBrainz, Fallback de Análise de Áudio, BPM Internal REST API, POST /api/internal/bpm/claim, Deezer (fonte primária), Captura de Duração (Deezer confiável), Essentia RhythmExtractor2013, GetSongBPM (opcional) (+11 more)

### Community 11 - "Line Link Wizard"
Cohesion: 0.19
Nodes (14): LineLinkWizardOverlay(), EditorMode, getAutoLabel(), LINK_TARGET_TYPE, MARKER_META, parseTimeString(), NOTE: with segno/coda/to_coda/d_c_*/d_s_* removed from the manual creation grid, SECTION_ORDER (+6 more)

### Community 12 - "Timing Editor Player"
Cohesion: 0.16
Nodes (3): TimingEditor(), MediaType, PlayerState

### Community 13 - "TS App Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 14 - "TS Node Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 15 - "Auto-Scroll & Overlays"
Cohesion: 0.24
Nodes (10): CHIP_COLORS, NEXT_SECTION_CHIPS, RecordingBar(), AutoScrollPreview(), AutoScrollResult, useAutoScroll(), formatSeconds(), useCifraTextStore (+2 more)

### Community 16 - "BPM Seeder Worker"
Cohesion: 0.33
Nodes (10): calculate_confidence(), claim_batch(), get_acousticbrainz_data(), get_audio_data(), get_deezer_data(), get_songbpm_scraped_data(), main(), normalize_string() (+2 more)

### Community 17 - "Timing API Client"
Cohesion: 0.18
Nodes (11): cleanYouTubeUrl(), detectMediaType(), extractYouTubeId(), fetchTimings(), getOrCreateEditorHash(), submitTiming(), TimingInstrumental, TimingLoop (+3 more)

### Community 18 - "Interactive Piano & Theory"
Cohesion: 0.25
Nodes (9): CHROMATIC_BLACK_NOTES, CHROMATIC_WHITE_NOTES, ChromaticPiano(), NATURAL_NOTES, NaturalPiano(), Note, playNoteSound(), Lesson (+1 more)

### Community 19 - "App Entry & Feature Set"
Cohesion: 0.22
Nodes (9): /src/main.tsx (module entry), index.html Root Mount, Escalas Duetadas em Viola Caipira, Favoritos, Localizador de Acordes, Slash Chords (baixos em notas específicas), Tirando de Ouvido, Treinos e Teoria (+1 more)

### Community 22 - "Social Icon Sprite"
Cohesion: 0.38
Nodes (7): Icon Sprite Sheet, Bluesky Icon, Discord Icon, Documentation Icon, GitHub Icon, Social Icon, X (Twitter) Icon

### Community 24 - "Hero Illustration Design"
Cohesion: 0.60
Nodes (5): Base Card with Violet Gradient Side, Hero Illustration (Stacked Isometric Cards), Minimalist Isometric 3D Design, Floating Top Card (Outline), Violet/Purple Gradient Accent

### Community 25 - "Chord Finder"
Cohesion: 0.60
Nodes (4): ChordFinder(), ChordFinderProps, getSuffixFromBuilder(), parseSuffix()

### Community 28 - "Brand Identity & Favicon"
Cohesion: 1.00
Nodes (3): Flat Acoustic Guitar Illustration, Viola Libre Brand Identity, Viola Libre Favicon (Acoustic Guitar Icon)

## Knowledge Gaps
- **157 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Melody Sequence & Piano Roll` to `App Shell & Modals`, `Ear Transcription & Presets`, `NPM Dependencies`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `dependencies` connect `NPM Dependencies` to `Melody Sequence & Piano Roll`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `App()` connect `App Shell & Modals` to `Ear Transcription & Presets`, `Melody Sequence & Piano Roll`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _160 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Modals` be split into smaller, more focused modules?**
  _Cohesion score 0.05112347969490827 - nodes in this community are weakly interconnected._
- **Should `Ear Transcription & Presets` be split into smaller, more focused modules?**
  _Cohesion score 0.06584723441615452 - nodes in this community are weakly interconnected._
- **Should `Artist/Song Browser` be split into smaller, more focused modules?**
  _Cohesion score 0.05853174603174603 - nodes in this community are weakly interconnected._