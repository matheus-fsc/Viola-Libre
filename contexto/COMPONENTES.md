# Componentes — O que cada um faz

## Engine (lógica pura, sem React)

### `engine/types.ts`
Define todas as interfaces TypeScript do projeto: `Tuning`, `Instrument`, `Chord`, `Voicing`, `Scale`, `ReverseChordMatch`, etc.

### `engine/tunings.ts`
Banco de dados estático:
- `PRESET_INSTRUMENTS`: Viola Caipira (5 afinações), Violão (padrão + outros), Banjo, Ukulele, etc.
- `CHORD_FORMULAS`: todos os tipos de acorde suportados (maior, menor, 7, m7, dim, aug, sus, 6, 6/9, etc.)
- `SCALE_FORMULAS`: escalas (maior, menor natural, pentatônica, etc.)

### `engine/chordCalculator.ts`
- `buildChord(root, suffix, bass?)` → monta um objeto `Chord`
- `calculateVoicings(tuning, chord)` → gera todas as posições tocáveis no braço para aquele acorde
- `evaluatePlayability(frets)` → pontua a dificuldade de um voicing (dedilhado, pestana, abafamento interno)
- `shouldUseFlats(rootName)` → decide se usa bemóis ou sustenidos
- `reverseChordDetect(frets, tuning)` → identifica qual acorde está no braço (usado no InteractiveFretboard)

### `engine/AudioEngine.ts`
Singleton com Strategy Pattern para troca de timbre:
- `OscillatorVoice` — oscilador triangular simples (padrão)
- `PluckedStringVoice` — simula corda dedilhada
- `SoundFontVoice` — usa soundfont-player para sons reais (violão nylon, aço, piano, sanfona)
- `playMidi(midi, duration)` — toca uma nota MIDI
- Modo de troca de voz em tempo real sem reinicialização do contexto

---

## Componentes de UI

### `InstrumentSelector.tsx`
Painel lateral com dropdowns de instrumento e afinação. Permite criar afinação customizada (matriz de notas MIDI manuais).

### `ChordFinder.tsx`
Painel de seleção do acorde: raiz (A–G#/Bb), sufixo (tipo de acorde), baixo opcional, notas extras customizadas. Exibe contagem de voicings encontrados.

### `FretboardDiagram.tsx`
Renderiza um diagrama SVG estático de acorde (estilo livro de cifras). Suporta:
- Exibição de casas, cordas abertas/abafadas, pestanas
- Botão de favoritar (estrela) e adicionar à "Minha Cifra" (bloco de notas)
- Botão de tocar o acorde (arpejo com AudioEngine)

### `InteractiveFretboard.tsx`
Braço clicável completo (até 15 casas). Ao clicar numa casa aciona o som e exibe qual nota é. Detecta o acorde formado pelas notas selecionadas via `reverseChordDetect`. Pode receber um voicing externo para exibir posições carregadas dos Favoritos.

### `ScaleTrainer.tsx`
Visualiza qualquer escala no braço. Destaca a tônica e os graus. Modo de exibição: nome da nota ou grau (I, II, III...).

### `EarTranscription.tsx`
Aba "Tirando de Ouvido". Contém:
- Pré-carregado com melodia preset de "Anunciação" (Alceu Valença) com teoria
- Interface para adicionar notas ao piano roll
- Passa estado para `MelodySequenceEditor`

### `MelodySequenceEditor.tsx` + subcomponentes
Piano roll completo:
- `PianoRollGrid` — grade de notas por tempo
- `TimeRuler` — régua de compassos
- `TransportControls` — play/pause/stop, BPM
- `PlaybackContext` — contexto de reprodução (React Context)
- `helpers.ts` — geração de acordes por tonalidade, análise de tonalidade da melodia
- Detecta automaticamente a tonalidade provável da melodia digitada

### `ViolaDuets.tsx`
Aparece só quando instrumento é "Viola Caipira". Exibe padrões de duetos típicos da viola (dobras e intervalos característicos).

### `TheoryGuide.tsx`
Conteúdo estático de teoria musical (escalas, modos, círculo de quintas). Sem interação.

---

## Pages — Cifras (src/pages/cifras/)

### `CifrasApp.tsx`
Shell de roteamento interno com `MemoryRouter`. Três rotas: `/` (lista artistas), `/:artistSlug` (músicas), `/:artistSlug/*` (viewer).

### `ArtistList.tsx`
Tela inicial do módulo de cifras:
- Hydration em 2 etapas: carrega amostra mínima primeiro, depois o dicionário completo (~30k artistas)
- Modos de busca: artistas, músicas globais, top views, top likes, por gênero
- Filtro por letra do alfabeto, scroll infinito paginado (visibleCount)
- Infinite scroll com IntersectionObserver

### `SongList.tsx`
Lista músicas de um artista. Carrega via API, exibe título e versão. Navegação para CifraViewer.

### `CifraViewer.tsx`
Exibe a cifra completa de uma música:
- Renderiza letra com acordes acima (formato `[Acorde]letra`)
- Transposição de tom (semitones +/-)
- Increments view counter via API ao abrir
- Favoritar cifra via API
- Avaliação de dificuldade
- Exibe diagramas de acorde (FretboardDiagram) para cada acorde único da música
- Toca acordes ao clicar no nome

### `services/api.ts`
Todas as chamadas HTTP com axios. Cache in-memory por chave para evitar requisições repetidas. Endpoints:
- `/api/artistas` — lista completa
- `/api/artistas/iniciais` — amostra inicial
- `/api/artistas/:slug/musicas` — músicas de um artista
- `/api/musicas/busca?q=` — busca global
- `/api/rankings/top-musicas` e `top-likes`
- `/api/generos` e `/api/generos/:genero/top`
- `/api/cifra/:artistSlug/:songSlug` — conteúdo da cifra
- Validação Zod antes de POST de favoritar (evita requests malformados)
