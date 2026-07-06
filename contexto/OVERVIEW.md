# Viola Libre — Contexto do Projeto

## O que é
App web de música focado em viola caipira e instrumentos de corda brasileiros. Interface estilo Windows XP (visual retro). Feito em React + TypeScript + Tailwind v4 + Vite.

## Stack
- **Frontend:** React 19, TypeScript 6, Tailwind v4, Vite 8
- **Roteamento interno (Cifras):** react-router-dom v7 com `MemoryRouter`
- **Áudio:** Web Audio API + soundfont-player (SoundFonts MIDI reais)
- **HTTP:** axios + zod (validação de inputs antes de requisições)
- **Icons:** lucide-react (nas páginas de Cifras) + SVGs inline customizados (estilo XP)

## Estrutura de diretórios relevante
```
src/
  App.tsx                    ← Raiz: orquestra abas, estado global, playlist preset
  engine/
    types.ts                 ← Tipos: Tuning, Instrument, Chord, Voicing, Scale...
    tunings.ts               ← Dados: PRESET_INSTRUMENTS, CHORD_FORMULAS, SCALE_FORMULAS
    chordCalculator.ts       ← Lógica: buildChord, calculateVoicings, evaluatePlayability
    intervals.ts             ← Utilitários de intervalo
    AudioEngine.ts           ← Engine de som (Singleton + Strategy Pattern)
  components/
    InstrumentSelector.tsx   ← Seletor de instrumento e afinação (com afinação custom)
    ChordFinder.tsx          ← Seletor de raiz, sufixo, baixo e notas extras
    FretboardDiagram.tsx     ← Diagrama SVG de acorde (exibe voicings)
    InteractiveFretboard.tsx ← Braço interativo clicável (notas + reverse chord detect)
    ScaleTrainer.tsx         ← Visualizador de escalas no braço
    TheoryGuide.tsx          ← Guia de teoria musical estático
    EarTranscription.tsx     ← Aba "Tirando de Ouvido" — editor de melodia + análise
    MelodySequenceEditor.tsx ← Piano Roll principal (editor de sequência melódica)
    MelodySequenceEditor/    ← Subcomponentes do piano roll
      PianoRollGrid.tsx
      PlaybackContext.tsx
      TimeRuler.tsx
      TransportControls.tsx
      helpers.ts
      types.ts
    ViolaDuets.tsx           ← Duetos de viola (aparece só quando viola caipira selecionada)
    Icons.tsx                ← SVG icons reutilizáveis (StarIcon etc)
    Cifras.css               ← Estilos específicos para o viewer de cifras
  pages/cifras/
    CifrasApp.tsx            ← Shell de roteamento (MemoryRouter) das telas de cifra
    ArtistList.tsx           ← Lista de artistas com busca, filtro de gênero, top songs
    SongList.tsx             ← Lista de músicas de um artista
    CifraViewer.tsx          ← Viewer de cifra: letra+acordes, transposição, fretboard
  services/
    api.ts                   ← Todas as chamadas HTTP + cache in-memory + validação zod
```

## Abas principais (App.tsx)
| Aba | ID | O que faz |
|---|---|---|
| Explore Cifras | `cifras` | Navega artistas/músicas e lê cifras via API |
| Dicionário de Acordes | `chords` | Busca voicings para qualquer acorde em qualquer instrumento |
| Treinos e Teoria | `train` | Visualiza escalas + Duetos de viola + guia de teoria |
| Tirando de Ouvido | `ear` | Editor de melodia tipo piano roll + análise de tonalidade |
| Meus Favoritos | `favorites` | Voicings salvos no localStorage |
