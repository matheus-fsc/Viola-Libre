# Graph Report - .  (2026-08-01)

## Corpus Check
- 55 files · ~153,757 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 902 nodes · 1824 edges · 46 communities (43 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.82)
- Token cost: 84,993 input · 0 output

## Community Hubs (Navigation)
- Favoritos (Estante de Cifras)
- Explorador de Artistas/Musicas
- CifraViewer & Sequencias
- Editor de Melodia & Icones
- Motor de Audio & Vozes
- CI e Doutrina AGENTS.md
- Dependencias NPM
- Transpositor de Tablatura
- API e Regioes de Timing
- Editor de Timing
- Grid de Cifra & Texto
- App Shell & Diagramas
- Braco Interativo & Duetos
- Auth de Editor & Curadoria
- Video Fonte & YouTube API
- Overlays de Gravacao & Auto-Scroll
- chordCalculator (Motor de Acordes)
- TS Config App
- Modais de Onboarding
- TS Config Test
- Tirando de Ouvido & Presets
- TS Config Node
- Store de Modo Assistido
- Loop/Salto & Selecao
- Identidade de Marca (Medalhao)
- Tipos Musicais & Hover Card
- Timeline de Timing
- Wizard de Line Link
- Piano Interativo & Teoria
- Trilhas de Timing
- Teste de Regressao de Curadoria
- Navegacao por Abas
- Saltos Derivados
- Sprite de Icones Sociais
- Ilustracao Hero
- Chord Finder
- Licenca AGPL & Comunidade
- TS Config Root
- Treinos e Teoria

## God Nodes (most connected - your core abstractions)
1. `CifraViewer()` - 39 edges
2. `Tuning` - 24 edges
3. `TimingEditor()` - 23 edges
4. `FavoritosDashboard()` - 19 edges
5. `PlayerState` - 19 edges
6. `noteNameToPitchClass()` - 17 edges
7. `formatSeconds()` - 17 edges
8. `compilerOptions` - 17 edges
9. `compilerOptions` - 17 edges
10. `AssistedModeState` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Portao de qualidade: lint && test && build` --semantically_similar_to--> `Job CI "verificacoes" (Lint, build e testes)`  [INFERRED] [semantically similar]
  AGENTS.md → .github/workflows/ci.yml
- `Guia de contribuicao (fork, branch, padrao, checagens, PR)` --semantically_similar_to--> `Job CI "verificacoes" (Lint, build e testes)`  [INFERRED] [semantically similar]
  README.md → .github/workflows/ci.yml
- `Regra: motor sem UI (src/engine puro e testavel)` --semantically_similar_to--> `Separacao motor musical puro x apresentacao React`  [INFERRED] [semantically similar]
  AGENTS.md → README.md
- `Padrao visual tema Windows XP (Tailwind + hex diretos)` --semantically_similar_to--> `Guia de contribuicao (fork, branch, padrao, checagens, PR)`  [INFERRED] [semantically similar]
  AGENTS.md → README.md
- `Runtime de CI: Node.js 24 com cache npm` --conceptually_related_to--> `Viola Libre — o cifrario aberto e matematico`  [AMBIGUOUS]
  .github/workflows/ci.yml → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Fluxo de orientacao por grafo antes de editar codigo** — agents_grafo_primeiro, agents_graphify_out, agents_graph_report, agents_graph_json, agents_manifest_json, agents_grafo_defasado [EXTRACTED 1.00]
- **Portao de qualidade lint + test + build (docs, agentes e CI)** — agents_checagem_pre_conclusao, readme_como_contribuir, readme_scripts_npm, _github_workflows_ci_verificacoes [INFERRED 0.95]
- **Nucleo do motor musical puro (afinacao, voicings, conversoes)** — readme_motor_musical_puro, readme_tuning, readme_chordcalculator, readme_conversoes_nota_numero, agents_motor_sem_ui [INFERRED 0.95]
- **Cross-Platform App Icon Set Derived from One Medallion Master** — public_android_chrome_512x512_medallion_mark, public_android_chrome_192x192_medallion_icon, public_apple_touch_icon_medallion_icon, public_favicon_32x32_medallion_icon, public_favicon_16x16_medallion_icon [INFERRED 0.95]
- **Heraldic Medallion Composition: Lyre, Motto, Padlock, Ribbon, Sigils** — public_android_chrome_512x512_lyre_emblem, public_android_chrome_512x512_libertas_per_musicam_motto, public_android_chrome_512x512_open_padlock_and_key, public_android_chrome_512x512_sheet_music_ribbon, public_android_chrome_512x512_celestial_sigil_field [EXTRACTED 1.00]
- **Brand Identity: Freedom Through Music (Unlocked Sheet Music)** — public_android_chrome_512x512_libertas_per_musicam_motto, public_android_chrome_512x512_open_padlock_and_key, public_android_chrome_512x512_sheet_music_ribbon, public_android_chrome_512x512_medallion_mark [INFERRED 0.85]

## Communities (46 total, 3 thin omitted)

### Community 0 - "Favoritos (Estante de Cifras)"
Cohesion: 0.08
Nodes (62): useCifraFavorites(), useFavoritesBootSync(), displayArtist(), FavoritosDashboard(), Selection, SORT_LABEL, SortMode, favoriteCifra() (+54 more)

### Community 1 - "Explorador de Artistas/Musicas"
Cohesion: 0.05
Nodes (45): InfiniteLoader(), Props, ArtistSongFilterResult, ArtistSongTab, normalizeAccents(), useArtistSongFilter(), ArtistList(), bufferKey() (+37 more)

### Community 2 - "CifraViewer & Sequencias"
Cohesion: 0.09
Nodes (46): parseChordString(), transposeChordString(), ChordMapPoint, CifraViewer(), DEFAULT_FILTER, fmtTime(), isChordDiatonic(), SectionEntry (+38 more)

### Community 3 - "Editor de Melodia & Icones"
Cohesion: 0.11
Nodes (32): react, PauseIcon(), PlayIcon(), RedoIcon(), RestartIcon(), RobotIcon(), UndoIcon(), generateChordsForMelody() (+24 more)

### Community 4 - "Motor de Audio & Vozes"
Cohesion: 0.07
Nodes (17): AudioEngine, InstrumentVoice, OscillatorVoice, PluckedStringVoice, SoundFontVoice, VOICE_REGISTRY, CifraEditor(), CifraViewer() (+9 more)

### Community 5 - "CI e Doutrina AGENTS.md"
Cohesion: 0.06
Nodes (41): Concurrency com cancel-in-progress, Passos com !cancelled() (falha nao interrompe os demais), Runtime de CI: Node.js 24 com cache npm, Job CI "verificacoes" (Lint, build e testes), Portao de qualidade: lint && test && build, Fronteiras de modulo (App Shell, Explore Cifras, Timing, Ouvido, Chord Finder, Audio), God nodes do projeto (CifraViewer, TimingEditor, Tuning…), Grafo e um retrato do passado (built_at_commit) (+33 more)

### Community 6 - "Dependencias NPM"
Cohesion: 0.05
Nodes (38): dependencies, axios, fuse.js, lucide-react, react-dom, react-router-dom, soundfont-player, tailwindcss (+30 more)

### Community 7 - "Transpositor de Tablatura"
Cohesion: 0.11
Nodes (34): Props, TabTransposerBlock(), ContentSegment, detectRawTabBlocks(), detectSourceTuning(), findBestPosition(), findElementEnd(), getTuningLabelsHighToLow() (+26 more)

### Community 8 - "API e Regioes de Timing"
Cohesion: 0.11
Nodes (21): TimingEditorProps, TimingContribution, TimingInstrumental, TimingLoop, TimingMarker, TimingPhrase, TimingSection, TimingSubmitPayload (+13 more)

### Community 9 - "Editor de Timing"
Cohesion: 0.10
Nodes (15): EditorMode, getAutoLabel(), LINK_TARGET_TYPE, MARKER_META, parseTimeString(), NOTE: with segno/coda/to_coda/d_c_*/d_s_* removed from the manual creation grid, SECTION_ORDER, SECTION_TYPE_META (+7 more)

### Community 10 - "Grid de Cifra & Texto"
Cohesion: 0.13
Nodes (18): Block, CifraGridEditor(), CifraGridEditorProps, dotOpacity(), parseBlocks(), buildChordLineText(), buildReflowedPair(), ChordPos (+10 more)

### Community 11 - "App Shell & Diagramas"
Cohesion: 0.12
Nodes (12): App(), FavoriteVoicing, FretboardDiagram(), FretboardDiagramProps, IconCopy(), IconNotepad(), IconTrash(), buildVoicingFromFrets() (+4 more)

### Community 12 - "Braco Interativo & Duetos"
Cohesion: 0.14
Nodes (21): InteractiveFretboard(), ScaleTrainer(), ScaleTrainerProps, DEGREE_LABELS, DUET_TYPES, DuetPosition, DuetType, MAJOR_SCALE_INTERVALS (+13 more)

### Community 13 - "Auth de Editor & Curadoria"
Cohesion: 0.13
Nodes (21): ChordEditorModal(), EditorLoginModal(), EditorLoginModalProps, api, aggregateEntries(), buildChordId(), ChordRankEntry, CuratedVoicing (+13 more)

### Community 14 - "Video Fonte & YouTube API"
Cohesion: 0.11
Nodes (13): SourceVideoPanel(), SourceVideoPanelProps, cleanYouTubeUrl(), detectMediaType(), extractYouTubeId(), inFlight, knownDurations, loadYouTubeApi() (+5 more)

### Community 15 - "Overlays de Gravacao & Auto-Scroll"
Cohesion: 0.16
Nodes (15): CHIP_COLORS, NEXT_SECTION_CHIPS, RecordingBar(), LoopSaltoWizardOverlay(), AutoScrollPreview(), TimingTimeline(), AutoScrollResult, useAutoScroll() (+7 more)

### Community 16 - "chordCalculator (Motor de Acordes)"
Cohesion: 0.16
Nodes (20): applyTemplateAt(), BASE_DROP_ORDER, buildChord(), calculateVoicings(), chooseVoicingsForProgression(), deriveMovableTemplates(), grauParaIntervalo(), isValidChordToken() (+12 more)

### Community 17 - "TS Config App"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 18 - "Modais de Onboarding"
Cohesion: 0.21
Nodes (13): ChordEditorModalProps, EarTranscriptionProps, Props, InstrumentSelector(), InstrumentSelectorProps, InteractiveFretboardProps, MelodySequenceEditorProps, VisualizationOnboardingModal() (+5 more)

### Community 19 - "TS Config Test"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 20 - "Tirando de Ouvido & Presets"
Cohesion: 0.15
Nodes (16): anunciacaoPresetData, createDefaultMelody(), EarTranscription(), getMajorHarmonizedField(), getMinorHarmonizedField(), KeyConfig, majorIntervals, minorIntervals (+8 more)

### Community 21 - "TS Config Node"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 22 - "Store de Modo Assistido"
Cohesion: 0.16
Nodes (3): AssistedModeOverlay(), AssistedModeState, useAssistedModeStore

### Community 24 - "Identidade de Marca (Medalhao)"
Cohesion: 0.20
Nodes (15): Medallion Icon 192px (Android/PWA), PWA Manifest Icon Set Convention (192/512), Antique Bronze and Gemstone Color Language, Iridescent Celestial Sigil Field (Planetary Glyphs, Constellations), Motto Banner: LIBERTAS PER MUSICAM, Filigree Lyre Emblem, Viola Libre Medallion Mark (512px Master), MYSICA Sub-Banner Wordmark (+7 more)

### Community 25 - "Tipos Musicais & Hover Card"
Cohesion: 0.21
Nodes (11): ChordAnchor, ChordHoverCard(), ChordHoverCardProps, MiniFretboard(), MiniFretboardProps, Chord, NoteInfo, PitchClass (+3 more)

### Community 26 - "Timeline de Timing"
Cohesion: 0.16
Nodes (11): InlineMarkerDotProps, MARKER_DOT_SYMBOL, DragState, MarkerMetaEntry, ModifyPopupState, TimingTimelineProps, TRACK_ACCENT, TRACK_BG (+3 more)

### Community 27 - "Wizard de Line Link"
Cohesion: 0.27
Nodes (5): LineLinkWizardOverlay(), LineLinkWizardState, useLineLinkWizardStore, useTimingRegionsStore, useTimingSelectionStore

### Community 28 - "Piano Interativo & Teoria"
Cohesion: 0.25
Nodes (8): CHROMATIC_BLACK_NOTES, CHROMATIC_WHITE_NOTES, ChromaticPiano(), NATURAL_NOTES, NaturalPiano(), Note, playNoteSound(), Lesson

### Community 29 - "Trilhas de Timing"
Cohesion: 0.18
Nodes (6): CLIP_COLORS, ClipKind, SECTION_COLORS, SECTION_ORDER, SECTION_TYPE_LABEL, TimelineClip

### Community 30 - "Teste de Regressao de Curadoria"
Cohesion: 0.24
Nodes (9): combos, CuratedRow, DUMP, IGNORED_EDITORS, LEGACY_BY_STRING_COUNT, rankOfCuratedShapes(), resolveCuration(), rows (+1 more)

### Community 31 - "Navegacao por Abas"
Cohesion: 0.36
Nodes (8): readStoredPaths(), resolveTabTarget(), TAB_ROOT_PATH, tabFromPathname(), TabId, TabPaths, useTabNavigation(), writeStoredPaths()

### Community 32 - "Saltos Derivados"
Cohesion: 0.39
Nodes (6): computeDurationSimilarity(), DerivedJump, findLongestRun(), regionDuration(), relativeDurationDiff(), useDerivedJumps()

### Community 33 - "Sprite de Icones Sociais"
Cohesion: 0.38
Nodes (7): Icon Sprite Sheet, Bluesky Icon, Discord Icon, Documentation Icon, GitHub Icon, Social Icon, X (Twitter) Icon

### Community 34 - "Ilustracao Hero"
Cohesion: 0.60
Nodes (5): Base Card with Violet Gradient Side, Hero Illustration (Stacked Isometric Cards), Minimalist Isometric 3D Design, Floating Top Card (Outline), Violet/Purple Gradient Accent

### Community 35 - "Chord Finder"
Cohesion: 0.60
Nodes (4): ChordFinder(), ChordFinderProps, getSuffixFromBuilder(), parseSuffix()

### Community 36 - "Licenca AGPL & Comunidade"
Cohesion: 0.67
Nodes (3): Licenca AGPL-3.0 para contribuicoes (AGENTS), Licenca AGPL-3.0 (copyleft inclusive para servico web), Projeto comunitario sem anuncios nem monetizacao

## Ambiguous Edges - Review These
- `Runtime de CI: Node.js 24 com cache npm` → `Viola Libre — o cifrario aberto e matematico`  [AMBIGUOUS]
  .github/workflows/ci.yml · relation: conceptually_related_to
- `Nivel 1 — graphify query/path/explain (custa tokens)` → `CifraViewer() — hub de renderizacao de cifra`  [AMBIGUOUS]
  AGENTS.md · relation: references
- `Motto Banner: LIBERTAS PER MUSICAM` → `MYSICA Sub-Banner Wordmark`  [AMBIGUOUS]
  public/android-chrome-512x512.png · relation: references

## Knowledge Gaps
- **218 isolated node(s):** `ChordFinderProps`, `PresetNote`, `solfegeToMidi`, `phrases`, `anunciacaoPresetData` (+213 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Runtime de CI: Node.js 24 com cache npm` and `Viola Libre — o cifrario aberto e matematico`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Nivel 1 — graphify query/path/explain (custa tokens)` and `CifraViewer() — hub de renderizacao de cifra`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Motto Banner: LIBERTAS PER MUSICAM` and `MYSICA Sub-Banner Wordmark`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `react` connect `Editor de Melodia & Icones` to `App Shell & Diagramas`, `Braco Interativo & Duetos`, `Dependencias NPM`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Dependencias NPM` to `Editor de Melodia & Icones`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `App()` connect `App Shell & Diagramas` to `Favoritos (Estante de Cifras)`, `Editor de Melodia & Icones`, `Braco Interativo & Duetos`, `chordCalculator (Motor de Acordes)`, `Navegacao por Abas`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `ChordFinderProps`, `PresetNote`, `solfegeToMidi` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._