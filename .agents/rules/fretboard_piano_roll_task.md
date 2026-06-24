# Tarefa: Ajustar Extensão de Notas e Estado Inicial do Visualizador

Este arquivo serve como instrução detalhada para ajustar a grade de notas do Piano Roll e o estado de inicialização do painel do editor.

---

## 🎯 Objetivo
Melhorar a experiência de visualização do **Melody Sequence Editor (Piano Roll)** de duas formas:
1. **Extensão Fixa de Notas:** Fazer com que o Piano Roll exiba de forma estática toda a extensão de notas possíveis do instrumento desde o início, em vez de redimensionar a grade dinamicamente conforme notas são adicionadas.
2. **Inicialização Minimizada:** Garantir que o painel do editor inicie **minimizado por padrão** ao carregar a página, mantendo a tela limpa.

---

## 📁 Arquivos Relacionados
- **Cálculo de Notas e Estado:** `[MelodySequenceEditor.tsx](file:///C:/Dev/viola_libre/src/components/MelodySequenceEditor.tsx)`
- **Grade Visual:** `[PianoRollGrid.tsx](file:///C:/Dev/viola_libre/src/components/MelodySequenceEditor/PianoRollGrid.tsx)`
- **Instanciação do Estado Inicial:** `[EarTranscription.tsx](file:///C:/Dev/viola_libre/src/components/EarTranscription.tsx)`

---

## 🛠️ Especificações Técnicas

### 1. Extensão Total do Instrumento (Piano Roll)
- **Comportamento Atual:** A variável `midiRange` é calculada dinamicamente com base nas notas da melodia (`melody.map(...)`). Se a melodia estiver vazia ou tiver poucas notas, a grade encolhe, expandindo-se apenas quando novas notas são inseridas.
- **Ajuste Requerido:** Mudar o `useMemo` do `midiRange` em `MelodySequenceEditor.tsx` para ignorar a presença de notas na melodia (`melody`). O range deve abranger estaticamente:
  - **Limite Inferior:** O MIDI da corda mais grave solta (`tuningStrings[0]`) menos margem de segurança (ex: `extraLowRows`).
  - **Limite Superior:** O MIDI da corda mais aguda solta mais o número máximo de trastes (`tuningStrings[tuningStrings.length - 1] + maxFrets`) mais margem (ex: `extraHighRows`).
- **Benefício:** A grade permanece estática com todas as notas do instrumento disponíveis para rolagem vertical imediatamente.

### 2. Estado Inicial Minimizado
- **Comportamento Atual:** O editor pode carregar aberto ou maximizado.
- **Ajuste Requerido:** No componente pai (geralmente `EarTranscription.tsx`), onde o estado `isMinimized` ou `isEditorOpen` é instanciado via `useState`, o valor padrão deve ser definido como `true` (minimizado).
- **Consistência:** A funcionalidade de clique para restaurar/expandir o editor pelo botão animado do footer azul deve continuar funcionando normalmente.
