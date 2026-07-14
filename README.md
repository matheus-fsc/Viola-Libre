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

O motor de cálculo musical (voicings, intervalos, transposição) vive em `src/engine/` e é
independente da UI.

---

## Estrutura do projeto

```
src/
├── engine/       # Motor musical: cálculo de acordes, intervalos, afinações, áudio
├── components/   # Componentes de UI reutilizáveis (braço, diagramas, seletores…)
├── pages/        # Páginas por rota (cifras, minhasCifras, termos…)
├── services/     # Comunicação com a API e utilitários de dados
├── stores/       # Estado global (Zustand)
├── hooks/        # Hooks customizados
├── utils/        # Funções auxiliares
├── App.tsx       # Shell da aplicação (janela + navegação por abas)
└── main.tsx      # Ponto de entrada
```

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
