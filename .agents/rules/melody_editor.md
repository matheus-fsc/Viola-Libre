# Melody Sequence Editor - Especificação e Comportamento

Este arquivo documenta as regras de comportamento específicas do componente **MelodySequenceEditor** e subcomponentes associados.

---

## 📐 Redimensionamento do Painel
- **Container Externo**: O editor (`MelodySequenceEditor.tsx`) possui estilo dinâmico controlado por `editorHeight`. Deve usar a propriedade `height` (e não apenas `maxHeight`) para garantir que o painel obedeça ao tamanho arrastado mesmo quando o conteúdo for pequeno.
- **Scroll Interno**: O container externo deve conter `overflow-hidden`, enquanto a área interna que agrupa as teclas MIDI e a grade de notas deve ter `overflow-y-auto` para permitir rolagem vertical caso o usuário reduza o painel.
- **Handle de Arrastar**: O componente de redimensionamento (`ResizeHandle`) fica posicionado na borda superior do painel acoplado. O cursor de redimensionamento (`cursor-ns-resize`) deve aparecer no hover no topo da janela.

---

## 🎹 Teclado MIDI e Notas
- **Click-to-Play**: Clicar nas teclas pretas/brancas do Piano Roll deve disparar a reprodução da frequência correspondente imediatamente via `AudioEngine.playNote(...)`.
- **Fretboard Sync**: Clicar em uma casa no braço do violão deve:
  - Adicionar a nota correspondente na grade do Piano Roll na posição da timeline correta (normalmente em sequência ou na posição do playhead).
  - Permitir a criação de novas notas ao clicar em uma casa vazia.

---

## ⏳ Linha do Tempo e Scroll
- **Scroll Horizontal**: A timeline superior deve se mover em sincronia com a grade de notas.
- **Performance**: Otimizar renderização do canvas/DOM da grade durante a reprodução (`requestAnimationFrame` ou atualização de classes de CSS dinâmicas para o cursor de playhead) para garantir que a timeline corra de forma "smooth" (60fps).
