# Estado do Projeto & Bugs Conhecidos

## O que está pronto e funcional

- **Dicionário de Acordes** — cálculo de voicings, filtros, favoritos, cifra própria, play de acorde
- **Braço Interativo** — clique em notas, reverse chord detection, carregamento de favoritos
- **AudioEngine** — múltiplos timbres (oscillator, plucked string, soundfonts reais), troca em runtime
- **InstrumentSelector** — múltiplos instrumentos, afinações preset e custom
- **ScaleTrainer** — todas as escalas, todos os instrumentos
- **ViolaDuets** — ativo só para viola caipira
- **TheoryGuide** — conteúdo estático completo
- **Cifras Explorer** — lista de artistas (~30k), busca, filtro gênero, top songs, viewer com transposição
- **Favoritos** — persistidos em localStorage
- **MelodySequenceEditor** — piano roll com playback, BPM, análise de tonalidade
- **EarTranscription** — pré-carregado com "Anunciação" como exemplo pedagógico

## Funcionalidades recentes (últimos commits)

1. **Fix infinite scroll** (296bcd5) — corrigidos bugs de scroll infinito nos componentes ArtistList e SongList
2. **Cache híbrido + filtros de gênero + seletor de instrumentos em Cifras** (879dac1) — ArtistList totalmente refatorada com hydration 2 etapas, filtro por gênero, lucide-icons
3. **Chord variations 2 e m2** (0706c1a) — adicionados intervalos de 2ª maior e menor ao motor de acordes
4. **Integração Cifras Explorer via proxy/Cloudflare tunnel** (7542459) — backend conectado ao frontend
5. **Icons SVG estilo XP** (61406a6) — substituição de emojis por SVGs customizados

## Bugs conhecidos / Issues documentados

### 1. `parseChordString` duplicado
- **Onde:** `App.tsx` e `CifraViewer.tsx` têm implementações idênticas da função `parseChordString` e `transposeChordString`
- **Impacto:** duplicação de código, qualquer fix precisa ser feito em dois lugares
- **Status:** não resolvido (candidato a extrair para `engine/chordCalculator.ts`)

### 2. API Key exposta no frontend
- **Onde:** `services/api.ts` linha 124 — fallback hardcoded `viola_live_nBcrg1wcNlUPMdOt9H83kaEK8BSzn1LB9K6UuJ-Nc1U`
- **Impacto:** chave visível no bundle final
- **Status:** não resolvido (mitigação: `VITE_API_KEY` env var, mas o fallback expõe)

### 3. `getTopSongs` usa cast `as any`
- **Onde:** `services/api.ts` linha 81 — `cache.songs['top'] = data as any`
- **Impacto:** type safety comprometido para o cache de top songs
- **Status:** não resolvido

### 4. AudioEngine default voice incorreto
- **Onde:** `AudioEngine.ts` linha 205 — `this.voice = VOICE_REGISTRY[0]` aponta para `SoundFontVoice` (violão nylon), mas no comentário diz "Default: triangle oscillator"
- **Impacto:** comentário enganoso; na prática o default é soundfont (que precisa de rede)
- **Status:** bug de comentário / inconsistência de expectativa

### 5. `transposeChordString` usa `+ 120` em CifraViewer vs `+ 12` em App.tsx
- **Onde:** `CifraViewer.tsx` linha 46 vs `App.tsx` linha 158
- **Impacto:** transposição em semitones negativos pode dar resultado diferente nos dois viewers
- **Status:** leve inconsistência (ambos funcionam para casos positivos; `+ 120` é mais seguro para negativos grandes)

### 6. Sem backend de autenticação de usuário
- **Status:** não existe login. `getUserHash()` gera um ID aleatório local para favoritar cifras. Não há persistência real de preferências do usuário no servidor.

## Dependências críticas externas
- **Backend/API própria** rodando via proxy local + Cloudflare Tunnel (desenvolvimento local)
- `VITE_API_BASE_URL` e `VITE_API_KEY` precisam estar no `.env` para produção
- Soundfonts carregados sob demanda da CDN do soundfont-player (requer internet)

## Padrões visuais do projeto
- Tema Windows XP: fundo `#ece9d8`, bordas bevel, gradiente azul na barra de título `#0058e6`
- Fonte mono para elementos de código/acordes
- Vermelho `#cc3300` para ações destrutivas, laranja `#ff7f27` para favoritos
- Verde `#228b22` para ações positivas/numeração
