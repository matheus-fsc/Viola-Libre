# Viola Libre - Diretrizes do Workspace e Contexto de Desenvolvimento

Este arquivo serve como guia de contexto e regras de codificação para qualquer agente/subagente que atuar no desenvolvimento do projeto Viola-Libre.

---

## 🚀 Visão Geral do Projeto
O **Viola-Libre** é uma ferramenta interativa em React + TypeScript para transcrição de áudio e edição de partituras/tablaturas para violão. O ecossistema inclui:
1. **Ear Transcription (Transcrição de Ouvido)**: Módulo de escuta e identificação visual de notas no braço do violão.
2. **Melody Sequence Editor (Sequenciador / Piano Roll)**: Editor de melodias acoplado (ou flutuante) para adicionar, redimensionar e reproduzir notas musicais em uma linha do tempo.

---

## 🎨 Diretrizes de Estilo e UX
- **Estética Premium**: Manter o design rico e fluido com transições e animações suaves (ex: hover de teclas em 75ms).
- **Responsividade & Teclado**: O footer azul (contendo Viola Libre / Favoritos) pode ser minimizado para a esquerda com uma animação, transformando-se em um botão azul compacto para maximizar o espaço útil do teclado/sequenciador.
- **Redimensionamento da Janela**: O painel do Sequenciador/Piano Roll suporta redimensionamento de altura (`height`). Ao ser redimensionado, o container externo mantém a altura fixa definida e o conteúdo interno rola verticalmente (`overflow-y-auto` na área de notas/teclas).

---

## 🎵 Arquitetura de Áudio (`AudioEngine`)
- **Herança e Instrumentos**: O projeto possui um `AudioEngine` centralizado localizado em `src/services/AudioEngine.ts`.
- **Implementação**: Novos instrumentos devem implementar a interface `InstrumentVoice` e ser registrados usando `AudioEngine.registerVoice(voice)`.
- **Reprodução**: Teclas do piano roll e notas clicadas no braço do violão devem tocar usando o `AudioEngine`.

---

## 🛠️ Padrões de Código
- **TypeScript & React**: Utilize tipos estritos para notas, frequências MIDI e eventos do mouse/touch.
- **Transição de Estados**: Evitar re-renderizações desnecessárias na timeline.
- **Componentes**: Mantenha lógica de renderização do Grid de Notas (`PianoRollGrid.tsx`) otimizada para manter os scrolls de zoom horizontal e expansão de teclas suaves.
