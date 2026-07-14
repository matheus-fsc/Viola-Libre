# Viola Libre

**O Cifrário Aberto e Matemático** para viola caipira, violão, cavaquinho e outros instrumentos de corda.

[![Licença: AGPL-3.0](https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0-blue.svg)](./LICENSE)

Diferente de sistemas engessados, o Viola Libre **calcula** as posições dos acordes a partir de
intervalos e equações de semitons. Isso permite trocar de afinação instantaneamente (Cebolão Ré,
Cebolão Mi, Rio Abaixo…) ou alterar a nota de qualquer corda e recalcular tudo na hora.

É um projeto **comunitário, open source e sem fins lucrativos** — sem anúncios, sem monetização,
sem cobrança. O objetivo é dar acesso livre e minimalista a estudantes e mestres do instrumento.

---

## Recursos

- **Dicionário de Acordes** — acordes com baixo em nota específica (slash chords), inversões e
  variações anatômicas inteligentes, ranqueadas por facilidade de execução.
- **Explore Cifras** — navegação por artistas e músicas com visualização de cifras.
- **Treinos e Teoria** — treino de escalas (incluindo escalas duetadas na viola caipira) e
  visualização de intervalos direto no braço do instrumento.
- **Tirando de Ouvido** — sequenciador de melodias interativo e detector de tonalidade para
  ajudar a tirar músicas de ouvido.
- **Editor de Timing** — sincronização de cifras com áudio/vídeo (auto-scroll, loops, saltos).
- **Favoritos e Minhas Cifras** — salve digitações favoritas e monte o roteiro de acordes de uma música.

---

## Tecnologias

- **[React 19](https://react.dev/)** + **TypeScript**
- **[Vite](https://vite.dev/)** — build e dev server
- **[Tailwind CSS 4](https://tailwindcss.com/)** — estilização (tema Windows XP clássico)
- **[React Router 7](https://reactrouter.com/)** — roteamento
- **[Zustand](https://zustand.docs.pmnd.rs/)** — estado global
- **[Zod](https://zod.dev/)** — validação de esquemas
- **[soundfont-player](https://github.com/danigb/soundfont-player)** — áudio dos instrumentos
- **[Vitest](https://vitest.dev/)** — testes

---

## Arquitetura

O código separa **motor musical** (lógica pura, sem UI) de **apresentação** (componentes React).
O `App.tsx` é uma "janela" única que troca de conteúdo por aba, com base na rota atual.

```
src/
├── engine/       # Motor musical PURO (sem React): acordes, intervalos, afinações, áudio
├── components/   # UI reutilizável (braço, diagramas, seletores, editor de timing…)
│   ├── timing/   #   Editor de timing: timeline, trilhas, modo assistido, wizards
│   └── MelodySequenceEditor/  # Piano roll e sequenciador de melodia
├── pages/        # Páginas por rota (cifras, minhasCifras, termos)
├── services/     # Cliente da API e utilitários de dados
├── stores/       # Estado global (Zustand): player, timing, wizards, texto da cifra
├── hooks/        # Hooks (filtro artista/música, auto-scroll, isMobile…)
├── utils/        # Auxiliares (preferências, classificação de linhas)
├── App.tsx       # Shell da aplicação (janela + navegação por abas)
└── main.tsx      # Ponto de entrada
```

### Mapa de módulos (funcionalidade → onde mora)

| Funcionalidade            | Arquivos principais |
| ------------------------- | ------------------- |
| Motor de acordes/afinação | `src/engine/chordCalculator.ts`, `intervals.ts`, `tunings.ts`, `types.ts` |
| Áudio                     | `src/engine/AudioEngine.ts` (registro de vozes: oscilador, corda, soundfont) |
| Dicionário de Acordes     | `src/components/ChordFinder.tsx`, `FretboardDiagram.tsx`, `InteractiveFretboard.tsx` |
| Explore Cifras            | `src/pages/cifras/*` (`ArtistList`, `SongList`, `CifraViewer`, `CifrasApp`) |
| Editor de Timing          | `src/components/TimingEditor.tsx`, `src/components/timing/*`, `src/stores/useTiming*` |
| Cifra ↔ áudio (grid)      | `src/components/timing/CifraGridEditor.tsx`, `src/services/cifraUtils.ts` |
| Tirando de Ouvido         | `src/components/EarTranscription.tsx`, `src/components/MelodySequenceEditor/*` |
| Treinos e Teoria          | `src/components/ScaleTrainer.tsx`, `ViolaDuets.tsx`, `TheoryGuide.tsx`, `InteractivePiano.tsx` |
| Transposição de tablatura | `src/engine/tabTransposer.ts`, `src/components/TabTransposerBlock.tsx` |
| API / dados               | `src/services/api.ts`, `authApi.ts`, `timingApi.ts` |

### Abstrações centrais (comece por aqui)

São os nós mais conectados do código — entendê-los abre o resto:

- **`Tuning`** (`src/engine/types.ts`) — a afinação (notas das cordas). Tudo no motor gira em torno dela.
- **`chordCalculator.ts`** — gera os *voicings* (posições) de um acorde para uma afinação.
- **`noteNameToPitchClass()` / `midiToNoteName()`** (`src/engine/`) — conversões nota ↔ número, base de quase tudo.
- **`App()`** (`src/App.tsx`) — o shell; entenda como as abas e rotas são resolvidas.
- **`CifraViewer()`** (`src/pages/cifras/CifraViewer.tsx`) — o hub de renderização de cifra (o componente mais conectado do projeto).
- **`TimingEditor()`** + **`PlayerState`** — o editor de sincronização e seu estado de reprodução.

> 🗺️ **Mapa navegável do código:** o diretório [`graphify-out/`](./graphify-out) contém um grafo de
> conhecimento do projeto — leia [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md)
> para uma visão de alto nível dos módulos, dependências e "god nodes". Agentes autônomos devem
> consultar o [`AGENTS.md`](./AGENTS.md).

---

## Rodando localmente

### Pré-requisitos

- **Node.js 20+** e npm

### Passos

```bash
# 1. Instale as dependências
npm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
# edite .env com a URL da API e a chave (veja abaixo)

# 3. Rode o servidor de desenvolvimento
npm run dev
```

A aplicação sobe em `http://localhost:5173`.

### Variáveis de ambiente

| Variável             | Descrição                                              |
| -------------------- | ------------------------------------------------------ |
| `VITE_API_BASE_URL`  | URL base da API (cifras, artistas, estatísticas).      |
| `VITE_API_KEY`       | Chave para as rotas protegidas (POST de views, favoritos). |

### Scripts

| Comando           | O que faz                                        |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Servidor de desenvolvimento com hot-reload.      |
| `npm run build`   | Type-check (`tsc -b`) e build de produção.       |
| `npm run preview` | Serve localmente o build de produção.            |
| `npm run test`    | Roda a suíte de testes (Vitest).                 |
| `npm run lint`    | Verifica o código com ESLint.                    |

---

## Como contribuir

Contribuições são bem-vindas — de correções de acordes a novos recursos.

1. **Oriente-se pelo grafo.** Antes de sair caçando arquivo, leia
   [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) para achar o módulo certo.
2. **Faça um fork** e crie um branch a partir da `main` (`git checkout -b minha-melhoria`).
3. **Mantenha o padrão visual.** A UI segue o tema Windows XP com classes Tailwind e hex diretos
   já usados no projeto — siga o estilo dos componentes vizinhos, não crie um do zero.
4. **Motor sem UI.** Lógica musical vai em `src/engine/` (pura, testável); componentes só consomem.
5. **Antes de abrir o PR**, garanta que passa:
   ```bash
   npm run lint && npm run test && npm run build
   ```
6. **Abra um Pull Request** descrevendo a mudança. Toda contribuição fica sob a licença AGPL-3.0.

Encontrou um bug ou tem uma ideia? Abra uma *issue* no GitHub.

---

## Conteúdo e direitos

O **código-fonte** deste projeto é de autoria própria e licenciado como open source (veja abaixo).
Parte do **conteúdo textual** (letras e cifras) pode pertencer a terceiros ou ter sido enviada pela
comunidade — o Viola Libre não reivindica propriedade sobre letras de música. Titulares de direitos
podem solicitar remoção pelo e-mail informado na página de [Termos de Uso](./src/pages/termos/TermosDeUso.tsx).

---

## Licença

Distribuído sob a **[GNU Affero General Public License v3.0](./LICENSE)** (AGPL-3.0).

Isso significa que qualquer versão modificada — inclusive quando **hospedada como serviço web** —
deve manter seu código-fonte aberto e disponível aos usuários.

```
Viola Libre — o cifrário aberto e matemático da música de raiz
Copyright (C) 2026 Matheus Coelho

Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo
sob os termos da GNU Affero General Public License, conforme publicada pela
Free Software Foundation, na versão 3 da licença.

Este programa é distribuído na esperança de que seja útil, mas SEM QUALQUER
GARANTIA; sem mesmo a garantia implícita de COMERCIABILIDADE ou ADEQUAÇÃO A
UM DETERMINADO FIM. Veja a GNU Affero General Public License para mais detalhes.
```
