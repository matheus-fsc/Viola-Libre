# Guia para Agentes Autônomos — Viola Libre

Este arquivo orienta agentes de IA que trabalham neste repositório. A regra de ouro:

> **Oriente-se pelo grafo em `graphify-out/` antes de varrer a árvore de arquivos.
> Use o grafo como _mapa_; o código-fonte é a _verdade_.**

O projeto tem 89 arquivos / ~114 mil palavras. Um `grep` cego é caro e perde relações
(quem-chama-quem, a qual módulo algo pertence). O grafo já respondeu essas perguntas.

---

## O que existe em `graphify-out/`

| Arquivo | Para que serve | Custo de ler |
| ------- | -------------- | ------------ |
| `GRAPH_REPORT.md` | **Comece aqui.** Resumo legível: hubs de módulos, god nodes, comunidades, conexões surpreendentes, gaps. | Grátis (é texto) |
| `graph.json` | Grafo completo (node-link + hyperedges) para consulta programática com `jq`/python. | Grátis (offline) |
| `manifest.json` | Mapa arquivo → hash (mtime, ast_hash, semantic_hash). Serve para detectar arquivos que mudaram desde a build. | Grátis |
| `graph.html` | Visualização interativa (para humanos, não para agentes). | — |
| `.graphify_root` / `.graphify_python` | Metadados internos do graphify (raiz e interpretador). | — |

O grafo foi construído num commit específico (campo `built_at_commit` em `graph.json`).
**Ele é um retrato do passado** — sempre confirme contra o código atual antes de editar.

---

## Fluxo recomendado (dois níveis)

### Nível 0 — Estático e offline (padrão, sem custo de LLM)

Funciona sempre, sem instalar nada. Leia `GRAPH_REPORT.md` para o mapa, depois consulte
`graph.json` para relações precisas. Estrutura do `graph.json`:

- **`nodes[]`** — `{ id, label, norm_label, file_type, source_file, source_location, community }`
- **`links[]`** — `{ source, target, relation, context, confidence, source_file, source_location, weight }`
  (`source`/`target` são **ids** de nós; `relation` ∈ `imports`, `references`, `calls`, …)
- **`graph.hyperedges[]`** — relações de grupo `{ id, label, nodes[], relation, confidence }`

#### Receitas de consulta

**Recomendado: python** (sempre disponível — o próprio graphify roda em python; não depende de `jq`
estar instalado). Este helper cobre as consultas mais comuns:

```python
import json
d = json.load(open('graphify-out/graph.json', encoding='utf-8'))
nodes, links = d['nodes'], d['links']

# 1. Localizar o arquivo de um conceito (busca parcial, case-insensitive)
def locate(term):
    for n in nodes:
        if term.lower() in n.get('norm_label', '').lower():
            print(f"{n['label']} -> {n['source_file']}:{n.get('source_location')} [c{n['community']}]")

# 2. id de um nó a partir do rótulo exato
def node_id(label):
    return next((n['id'] for n in nodes if n['label'] == label), None)

# 3. Quem DEPENDE de um nó (arestas que chegam = quem o usa)
def used_by(label):
    t = node_id(label)
    return [f"{l['source']} --{l['relation']}-->" for l in links if l['target'] == t]

# 4. Do que um nó depende (arestas que saem)
def depends_on(label):
    s = node_id(label)
    return [f"--{l['relation']}--> {l['target']}" for l in links if l['source'] == s]

# 5. Arquivos de um módulo/comunidade (o número vem do GRAPH_REPORT.md)
def files_in(community):
    return sorted({n['source_file'] for n in nodes if n.get('community') == community})

# 6. Relações de grupo
def hyperedges():
    return [(h['label'], h['nodes']) for h in d['graph']['hyperedges']]

locate('CifraViewer')   # → CifraViewer() -> src/pages/cifras/CifraViewer.tsx:L86 [c0]
```

**Alternativa: `jq`** (se instalado). Ex.: `jq -r '.nodes[] | select(.label=="buildChord()") | .id'
graphify-out/graph.json` → `src_engine_chordcalculator_buildchord`. As mesmas seleções valem trocando
`.nodes[]`/`.links[]` e os campos `source`/`target`/`relation`/`community`.

### Nível 1 — Consulta rica (quando o graphify CLI está instalado)

Para perguntas em linguagem natural que exigem travessia. **Custa tokens de LLM** — use quando
o Nível 0 não basta.

```bash
graphify query "Como o cálculo de acordes chega até o diagrama na tela?"   # BFS, contexto amplo
graphify query "..." --dfs                # DFS, para rastrear um caminho específico
graphify path "ChordFinder" "AudioEngine" # menor caminho entre dois conceitos
graphify explain "TimingEditor"           # explicação em linguagem natural de um nó
```

Se `graphify-out/graph.json` já existe, uma pergunta sobre o código deve ser tratada como
`graphify query` — não refaça a build. Só reconstrua (`graphify . --update`) após mudanças
grandes no código, para o grafo não ficar defasado.

---

## Atalhos do mapa (deste projeto)

Detalhes completos em `graphify-out/GRAPH_REPORT.md`. Resumo:

- **God nodes (núcleo):** `CifraViewer()`, `TimingEditor()`, `noteNameToPitchClass()`,
  `PlayerState`, `App()`, `Tuning`, `formatSeconds()`, `midiToNoteName()`.
- **Motor musical puro:** `src/engine/` (sem React) — mexa aqui para lógica de acordes/afinação/áudio.
- **Fronteiras de módulo:** App Shell & Modals · Explore Cifras (Artist/Song Browser) ·
  Editor de Timing (Timeline, Tracks, Wizards, Assisted Mode) · Tirando de Ouvido
  (Ear Transcription + Melody Sequence) · Chord Finder · Audio Engine & Voices.
- **Sem ciclos de import** detectados — mantenha assim.

---

## Regras de trabalho

1. **Grafo primeiro, `grep` depois.** Use `graphify-out/` para achar o ponto certo; confirme lendo o arquivo real.
2. **O grafo pode estar defasado.** Se `manifest.json`/`built_at_commit` divergir do estado atual,
   confie no código e considere sugerir `graphify . --update`.
3. **Motor sem UI.** Lógica musical em `src/engine/` (pura, testável); componentes React apenas consomem.
4. **Padrão visual.** Tema Windows XP com Tailwind + hex diretos; siga os componentes vizinhos.
5. **Antes de concluir:** `npm run lint && npm run test && npm run build` devem passar.
6. **Licença AGPL-3.0.** Todo código contribuído fica sob a AGPL-3.0 (veja `LICENSE`).
```
