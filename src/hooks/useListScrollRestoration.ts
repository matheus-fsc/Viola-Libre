import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Devolve a lista ao ponto exato de leitura quando se volta para ela.
 *
 * Três coisas precisam voltar juntas, e é por isso que isto não é um `scrollTo`:
 *
 * 1. **Quantos itens estavam carregados.** Restaurar a altura de 800 artistas numa lista
 *    que renderizou os 200 primeiros cai no fim do conteúdo, não onde a pessoa estava.
 * 2. **Qual item estava no topo da tela** — e não em que pixel se estava. Pixel é medida
 *    de uma página que não mudou de altura, e a lista muda: some a linha de "carregando",
 *    entram capas, o painel de cima cresce. Voltar 1671px caía dez linhas acima do lugar.
 *    A âncora é o item; o pixel é só a reserva para quem não marcou os itens.
 * 3. **A folga dele em relação ao topo**, para o item voltar recortado do mesmo jeito.
 *
 * ONDE ISSO MORA, e por quê: `sessionStorage`, chaveado pela entrada do histórico
 * (veja `entryKey`).
 *
 * - Não é a URL. "Onde eu tinha parado de ler" é propriedade da *visita*, não da página:
 *   duas pessoas no mesmo link têm posições diferentes, e um link compartilhado com
 *   `?item=39` entregaria a leitura de um estranho. O que descreve a página (busca, aba,
 *   letra) esse sim vive na URL — ali é compartilhável de propósito.
 * - `sessionStorage` e não `localStorage`: isso morre com a aba, como o histórico dela.
 *
 * Para participar, a lista marca cada item com `data-item-lista={índice}`.
 */

type Snapshot = {
  /** Pixel — reserva para lista sem itens marcados. */
  y: number;
  /** Itens renderizados na saída; a lista precisa reabrir com pelo menos isso. */
  count: number;
  /** Índice do item que estava encostando no topo da tela. */
  idx?: number;
  /** Distância entre o topo desse item e o topo da tela (normalmente negativa). */
  delta?: number;
};

const PREFIX = 'viola_lista_';
const ITEM_ATTR = 'data-item-lista';

/** Teto absoluto da espera pela lista se montar, em quadros (~5s a 60fps). */
const MAX_FRAMES = 300;
/** Quadros com o alvo parado que bastam para considerar a página assentada (~0,3s). */
const FRAMES_ESTAVEIS = 20;
/**
 * Espera até a rolagem parar para reler a âncora.
 *
 * Um quadro depois do scroll o layout ainda está se mexendo: os itens com
 * `content-visibility` só trocam a altura estimada pela real ao entrar na tela. Medido no
 * telefone, o item no topo era o #32 a -70px logo após rolar e o #36 a -14px meio segundo
 * depois — gravar no primeiro quadro guardava uma âncora de um layout que deixou de valer,
 * e a volta caía três linhas fora.
 */
const ASSENTAR_MS = 200;

/**
 * Quadros de vigia depois de assentar (~1s).
 *
 * Assentar não é acabar: a grade de artistas usa `content-visibility: auto` com altura
 * estimada, e cada item que entra na tela troca a estimativa pela altura real, empurrando
 * o que está acima. No telefone, com uma coluna só, o erro acumulado de dezenas de linhas
 * deslocava a leitura em três itens depois que a restauração já tinha largado. A vigia
 * segue corrigindo enquanto ninguém encostar na rolagem.
 */
const VIGIA_FRAMES = 60;

/**
 * Identidade da entrada do histórico em que esta lista está.
 *
 * `history.state.idx` (o índice que o React Router mantém na pilha) e NÃO `location.key`:
 * a chave é recriada a cada `replace`, e a lista faz um `replace` por tecla digitada para
 * espelhar a busca na URL — o snapshot ficava órfão antes mesmo de alguém sair da página.
 * O índice é da posição na pilha, que é justamente o que o botão voltar reencontra.
 *
 * O pathname entra junto porque o índice sozinho se repete entre navegações diferentes: a
 * segunda entrada da aba pode ser o explorador hoje e a lista de um artista depois.
 */
function entryKey(pathname: string): string {
  const idx = (window.history.state?.idx ?? 0) as number;
  return `${idx}:${pathname}`;
}

/** A entrada corrente, seja qual for a página — usada para detectar que já se navegou. */
function chaveCorrente(): string {
  return entryKey(window.location.pathname);
}

function useEntryKey(): string {
  const { pathname } = useLocation();
  return entryKey(pathname);
}

function read(key: string): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { y, count, idx, delta } = parsed as Partial<Snapshot>;
    if (typeof y !== 'number' || typeof count !== 'number') return null;
    return {
      y,
      count,
      idx: typeof idx === 'number' ? idx : undefined,
      delta: typeof delta === 'number' ? delta : undefined,
    };
  } catch {
    // Modo privado do Safari, cota estourada, JSON corrompido — nada disso justifica
    // derrubar a lista. Sem snapshot a página simplesmente abre no topo.
    return null;
  }
}

function write(key: string, snap: Snapshot): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(snap));
  } catch { /* idem */ }
}

/** O primeiro item que ainda aparece na tela, com a folga dele em relação ao topo. */
function ancoraVisivel(): Pick<Snapshot, 'idx' | 'delta'> {
  const itens = document.querySelectorAll<HTMLElement>(`[${ITEM_ATTR}]`);
  for (const el of itens) {
    const r = el.getBoundingClientRect();
    if (r.bottom > 0) {
      const idx = Number(el.getAttribute(ITEM_ATTR));
      return Number.isFinite(idx) ? { idx, delta: r.top } : {};
    }
  }
  return {};
}

/** Onde a janela precisa estar para o item `idx` voltar à mesma folga do topo. */
function alvoDaAncora(snap: Snapshot): number | null {
  if (snap.idx === undefined) return null;
  const el = document.querySelector<HTMLElement>(`[${ITEM_ATTR}="${snap.idx}"]`);
  if (!el) return null;
  return Math.max(0, window.scrollY + el.getBoundingClientRect().top - (snap.delta ?? 0));
}

/**
 * Quantos itens a lista precisa renderizar para a posição salva fazer sentido — `null`
 * quando não há o que restaurar, e aí vale o padrão da própria lista.
 *
 * Separado de `useListScrollRestoration` por ordem de chamada, não por capricho: este
 * valor alimenta o hook que produz a lista, que por sua vez produz a contagem que o outro
 * consome. Lendo o snapshot em dois pontos a dependência deixa de ser circular.
 */
export function useRestoredItemCount(): number | null {
  const key = useEntryKey();
  const [count] = useState(() => read(key)?.count ?? null);
  return count && count > 0 ? count : null;
}

/**
 * @param count  quantos itens a lista mostra AGORA (entra no snapshot)
 * @param ready  a lista já renderizou o suficiente para a posição salva valer
 */
export function useListScrollRestoration(count: number, ready: boolean): void {
  const key = useEntryKey();

  // Lido uma única vez, na montagem: depois disso o snapshot é escrito, não lido, e
  // reler traria de volta um valor que a própria página acabou de salvar.
  const [snapshot] = useState<Snapshot | null>(() => read(key));

  const keyRef = useRef(key);
  useEffect(() => { keyRef.current = key; }, [key]);

  const countRef = useRef(count);
  const restaurandoRef = useRef(false);

  const salvar = useCallback(() => {
    // Grava só enquanto a lista AINDA é a página corrente. Ao navegar, a URL muda antes de
    // o React desmontar — e o React Router v7 navega dentro de `startTransition`, então a
    // lista continua montada e ouvindo enquanto a página nova já roda seus efeitos. Um
    // deles é o `scrollTo(0, 0)` da cifra, que chegava aqui como se fosse leitura e zerava
    // a posição salva. Comparar a chave é o que separa rolagem de leitura de rolagem de
    // navegação; sem isso, nenhuma volta caía no lugar certo.
    if (chaveCorrente() !== keyRef.current) return;
    // Durante a própria restauração a janela também rola, e gravar aí seria registrar a
    // posição intermediária de uma página ainda se montando.
    if (restaurandoRef.current) return;
    write(keyRef.current, { y: window.scrollY, count: countRef.current, ...ancoraVisivel() });
  }, []);

  useEffect(() => {
    // O navegador também restaura scroll sozinho ao voltar, e a posição dele é a de quando
    // se saiu — antes de a lista recarregar os itens, portanto sem altura para chegar lá.
    // Deixar os dois agindo é sorteio; `manual` deixa um só no comando.
    const anterior = history.scrollRestoration;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    let raf = 0;
    let assentar = 0;
    const agendar = () => {
      // Duas gravações de propósito. A do quadro seguinte é o piso: barata, e garante uma
      // posição aproximada se a pessoa rolar e clicar num link no mesmo instante. A da
      // parada é a boa, com o layout já assentado — ela sobrescreve a primeira.
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; salvar(); });
      clearTimeout(assentar);
      assentar = setTimeout(salvar, ASSENTAR_MS);
    };
    window.addEventListener('scroll', agendar, { passive: true });
    return () => {
      window.removeEventListener('scroll', agendar);
      cancelAnimationFrame(raf);
      // Cancelar as duas é o que descarta a rolagem ao topo da navegação: o evento dela
      // agenda, e esta limpeza — ainda na mesma tarefa — chega antes de qualquer uma rodar.
      clearTimeout(assentar);
      if ('scrollRestoration' in history) history.scrollRestoration = anterior;
    };
  }, [salvar]);

  // "Exibir mais" cresce a lista sem rolar nada, e a contagem precisa acompanhar: sem isto
  // o snapshot manda de volta menos itens do que havia, e a posição não existe mais.
  useEffect(() => {
    countRef.current = count;
    if (window.scrollY > 0) salvar();
  }, [count, salvar]);

  // A lista chega em etapas — resposta da rede, itens, imagens, fontes — e cada etapa mexe
  // na altura do que está acima da âncora. Por isso a restauração não é um pulo só: ela
  // recalcula o alvo a cada quadro e só larga quando ele para de se mexer, que é quando a
  // página de fato assentou. Desistir por contagem de quadros rolava para o meio de uma
  // lista pela metade.
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current || !snapshot || !ready) return;
    if (!snapshot.y && snapshot.idx === undefined) return;

    restaurandoRef.current = true;
    let interrompido = false;
    const desistir = () => { interrompido = true; };
    const GESTOS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    for (const g of GESTOS) window.addEventListener(g, desistir, { passive: true });

    let frames = 0;
    let estaveis = 0;
    let vigia = 0;
    let ultimoAlvo = -1;
    let raf = 0;

    const encerrar = () => {
      doneRef.current = true;
      restaurandoRef.current = false;
      for (const g of GESTOS) window.removeEventListener(g, desistir);
    };

    const tick = () => {
      // Encostou na rolagem? A pessoa passa na frente. O sinal é a ENTRADA dela, não a
      // variação de `scrollY`: o scroll anchoring do Chrome mexe na posição sozinho
      // sempre que algo acima muda de altura — que é exatamente o que acontece aqui — e
      // inferir intenção a partir disso abortava a restauração no primeiro quadro.
      if (interrompido) {
        encerrar();
        return;
      }

      // Alvo pela âncora; sem item marcado (ou antes de ele existir), cai no pixel salvo
      // limitado ao que a página comporta agora.
      const alcance = document.documentElement.scrollHeight - window.innerHeight;
      const porAncora = alvoDaAncora(snapshot);
      const alvo = porAncora ?? Math.min(snapshot.y, Math.max(0, alcance));

      if (Math.abs(alvo - window.scrollY) > 1) window.scrollTo(0, alvo);

      estaveis = Math.abs(alvo - ultimoAlvo) <= 1 ? estaveis + 1 : 0;
      ultimoAlvo = alvo;

      // Só conta como assentado parado NA âncora: assentar no pixel de reserva enquanto o
      // item ainda não chegou seria dar por boa uma posição que a lista vai desmentir.
      const naAncora = porAncora !== null || snapshot.idx === undefined;
      if (estaveis >= FRAMES_ESTAVEIS && naAncora) vigia++;

      if (vigia >= VIGIA_FRAMES || frames++ >= MAX_FRAMES) {
        encerrar();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      restaurandoRef.current = false;
      for (const g of GESTOS) window.removeEventListener(g, desistir);
    };
  }, [snapshot, ready]);
}
