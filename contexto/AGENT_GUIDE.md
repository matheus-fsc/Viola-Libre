# Guia para o Sub-Agente

## Como navegar este projeto

Leia primeiro: `OVERVIEW.md` → `COMPONENTES.md` → `ESTADO_BUGS.md`

## Onde está cada coisa

| Preciso de... | Arquivo |
|---|---|
| Tipos TypeScript | `src/engine/types.ts` |
| Dados de instrumentos/acordes/escalas | `src/engine/tunings.ts` |
| Lógica de cálculo de acordes/voicings | `src/engine/chordCalculator.ts` |
| Som / áudio | `src/engine/AudioEngine.ts` |
| Layout geral e abas | `src/App.tsx` |
| Lista de artistas (Explorer de Cifras) | `src/pages/cifras/ArtistList.tsx` |
| Viewer de cifra (letra + acordes) | `src/pages/cifras/CifraViewer.tsx` |
| Chamadas HTTP à API | `src/services/api.ts` |
| Piano Roll / editor de melodia | `src/components/MelodySequenceEditor.tsx` + `MelodySequenceEditor/` |
| Estilos específicos de cifras | `src/components/Cifras.css` |

## Convenções importantes

- **Tema visual XP:** não mudar cores sem motivo. Primário `#0058e6`, destrutivo `#cc3300`, favorito `#ff7f27`.
- **Voicings:** frets array onde `-1` = abafado, `0` = corda solta, `1+` = casa pressionada.
- **PitchClass:** inteiro 0–11 onde C=0, C#=1, ..., B=11. Nunca confundir com MIDI.
- **MIDI:** número da nota absoluto (ex.: 69 = A4 = 440Hz).
- **Sem comentários desnecessários** — código auto-explicado por nomes descritivos.
- **Sem feature flags ou abstrações antecipadas** — só implementar o que foi pedido.

## Fluxo de estado na aba Chords

```
ChordFinder → handleChordChange → rootName/suffix/bassName/customNotes
  → useMemo: buildChord + calculateVoicings → activeVoicings
  → useMemo: filtros → filteredVoicings
  → FretboardDiagram[] (grid de resultados)
  → InteractiveFretboard (braço interativo abaixo)
```

## API Backend

Rodando localmente via proxy (vite.config). Em prod via `VITE_API_BASE_URL`.
Cache in-memory em `services/api.ts` — não chama o backend duas vezes para o mesmo recurso.
