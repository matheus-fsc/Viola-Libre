# Contribuindo com o Viola Libre

Obrigado por querer ajudar. O passo a passo básico (fork, branch, padrão visual, i18n,
checagens antes do PR) está na seção [Como contribuir](./README.md#como-contribuir) do
README. Este arquivo cobre o que não cabe lá: como o trabalho é organizado e o que se
espera de um PR.

## Antes de começar

- **Bug ou ideia pequena:** abra direto uma *issue* ou um PR.
- **Mudança grande** (novo recurso, mexida no motor de acordes, troca de dependência):
  abra uma *issue* antes, para combinar o caminho. Poupa retrabalho dos dois lados.
- **Correção de acorde ou de voicing:** diga em que instrumento e afinação, e qual forma
  você esperava. Se puder, inclua a cifra de onde veio.
- **Vulnerabilidade:** não abra issue pública. Veja o [`SECURITY.md`](./SECURITY.md).

## Ambiente

Node 20.19+, 22.13+ ou 24+ (o CI roda na 24; há um `.nvmrc`). Depois de `npm install`,
`npm run dev` sobe o site em `http://localhost:5173`. As variáveis de ambiente estão
descritas no README.

## Onde as coisas moram

Oriente-se por [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) antes de
varrer a árvore. Em resumo:

- `src/engine/`: teoria musical pura (acordes, afinações, tom, transposição). Sem React.
- `src/services/`: rede, cache, serialização. Sem React.
- `src/stores/`: estado do editor de timing e preferências (Zustand).
- `src/components/` e `src/pages/`: interface, que só consome os anteriores.
- `src/i18n/locales/`: todo texto de interface. `pt-BR.ts` é a fonte; `en.ts` é conferido
  pelo compilador.

## Testes

- Lógica nova em `src/engine/`, `src/services/` ou `src/stores/` vem com teste. Os testes
  rodam em Node puro (`vitest.config.ts`), sem DOM; veja os existentes para o jeito de
  simular `localStorage` e companhia.
- Correção de bug vem, sempre que der, com o teste que falhava antes dela.
- Os testes de regressão do motor leem dados reais em `src/engine/__fixtures__/`. Se sua
  mudança altera um resultado ali, explique no PR por que o novo resultado é o certo.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/) em português:

```
tipo(escopo): resumo curto no imperativo ou descritivo

Corpo explicando POR QUE a mudança existe e, quando for o caso, o que foi medido.
```

Tipos usados: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`. Veja o
`git log` para o tom.

## Código

- Comentários explicam **por que**, não o quê, e ficam em português.
- Siga o estilo do arquivo vizinho em nomes, densidade de comentário e idioma.
- As regras do React Compiler (`react-hooks`) reprovam o CI. Se um caso precisar mesmo
  de exceção, o `eslint-disable` vem com o motivo na linha de cima.

## Checagem final

```bash
npm run lint && npm run test && npm run build && npm run librejs:verify && npm run sitemap:verify
```

O CI roda exatamente isso em todo PR.

## Licença

Toda contribuição fica sob a [AGPL-3.0](./LICENSE), a mesma licença do projeto.
