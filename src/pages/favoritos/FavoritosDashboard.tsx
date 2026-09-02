/*
 * /favoritos — a estante pessoal de cifras.
 *
 * Tudo aqui sai do localStorage (ver `services/cifraFavorites.ts`), então a página abre
 * e funciona inteira offline: filtrar, organizar em categorias e exportar não tocam a
 * rede. O servidor entra só como espelho — o sync no primeiro render acrescenta o que
 * está lá e nunca remove o que é local.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Download, Upload, RefreshCw, Search, FolderPlus, Trash2, Pencil, X, ShieldAlert, Share2, Copy, Check, Link2, HardDrive } from 'lucide-react';
import { transposeChordString } from '../../engine/chordCalculator';
import { useCifraFavorites } from '../../hooks/useCifraFavorites';
import {
  countByCategory,
  createCategory,
  deleteCategory,
  deleteImportedList,
  downloadFavoritesBackup,
  entryKey,
  foldText,
  importFavoritesBackup,
  isImportedList,
  moveKey,
  planoDeDescarteDaLista,
  offersDifferentIdentity,
  parseImportedFile,
  MAX_FILE_BYTES,
  prettifySlug,
  removeEntry,
  renameCategory,
  setCategoryOrder,
  sortByOrder,
  syncFavoritesFromServer,
  toggleEntryCategory,
  uncategorizedCount,
  updateStore,
  type FavoriteEntry,
  type FavoritesFile,
} from '../../services/cifraFavorites';
import {
  buildSharedFile,
  buildShareUrl,
  comCategoriaDeEntrada,
  decodeLista,
  encodeLista,
  readShareToken,
  AVISO_LINK_CHARS,
  MAX_LINK_CHARS,
} from '../../services/favoritesShare';
import { abrirLista } from '../../services/listaAberta';
import { PainelOffline } from './PainelOffline';

/** Filtro da barra lateral. Strings livres seriam ambíguas com id de categoria. */
type Selection = { kind: 'all' } | { kind: 'loose' } | { kind: 'category'; id: string };

/** Estado da lista que chegou por link. Ver `favoritesShare.ts`. */
type ListaRecebida =
  | { estado: 'lendo' }
  | { estado: 'pronta'; file: FavoritesFile }
  | { estado: 'erro'; error: string };

/**
 * O tom da entrada, como texto para a lista.
 *
 * Só aparece quando a estante sabe alguma coisa a respeito: entradas gravadas antes do
 * campo existir (e as que vieram do servidor, que não guarda tom) não têm tom nenhum
 * registrado, e escrever "original" nelas seria afirmar uma escolha que ninguém fez.
 */
function tomDaEntrada(entry: FavoriteEntry): { texto: string; original: boolean } | null {
  if (!entry.originalKey && entry.transpose === 0) return null;
  if (!entry.originalKey) {
    const sinal = entry.transpose > 0 ? '+' : '';
    return { texto: `${sinal}${entry.transpose} semitons`, original: false };
  }
  const tom = transposeChordString(entry.originalKey, entry.transpose, false) || entry.originalKey;
  return entry.transpose === 0
    ? { texto: `${tom} · original`, original: true }
    : { texto: tom, original: false };
}

/**
 * `manual` só existe dentro de uma categoria: ordenar à mão é dizer "o show começa com
 * esta" — uma frase que não faz sentido sobre a estante inteira, e que precisa de um lugar
 * onde guardar a resposta (o `order` da gaveta).
 */
type SortMode = 'recentes' | 'titulo' | 'artista' | 'manual';

const SORT_LABEL: Record<SortMode, string> = {
  recentes: 'Mais recentes',
  titulo: 'Título (A-Z)',
  artista: 'Artista (A-Z)',
  manual: 'Minha ordem',
};

const displayArtist = (entry: FavoriteEntry): string => entry.artistName ?? prettifySlug(entry.artistSlug);

/**
 * A folha de compartilhamento do próprio sistema — a que abre WhatsApp, Telegram e o resto.
 *
 * Só existe em contexto seguro e nem todo desktop a tem, então o "Copiar" continua sendo o
 * caminho principal e este botão aparece de enfeite quando dá.
 */
const podeCompartilharNativo = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

async function compartilharNativo(url: string): Promise<void> {
  try {
    await navigator.share({ title: 'Meus favoritos no Viola Libre', url });
  } catch {
    // Fechar a folha do sistema rejeita a promessa. Desistir não é erro e não merece aviso.
  }
}

// ---------------------------------------------------------------------------

export function FavoritosDashboard() {
  const navigate = useNavigate();
  const store = useCifraFavorites();

  const [selection, setSelection] = useState<Selection>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recentes');
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'erro'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  /** Só vale abaixo de `lg`; a partir daí o CSS mantém a lateral sempre aberta. */
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  /** Backup à espera da decisão sobre identidade — cru, ainda não aplicado. */
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  /** Gavetas marcadas para ir no link. */
  const [shareCats, setShareCats] = useState<ReadonlySet<string>>(new Set());
  /** As cifras que não estão em gaveta nenhuma entram também? */
  const [shareSoltas, setShareSoltas] = useState(true);
  const [shareNome, setShareNome] = useState('');
  /** Lista que chegou pelo fragmento da URL, à espera de um "sim". */
  const [recebida, setRecebida] = useState<ListaRecebida | null>(null);
  /** Id da lista importada cujo descarte está à espera de confirmação. */
  const [descartando, setDescartando] = useState<string | null>(null);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A reconciliação de abertura agora roda no App (useFavoritesBootSync), valendo para
  // qualquer rota. Aqui sobrou só o botão "Sincronizar", para quem quiser forçar.

  const counts = useMemo(() => countByCategory(store), [store]);
  const looseCount = useMemo(() => uncategorizedCount(store), [store]);

  /**
   * A gaveta aberta, quando há uma.
   *
   * O `useMemo` não é otimização: buscar dentro da store solta no corpo do render faz o
   * React Compiler desistir do componente inteiro ("existing memoization could not be
   * preserved"), porque uma referência para dentro de um estado externo passa a circular
   * pelo render. O mesmo cuidado vale no `CifraViewer` (ver `tomSalvo` lá).
   */
  const categoriaAtiva = useMemo(
    () => (selection.kind === 'category' ? store.categories.find(c => c.id === selection.id) ?? null : null),
    [store, selection]
  );

  /** Como a seleção atual se chama — serve de rótulo à barra de navegação da cifra. */
  const escopoAtual =
    selection.kind === 'all' ? 'Todos os favoritos'
      : selection.kind === 'loose' ? 'Sem categoria'
        : categoriaAtiva?.name ?? 'Categoria';

  // "Minha ordem" fica pendurada no `sort` mesmo depois de sair da gaveta que a tinha; aqui
  // ela só VALE dentro de uma categoria, e fora dela o critério volta a ser o padrão.
  const ordemManual = sort === 'manual' && categoriaAtiva !== null;

  const visible = useMemo(() => {
    const needle = foldText(query.trim());
    const filtered = store.entries.filter(entry => {
      if (selection.kind === 'category' && !entry.categoryIds.includes(selection.id)) return false;
      if (selection.kind === 'loose' && entry.categoryIds.length > 0) return false;
      if (!needle) return true;
      return foldText(`${entry.title} ${displayArtist(entry)}`).includes(needle);
    });

    if (ordemManual) return sortByOrder(filtered, categoriaAtiva?.order);

    const ordered = [...filtered];
    if (sort === 'titulo') ordered.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    else if (sort === 'artista') ordered.sort((a, b) => displayArtist(a).localeCompare(displayArtist(b), 'pt-BR'));
    else ordered.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return ordered;
  }, [store, selection, query, sort, ordemManual, categoriaAtiva?.order]);

  // ── Ordem manual ─────────────────────────────────────────────────────────
  //
  // Reordenar mexe na gaveta INTEIRA, não no que a busca deixou na tela: mover "para a
  // terceira posição" olhando três resultados filtrados escreveria uma ordem que não é a
  // que a pessoa está vendo. Por isso os controles somem enquanto há busca ativa.

  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const podeReordenar = ordemManual && !query.trim();

  const moverPara = (key: string, destino: number) => {
    if (!categoriaAtiva) return;
    const atual = sortByOrder(
      store.entries.filter(e => e.categoryIds.includes(categoriaAtiva.id)),
      categoriaAtiva.order
    ).map(entryKey);
    updateStore(s => setCategoryOrder(s, categoriaAtiva.id, moveKey(atual, key, destino)));
  };

  const soltarSobre = (alvo: string) => {
    const origem = arrastando;
    setArrastando(null);
    setSobre(null);
    if (!origem || origem === alvo) return;
    moverPara(origem, visible.findIndex(e => entryKey(e) === alvo));
  };

  // ── Descartar uma lista que veio por link ────────────────────────────────
  //
  // Confirmação em painel, e não `window.confirm`: um diálogo do navegador não sabe
  // dizer, com número, o que vai sumir e o que vai ficar — e é exatamente essa conta que
  // torna a ação segura de clicar.

  const listaADescartar = descartando
    ? store.categories.find(c => c.id === descartando) ?? null
    : null;

  const confirmarDescarte = () => {
    if (!listaADescartar) return;
    const plano = planoDeDescarteDaLista(store, listaADescartar.id);
    const nome = listaADescartar.name;
    updateStore(s => deleteImportedList(s, listaADescartar.id));
    setSelection(sel => (sel.kind === 'category' && sel.id === listaADescartar.id ? { kind: 'all' } : sel));
    setDescartando(null);
    flash('ok', `Lista “${nome}” descartada — ${plano.removidas} cifra(s) fora dos favoritos, ${plano.mantidas} mantida(s).`);
  };

  /**
   * Abre a cifra levando a lista junto.
   *
   * O que vai é `visible` — a ordem EXATA que a pessoa está vendo, com o filtro, o critério
   * de ordenação e a ordem manual já aplicados. Guardar só o id da categoria daria uma
   * "próxima" que não é a próxima da tela, que é a única que faz sentido para quem está
   * olhando. A busca entra na conta de propósito: quem filtrou por "Almir" e clicou na
   * primeira quer percorrer aquelas, não a gaveta inteira.
   */
  const abrirEsta = (entry: FavoriteEntry) => {
    abrirLista({
      nome: query.trim() ? `${escopoAtual} · "${query.trim()}"` : escopoAtual,
      voltarPara: '/favoritos',
      chaves: visible.map(entryKey),
    });
    navigate(`/cifras/${entry.artistSlug}/${entry.songSlug}`);
  };

  const flash = (tone: 'ok' | 'erro', text: string) => {
    setStatus({ tone, text });
    window.setTimeout(() => setStatus(null), 5000);
  };

  const handleCreateCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    const created = createCategory(store, name);
    updateStore(() => created.store);
    setNewCategory('');
    setSelection({ kind: 'category', id: created.category.id });
  };

  const handleSync = async () => {
    setSyncing(true);
    const before = store.entries.length;
    const next = await syncFavoritesFromServer();
    setSyncing(false);
    const added = next.entries.length - before;
    flash('ok', added > 0 ? `${added} cifra(s) recuperada(s) do servidor.` : 'Tudo já estava sincronizado.');
  };

  const handleExport = (includeIdentity: boolean) => {
    if (store.entries.length === 0) {
      flash('erro', 'Não há favoritos para exportar.');
      return;
    }
    setExportOpen(false);
    downloadFavoritesBackup(includeIdentity);
    flash(
      'ok',
      includeIdentity
        ? 'Backup pessoal baixado. Guarde o arquivo e não compartilhe: quem o importar assume sua identidade.'
        : 'Lista baixada sem identidade — pode compartilhar à vontade.'
    );
  };

  /**
   * Importar tem duas etapas quando o arquivo traz identidade.
   *
   * A lista é fundida sempre (é seguro e é o que o usuário pediu). Adotar o hash do
   * arquivo é irreversível — desliga este navegador dos próprios favoritos no servidor e
   * o liga aos de outra pessoa — então nunca acontece sem um "sim" explícito.
   */
  const handleImportFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      flash('erro', 'Arquivo grande demais para ser uma lista de favoritos.');
      return;
    }

    const raw = await file.text();
    const parsed = parseImportedFile(raw);
    if (!parsed.ok || !parsed.file) {
      flash('erro', parsed.error ?? 'Não foi possível ler o backup.');
      return;
    }

    if (offersDifferentIdentity(parsed.file)) {
      setPendingImport(raw);
      return;
    }
    await runImport(raw, false);
  };

  // ── Compartilhar por link ────────────────────────────────────────────────
  //
  // A escolha do que vai é EXPLÍCITA, marcada gaveta a gaveta no painel. A seleção da
  // barra lateral entra só como sugestão inicial: quem está olhando "Roda de viola" e
  // clica em compartilhar quase sempre quer mandar aquilo, mas quem quer mandar duas
  // gavetas precisa poder dizer isso sem sair criando categoria nova.
  //
  // A busca NÃO entra na conta. Compartilhar logo depois de digitar no campo mandaria uma
  // lista que só existiu por um instante e que ninguém saberia descrever depois.

  const abrirCompartilhar = () => {
    if (shareOpen) { setShareOpen(false); return; }
    setExportOpen(false);
    setOfflineOpen(false);
    if (selection.kind === 'category') {
      setShareCats(new Set([selection.id]));
      setShareSoltas(false);
      // O nome da gaveta já é o nome que a pessoa daria à lista. Sugerir poupa a digitação
      // e continua editável.
      setShareNome(store.categories.find(c => c.id === selection.id)?.name ?? '');
    } else if (selection.kind === 'loose') {
      setShareCats(new Set());
      setShareSoltas(true);
      setShareNome('');
    } else {
      setShareCats(new Set(store.categories.map(c => c.id)));
      setShareSoltas(true);
      setShareNome('');
    }
    setShareOpen(true);
  };

  const alternarCategoriaCompartilhada = (id: string) => {
    setShareCats(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  /**
   * As entradas que vão no link, já podadas.
   *
   * Uma cifra que está em duas gavetas e só uma foi escolhida viaja **sem** a etiqueta da
   * outra: a organização de quem compartilha não é parte da música, e mandar a lista de
   * gavetas junto diria mais sobre a pessoa do que sobre o repertório.
   */
  const paraCompartilhar = useMemo(() => {
    const escolhidas: FavoriteEntry[] = [];
    for (const e of store.entries) {
      if (e.categoryIds.length === 0) {
        if (shareSoltas) escolhidas.push(e);
        continue;
      }
      const mantidas = e.categoryIds.filter(id => shareCats.has(id));
      if (mantidas.length === 0) continue;
      escolhidas.push(mantidas.length === e.categoryIds.length ? e : { ...e, categoryIds: mantidas });
    }
    return escolhidas;
  }, [store, shareCats, shareSoltas]);

  useEffect(() => {
    if (!shareOpen || paraCompartilhar.length === 0) return;
    let cancelado = false;
    setCopiado(false);

    void encodeLista(buildSharedFile(store, paraCompartilhar, shareNome)).then(token => {
      if (cancelado) return;
      if (token.length > MAX_LINK_CHARS) {
        setShareUrl(null);
        setShareError(
          `${paraCompartilhar.length} músicas não cabem num link. Use "Exportar → Lista para ` +
          `compartilhar" e mande o arquivo, ou compartilhe uma categoria de cada vez.`
        );
        return;
      }
      setShareUrl(buildShareUrl(token, window.location.origin));
      setShareError(null);
    });

    return () => { cancelado = true; };
  }, [shareOpen, paraCompartilhar, shareNome, store]);

  const copiarLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão ou fora de contexto seguro. O link está à vista no campo ao lado,
      // então dá para copiar à mão — é isso que a mensagem manda fazer.
      flash('erro', 'O navegador não deixou copiar. Selecione o link e copie à mão.');
    }
  };

  // ── Lista recebida por link ──────────────────────────────────────────────
  //
  // Nada é importado sozinho. Um link é a coisa mais fácil de mandar para alguém sem que
  // a pessoa tenha pedido, então o que ele faz sozinho é MOSTRAR o que traz; somar à
  // estante é um clique de quem recebeu.

  useEffect(() => {
    let cancelado = false;

    const ler = () => {
      const token = readShareToken(window.location.hash);
      if (!token) return;
      setRecebida({ estado: 'lendo' });
      void decodeLista(token).then(r => {
        if (cancelado) return;
        setRecebida(r.ok ? { estado: 'pronta', file: r.file } : { estado: 'erro', error: r.error });
      });
    };

    ler();
    // Chegar num link quando /favoritos JÁ está aberto (colar na barra de endereços, ou
    // clicar num segundo link) muda só o fragmento — o React não remonta nada e a oferta
    // nunca apareceria. `hashchange` é o único aviso que o navegador dá nesse caso.
    window.addEventListener('hashchange', ler);
    return () => {
      cancelado = true;
      window.removeEventListener('hashchange', ler);
    };
  }, []);

  /**
   * Tira o `#lista=…` da barra de endereços depois da decisão.
   *
   * `replaceState` e não `navigate`: mexer só no fragmento não é navegação, e uma entrada
   * nova no histórico faria o botão voltar reabrir a oferta que a pessoa acabou de fechar.
   */
  const limparHash = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };

  const aceitarLista = async (guardarEm: string | null) => {
    if (recebida?.estado !== 'pronta') return;
    const file = guardarEm ? comCategoriaDeEntrada(recebida.file, guardarEm) : recebida.file;
    // De volta a texto para passar pelo MESMO caminho do import por arquivo — com os
    // mesmos tetos e a mesma validação. `adoptIdentity` é falso e não é negociável: o
    // decodificador já jogou fora qualquer identidade que viesse no link.
    const outcome = await importFavoritesBackup(JSON.stringify(file), { adoptIdentity: false, viaLink: true });
    limparHash();
    setRecebida(null);
    flash(
      outcome.ok ? 'ok' : 'erro',
      outcome.ok
        ? `${outcome.added} cifra(s) adicionada(s) à sua estante.`
        : outcome.error ?? 'Não foi possível ler a lista.'
    );
  };

  const descartarLista = () => {
    limparHash();
    setRecebida(null);
  };

  const runImport = async (raw: string, adoptIdentity: boolean) => {
    setPendingImport(null);
    const outcome = await importFavoritesBackup(raw, { adoptIdentity });
    if (!outcome.ok) {
      flash('erro', outcome.error ?? 'Não foi possível ler o backup.');
      return;
    }
    flash(
      'ok',
      `${outcome.added} cifra(s) adicionada(s).` +
        (outcome.identityRestored ? ' Identidade do backup adotada e sincronizada com o servidor.' : '')
    );
  };

  return (
    <div className="p-2 sm:p-4 flex flex-col gap-3 font-mono">
      {/* ── Barra de título ── */}
      <div className="winxp-gradient-blue text-white px-2 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 select-none shrink-0">
        <span className="font-bold text-sm flex items-center gap-1.5 min-w-0 truncate">
          <Heart size={14} className="fill-white" />
          Meus Favoritos ({store.entries.length})
        </span>
        <div className="flex gap-1.5">
          <ToolbarButton onClick={handleSync} disabled={syncing} icon={<RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />}>
            Sincronizar
          </ToolbarButton>
          <ToolbarButton
            onClick={() => { setOfflineOpen(v => !v); setShareOpen(false); setExportOpen(false); }}
            icon={<HardDrive size={11} />}
          >
            No aparelho
          </ToolbarButton>
          <ToolbarButton onClick={abrirCompartilhar} icon={<Share2 size={11} />}>Compartilhar</ToolbarButton>
          <ToolbarButton onClick={() => { setExportOpen(v => !v); setShareOpen(false); setOfflineOpen(false); }} icon={<Download size={11} />}>Exportar</ToolbarButton>
          <ToolbarButton onClick={() => fileInputRef.current?.click()} icon={<Upload size={11} />}>Importar</ToolbarButton>
        </div>
      </div>

      {recebida && (
        <ListaRecebidaPainel
          recebida={recebida}
          categorias={store.categories.length}
          onAceitar={guardarEm => void aceitarLista(guardarEm)}
          onDescartar={descartarLista}
        />
      )}

      {/* A conta é feita na hora de mostrar, não na hora de clicar: é ela que transforma
          uma lixeira num botão que dá para apertar sem medo. */}
      {listaADescartar && (
        <div className="bg-[#fff8e1] border-2 border-[#ff7f27] p-3 flex flex-col gap-2">
          <div className="text-xs font-bold text-[#992200] flex items-center gap-1.5 min-w-0">
            <Trash2 size={13} className="shrink-0" />
            <span className="truncate">Descartar a lista “{listaADescartar.name}”?</span>
          </div>
          {(() => {
            const plano = planoDeDescarteDaLista(store, listaADescartar.id);
            return (
              <ul className="text-[11px] text-gray-800 leading-relaxed list-disc pl-5">
                <li>
                  <strong>{plano.removidas} cifra{plano.removidas === 1 ? '' : 's'}</strong> saem dos
                  seus favoritos — vieram nesta lista e não estão em mais nenhuma.
                </li>
                {plano.mantidas > 0 && (
                  <li>
                    <strong>{plano.mantidas}</strong> continuam na estante: já eram suas antes do
                    link, ou você as guardou em outra categoria.
                  </li>
                )}
              </ul>
            );
          })()}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={confirmarDescarte}
              className="bevel-out bg-[#ece9d8] px-3 py-2 sm:py-1.5 text-xs font-bold text-[#992200] hover:bg-white cursor-pointer active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
            >
              Descartar a lista
            </button>
            <button
              onClick={() => setDescartando(null)}
              className="px-3 py-2 sm:py-1.5 text-xs text-gray-600 hover:text-black cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {offlineOpen && (
        <PainelOffline
          escopo={{
            nome: escopoAtual,
            // O que está na tela AGORA, filtro e ordem incluídos — o mesmo recorte que
            // vira lista ao abrir uma cifra, para o botão não guardar outra coisa.
            chaves: visible.map(entryKey),
            todas: store.entries.map(entryKey),
          }}
          onAviso={flash}
        />
      )}

      {shareOpen && (
        <div className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] p-3 flex flex-col gap-2">
          <div className="text-xs font-bold text-[#002fa7] flex items-center gap-1.5">
            <Link2 size={12} /> Link desta lista
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-700">
              Nome da lista <span className="font-normal text-gray-500">— é o que a pessoa vê antes de importar</span>
            </span>
            <input
              value={shareNome}
              onChange={e => setShareNome(e.target.value)}
              maxLength={60}
              placeholder="Ex.: Roda de terça"
              className="bevel-in bg-white px-2 py-1.5 text-xs outline-none"
            />
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="text-[10px] font-bold text-gray-700 mb-1">O que vai no link</legend>
            <div className="bevel-in bg-white p-2 max-h-32 overflow-y-auto retro-scrollbar flex flex-col gap-1">
              {store.categories.map(cat => (
                <label key={cat.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-[#002fa7]">
                  <input
                    type="checkbox"
                    checked={shareCats.has(cat.id)}
                    onChange={() => alternarCategoriaCompartilhada(cat.id)}
                    className="cursor-pointer"
                  />
                  <span className="truncate">{cat.name}</span>
                  <span className="text-[10px] text-gray-500 ml-auto shrink-0">{counts[cat.id] ?? 0}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-[#002fa7] border-t border-dashed border-[#d4d0c8] pt-1 mt-1">
                <input
                  type="checkbox"
                  checked={shareSoltas}
                  onChange={() => setShareSoltas(v => !v)}
                  className="cursor-pointer"
                />
                <span className="truncate italic text-gray-600">Cifras sem categoria</span>
                <span className="text-[10px] text-gray-500 ml-auto shrink-0">{looseCount}</span>
              </label>
            </div>
            <div className="flex gap-3 text-[10px]">
              <button
                onClick={() => { setShareCats(new Set(store.categories.map(c => c.id))); setShareSoltas(true); }}
                className="text-[#002fa7] hover:underline cursor-pointer"
              >
                Marcar tudo
              </button>
              <button
                onClick={() => { setShareCats(new Set()); setShareSoltas(false); }}
                className="text-gray-600 hover:underline cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </fieldset>

          <p className="text-[10px] text-gray-700 leading-relaxed">
            <strong>{paraCompartilhar.length} cifra{paraCompartilhar.length === 1 ? '' : 's'}</strong> no
            link, com o tom que você escolheu para cada uma e só com as etiquetas das gavetas marcadas
            acima. Quem abrir vê a lista e decide se quer somar à estante dele — nada é importado
            sozinho, e o link não leva a sua identidade.
          </p>

          {paraCompartilhar.length === 0 ? (
            <p className="text-[11px] text-[#992200]">
              Nada marcado — escolha ao menos uma categoria acima.
            </p>
          ) : shareError ? (
            <p className="text-[11px] text-[#992200] leading-relaxed">{shareError}</p>
          ) : !shareUrl ? (
            <p className="text-[11px] text-gray-500 italic">Montando o link…</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                {/* `readOnly` e não `disabled`: o campo precisa continuar selecionável para
                    quem for copiar à mão quando a área de transferência não colaborar. */}
                <input
                  readOnly
                  value={shareUrl}
                  aria-label="Link da lista compartilhada"
                  onFocus={e => e.currentTarget.select()}
                  className="flex-1 min-w-0 bevel-in bg-white px-2 py-1.5 text-[10px] font-mono outline-none"
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => void copiarLink()}
                    className="flex-1 sm:flex-none bevel-out bg-[#ece9d8] px-3 py-2 sm:py-1.5 text-xs font-bold text-black hover:bg-white cursor-pointer flex items-center justify-center gap-1.5 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
                  >
                    {copiado ? <Check size={12} className="text-green-700" /> : <Copy size={12} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                  {podeCompartilharNativo && (
                    <button
                      onClick={() => void compartilharNativo(shareUrl)}
                      className="flex-1 sm:flex-none bevel-out bg-[#ece9d8] px-3 py-2 sm:py-1.5 text-xs font-bold text-black hover:bg-white cursor-pointer flex items-center justify-center gap-1.5 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
                    >
                      <Share2 size={12} /> Enviar
                    </button>
                  )}
                </div>
              </div>

              {shareUrl.length > AVISO_LINK_CHARS && (
                <p className="text-[10px] text-[#992200] leading-relaxed">
                  Link longo ({shareUrl.length} caracteres) — alguns aplicativos de mensagem cortam
                  endereços grandes. Se chegar quebrado do outro lado, mande uma categoria por vez ou
                  use o arquivo de exportar.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {exportOpen && (
        <div className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] p-3 flex flex-col gap-2">
          <div className="text-xs font-bold text-[#002fa7]">Como quer exportar?</div>
          <button
            onClick={() => handleExport(true)}
            className="text-left px-3 py-2 bg-white border border-[#808080] hover:bg-[#c2d7f2] cursor-pointer"
          >
            <div className="text-xs font-bold flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-[#cc3300]" /> Backup pessoal (com identidade)
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              Recupera tudo, inclusive o que está no servidor. <strong>Não compartilhe:</strong> quem
              importar este arquivo passa a ser você para o site.
            </div>
          </button>
          <button
            onClick={() => handleExport(false)}
            className="text-left px-3 py-2 bg-white border border-[#808080] hover:bg-[#c2d7f2] cursor-pointer"
          >
            <div className="text-xs font-bold">Lista para compartilhar (sem identidade)</div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              Só as músicas e categorias. Seguro de mandar para um amigo.
            </div>
          </button>
        </div>
      )}

      {pendingImport && (
        <div className="bg-[#fff8e1] border-2 border-[#ff7f27] p-3 flex flex-col gap-2">
          <div className="text-xs font-bold text-[#992200] flex items-center gap-1.5">
            <ShieldAlert size={13} /> Este backup traz uma identidade diferente
          </div>
          <p className="text-[11px] text-gray-800 leading-relaxed">
            As músicas serão adicionadas de qualquer forma. A pergunta é sobre a identidade:
            adotá-la <strong>desliga este navegador dos seus favoritos atuais no servidor</strong> (sem
            login, não há como recuperá-los depois) e o liga aos do dono do arquivo. Só adote se o
            backup for <strong>seu</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void runImport(pendingImport, false)}
              className="bevel-out bg-[#ece9d8] px-3 py-1.5 text-xs font-bold text-black hover:bg-white cursor-pointer"
            >
              Só as músicas (recomendado)
            </button>
            <button
              onClick={() => void runImport(pendingImport, true)}
              className="bevel-out bg-[#ece9d8] px-3 py-1.5 text-xs font-bold text-[#992200] hover:bg-white cursor-pointer"
            >
              É meu backup — adotar a identidade
            </button>
            <button
              onClick={() => setPendingImport(null)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-black cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          // Zera o input: sem isso, reimportar o MESMO arquivo não dispara `change`.
          e.target.value = '';
          if (file) void handleImportFile(file);
        }}
      />

      {status && (
        <div
          role="status"
          className={`px-3 py-2 text-xs border-2 ${
            status.tone === 'ok'
              ? 'bg-[#e8f4e8] border-[#228b22] text-[#155415]'
              : 'bg-[#fdecea] border-[#cc3300] text-[#992200]'
          }`}
        >
          {status.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 items-start">
        {/* ── Barra lateral: categorias ── */}
        <aside className="w-full lg:w-[240px] shrink-0 bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] p-2 sm:p-3 flex flex-col gap-2">
          {/* Empilhada no telefone, a lista de categorias empurrava as cifras para fora
              da primeira tela. Abaixo de `lg` ela vira um acordeão, fechado por padrão. */}
          <button
            onClick={() => setCategoriesOpen(v => !v)}
            aria-expanded={categoriesOpen}
            className="lg:hidden flex items-center justify-between gap-2 text-xs font-bold text-[#002fa7] py-1.5 cursor-pointer select-none"
          >
            <span>Categorias ({store.categories.length})</span>
            <span className="text-[10px]">{categoriesOpen ? '▲' : '▼'}</span>
          </button>

          <div className="hidden lg:block text-xs font-bold text-[#002fa7] border-b border-dashed border-[#808080] pb-1.5 select-none">
            Categorias
          </div>

          <div className={`${categoriesOpen ? 'flex' : 'hidden'} lg:flex flex-col gap-2 border-t border-dashed border-[#808080] pt-2 lg:border-t-0 lg:pt-0`}>

          <SidebarItem
            label="Todos"
            count={store.entries.length}
            active={selection.kind === 'all'}
            onClick={() => setSelection({ kind: 'all' })}
          />
          <SidebarItem
            label="Sem categoria"
            count={looseCount}
            active={selection.kind === 'loose'}
            onClick={() => setSelection({ kind: 'loose' })}
          />

          {store.categories.length > 0 && <div className="border-t border-dashed border-[#808080] my-1" />}

          {store.categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-1">
              {editingCategory === cat.id ? (
                <input
                  autoFocus
                  aria-label={`Renomear a categoria ${cat.name}`}
                  defaultValue={cat.name}
                  onBlur={e => {
                    const name = e.target.value.trim();
                    if (name) updateStore(s => renameCategory(s, cat.id, name));
                    setEditingCategory(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setEditingCategory(null);
                  }}
                  className="flex-1 min-w-0 px-1.5 py-1 text-xs bg-white border-2 border-[#808080] border-r-white border-b-white outline-none"
                />
              ) : (
                <SidebarItem
                  label={cat.name}
                  count={counts[cat.id] ?? 0}
                  active={selection.kind === 'category' && selection.id === cat.id}
                  onClick={() => setSelection({ kind: 'category', id: cat.id })}
                  icon={isImportedList(cat)
                    ? <Link2 size={10} className="shrink-0 opacity-70" aria-label="Lista recebida por link" />
                    : undefined}
                />
              )}
              <button
                onClick={() => setEditingCategory(cat.id)}
                title="Renomear categoria"
                className="p-2 lg:p-1 text-gray-600 hover:text-[#002fa7] cursor-pointer shrink-0"
              >
                <Pencil size={11} />
              </button>
              {/* Duas lixeiras diferentes, e a diferença importa:
                  • gaveta do usuário → some a gaveta, as cifras ficam nos favoritos.
                  • lista que veio por link → some o pacote inteiro, com as músicas dele.
                  Por isso a segunda passa por confirmação com números, e a primeira não. */}
              {isImportedList(cat) ? (
                <button
                  onClick={() => setDescartando(cat.id)}
                  title="Descartar a lista e as cifras que vieram com ela"
                  aria-label={`Descartar a lista ${cat.name}`}
                  className="p-2 lg:p-1 text-[#cc3300] hover:bg-[#fdecea] cursor-pointer shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    updateStore(s => deleteCategory(s, cat.id));
                    setSelection(sel => (sel.kind === 'category' && sel.id === cat.id ? { kind: 'all' } : sel));
                  }}
                  title="Apagar categoria (as cifras continuam nos favoritos)"
                  aria-label={`Apagar a categoria ${cat.name}`}
                  className="p-2 lg:p-1 text-gray-600 hover:text-[#cc3300] cursor-pointer shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-1 mt-1 pt-2 border-t border-dashed border-[#808080]">
            <input
              aria-label="Nome da nova categoria"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); }}
              placeholder="Nova categoria"
              maxLength={60}
              className="flex-1 min-w-0 px-1.5 py-1 text-xs bg-white border-2 border-[#808080] border-r-white border-b-white outline-none"
            />
            <button
              onClick={handleCreateCategory}
              title="Criar categoria"
              className="bevel-out bg-[#ece9d8] px-3 lg:px-2 text-black hover:bg-white cursor-pointer active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
            >
              <FolderPlus size={12} />
            </button>
          </div>
          </div>
        </aside>

        {/* ── Lista de cifras ── */}
        <section className="flex-1 min-w-0 w-full bg-white border-2 border-[#808080] border-r-white border-b-white p-2 sm:p-3 flex flex-col gap-3 min-h-[320px] sm:min-h-[420px]">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 flex items-center gap-1.5 bg-white border-2 border-[#808080] border-r-white border-b-white px-2">
              <Search size={12} className="text-gray-500 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Buscar nos favoritos por música ou artista"
                placeholder="Buscar por música ou artista"
                className="flex-1 min-w-0 py-1.5 text-xs outline-none bg-transparent"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Limpar busca" className="text-gray-500 hover:text-black cursor-pointer shrink-0">
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortMode)}
              className="text-xs bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] px-2 py-1.5 cursor-pointer"
            >
              {(Object.keys(SORT_LABEL) as SortMode[])
                // "Minha ordem" só entra na lista dentro de uma gaveta: fora dela não há
                // onde guardar a resposta, e um critério que não faz nada é pior que ausente.
                .filter(mode => mode !== 'manual' || categoriaAtiva)
                .map(mode => (
                  <option key={mode} value={mode}>{SORT_LABEL[mode]}</option>
                ))}
            </select>
          </div>

          {ordemManual && (
            <p className="text-[10px] text-gray-600 bg-[#ece9d8] border border-[#d4d0c8] px-2 py-1.5 leading-relaxed">
              {podeReordenar ? (
                <>
                  Arraste pelo <strong>⠿</strong>, use <strong>▲▼</strong> ou digite o número da
                  posição. A ordem vale só em “{categoriaAtiva?.name}”.
                </>
              ) : (
                <>Limpe a busca para reordenar — a ordem é da categoria inteira, não do resultado filtrado.</>
              )}
            </p>
          )}

          {store.entries.length === 0 ? (
            <EmptyState onGoToCifras={() => navigate('/cifras')} />
          ) : visible.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-gray-500 italic text-xs px-6">
              Nenhuma cifra nesta categoria corresponde à busca.
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5 overflow-y-auto retro-scrollbar">
              {visible.map((entry, i) => {
                const key = entryKey(entry);
                return (
                  <li
                    key={key}
                    // O arraste nativo do HTML5 só existe com mouse — no toque ele não
                    // dispara evento nenhum. Por isso ele é o atalho, e os ▲▼ mais o campo
                    // de posição são o caminho que funciona em qualquer aparelho.
                    draggable={podeReordenar}
                    onDragStart={podeReordenar ? () => setArrastando(key) : undefined}
                    onDragEnd={podeReordenar ? () => { setArrastando(null); setSobre(null); } : undefined}
                    onDragOver={podeReordenar ? e => { e.preventDefault(); setSobre(key); } : undefined}
                    onDrop={podeReordenar ? e => { e.preventDefault(); soltarSobre(key); } : undefined}
                    className={`border transition-colors ${
                      sobre === key && arrastando !== key
                        ? 'border-[#0058e6] bg-[#dbe8fb]'
                        : arrastando === key
                          ? 'border-[#d4d0c8] opacity-40'
                          : 'border-[#d4d0c8] hover:bg-[#c2d7f2]'
                    }`}
                  >
                    <div className="flex items-center gap-2 p-2">
                      {podeReordenar && (
                        <ControlesDeOrdem
                          posicao={i}
                          total={visible.length}
                          titulo={entry.title}
                          onMover={destino => moverPara(key, destino)}
                        />
                      )}
                      <button
                        onClick={() => abrirEsta(entry)}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                        title="Abrir cifra"
                      >
                        <div className="text-xs font-bold text-[#002fa7] truncate">{entry.title}</div>
                        <div className="text-[10px] text-gray-600 truncate">
                          {displayArtist(entry)}
                          {entry.versionName ? ` · ${entry.versionName}` : ''}
                        </div>
                        {/* O tom entra na mesma coluna do título porque é informação SOBRE a
                            música, não um controle: quem lê a estante procurando o que tocar
                            hoje quer ver "Lá" junto do nome, não numa coluna à parte. */}
                        {(() => {
                          const tom = tomDaEntrada(entry);
                          if (!tom) return null;
                          return (
                            <div className={`text-[10px] truncate ${tom.original ? 'text-gray-500' : 'text-[#cc3300] font-bold'}`}>
                              Tom: {tom.texto}
                            </div>
                          );
                        })()}
                      </button>

                      <div className="hidden md:flex gap-1 shrink-0 max-w-[45%] overflow-hidden">
                        {entry.categoryIds.map(id => {
                          const cat = store.categories.find(c => c.id === id);
                          return cat ? (
                            <span key={id} className="px-1.5 py-0.5 bg-[#ece9d8] border border-[#808080] text-[9px] whitespace-nowrap">
                              {cat.name}
                            </span>
                          ) : null;
                        })}
                      </div>

                      <button
                        onClick={() => setOpenMenuFor(openMenuFor === key ? null : key)}
                        aria-expanded={openMenuFor === key}
                        className="bevel-out bg-[#ece9d8] px-2 py-2 sm:py-1 text-[10px] font-bold text-black hover:bg-white cursor-pointer shrink-0 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
                        title="Organizar em categorias"
                      >
                        {/* Rótulo curto no telefone: com o título da cifra ao lado, "Categorias"
                            por extenso não cabe numa tela de 360px. */}
                        <span className="sm:hidden">Cat.</span>
                        <span className="hidden sm:inline">Categorias</span>
                      </button>

                      <button
                        onClick={() => updateStore(s => removeEntry(s, entry.artistSlug, entry.songSlug))}
                        title="Remover dos favoritos"
                        className="p-2 sm:p-1.5 text-[#cc3300] hover:bg-[#fdecea] cursor-pointer shrink-0"
                      >
                        <Heart size={14} className="fill-current" />
                      </button>
                    </div>

                    {/* Expande dentro do próprio item em vez de flutuar por cima.
                        Um menu absoluto seria recortado pelo `overflow-y-auto` da lista, e
                        no mobile cairia fora da tela. */}
                    {openMenuFor === key && (
                      <CategoryPicker
                        categories={store.categories}
                        selectedIds={entry.categoryIds}
                        onToggle={id => updateStore(s => toggleEntryCategory(s, key, id))}
                        onFechar={() => setOpenMenuFor(null)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[10px] text-gray-500 border-t border-dashed border-[#808080] pt-2 leading-relaxed">
            Seus favoritos ficam salvos neste navegador e funcionam offline. Como o site não tem
            login, <strong>exportar é a única forma de não perdê-los</strong> ao limpar o navegador ou
            trocar de aparelho. O backup pessoal leva sua identidade junto — trate-o como uma senha e
            use a opção "para compartilhar" quando for mandar a lista para alguém.
          </p>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

/**
 * A oferta de uma lista que chegou por link.
 *
 * Mostra ANTES de somar, e mostra o suficiente para a pessoa reconhecer o que recebeu:
 * quantas músicas, que gavetas vêm junto, e uma amostra dos títulos. Sem isso o clique em
 * "adicionar" seria um voto de confiança num link que pode ter vindo de qualquer lugar.
 *
 * Todo texto daqui é conteúdo de terceiro. Sai em nó de texto do JSX, que o React escapa —
 * um título com `<script>` dentro aparece escrito, não executado.
 */
function ListaRecebidaPainel({ recebida, categorias, onAceitar, onDescartar }: {
  recebida: ListaRecebida;
  categorias: number;
  onAceitar: (guardarEm: string | null) => void;
  onDescartar: () => void;
}) {
  if (recebida.estado === 'lendo') {
    return (
      <div className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] p-3 text-[11px] text-gray-600 italic">
        Lendo a lista que veio no link…
      </div>
    );
  }

  if (recebida.estado === 'erro') {
    return (
      <div className="bg-[#fff8e1] border-2 border-[#ff7f27] p-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-[#992200]">{recebida.error}</span>
        <button onClick={onDescartar} className="px-3 py-1.5 text-xs text-gray-600 hover:text-black cursor-pointer">
          Fechar
        </button>
      </div>
    );
  }

  // Componente à parte, e não um terceiro ramo aqui, porque a oferta tem estado próprio
  // (a gaveta de destino) e os `useState` não podem ficar depois dos `return` acima.
  return (
    <OfertaDeLista
      file={recebida.file}
      categorias={categorias}
      onAceitar={onAceitar}
      onDescartar={onDescartar}
    />
  );
}

/** A lista decodificada, com o que ela é e para onde vai, antes de virar estante. */
function OfertaDeLista({ file, categorias, onAceitar, onDescartar }: {
  file: FavoritesFile;
  categorias: number;
  onAceitar: (guardarEm: string | null) => void;
  onDescartar: () => void;
}) {
  const { entries, categories, listName } = file;
  const AMOSTRA = 8;

  /**
   * Guardar tudo numa gaveta só, com o nome que veio no link.
   *
   * Ligado por padrão quando há nome: sem isso, doze cifras de um link cairiam soltas no
   * meio de uma estante que já tem duzentas, e o rótulo que a pessoa deu à lista morreria
   * nesta tela. Sem nome não há o que sugerir, e as músicas entram como sempre entraram.
   */
  const [guardarEmGaveta, setGuardarEmGaveta] = useState(Boolean(listName));
  const [nomeGaveta, setNomeGaveta] = useState(listName ?? '');

  return (
    <div className="bg-[#e8f0fe] border-2 border-[#0058e6] p-3 flex flex-col gap-2">
      <div className="text-xs font-bold text-[#002fa7] flex items-center gap-1.5 min-w-0">
        <Link2 size={13} className="shrink-0" />
        <span className="truncate">
          {listName ? `Lista compartilhada: “${listName}”` : 'Alguém compartilhou uma lista com você'}
        </span>
      </div>

      <p className="text-[11px] text-gray-800 leading-relaxed">
        São <strong>{entries.length} cifra{entries.length === 1 ? '' : 's'}</strong>
        {categories.length > 0 && <> em {categories.length} categoria{categories.length === 1 ? '' : 's'} ({categories.map(c => c.name).join(', ')})</>}.
        Adicionar <strong>soma</strong> à sua estante: nada do que já está lá é apagado ou trocado
        {categorias > 0 && ', e as categorias com o mesmo nome viram uma só'}.
      </p>

      <ul className="bevel-in bg-white max-h-32 overflow-y-auto retro-scrollbar p-2 flex flex-col gap-0.5">
        {entries.slice(0, AMOSTRA).map(e => (
          <li key={`${e.artistSlug}/${e.songSlug}`} className="text-[10px] text-gray-700 truncate">
            <span className="font-bold text-[#002fa7]">{e.title}</span>
            {e.artistName ? ` — ${e.artistName}` : ''}
          </li>
        ))}
        {entries.length > AMOSTRA && (
          <li className="text-[10px] text-gray-500 italic">e mais {entries.length - AMOSTRA}…</li>
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={guardarEmGaveta}
            onChange={() => setGuardarEmGaveta(v => !v)}
            className="cursor-pointer"
          />
          Guardar numa categoria:
        </label>
        <input
          value={nomeGaveta}
          onChange={e => setNomeGaveta(e.target.value)}
          disabled={!guardarEmGaveta}
          maxLength={60}
          aria-label="Nome da categoria onde guardar a lista recebida"
          placeholder="Nome da categoria"
          className="flex-1 min-w-[8rem] bevel-in bg-white px-2 py-1 text-xs outline-none disabled:opacity-50 disabled:bg-[#ece9d8]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onAceitar(guardarEmGaveta && nomeGaveta.trim() ? nomeGaveta : null)}
          className="bevel-out bg-[#ece9d8] px-3 py-2 sm:py-1.5 text-xs font-bold text-black hover:bg-white cursor-pointer active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
        >
          Adicionar aos meus favoritos
        </button>
        <button onClick={onDescartar} className="px-3 py-2 sm:py-1.5 text-xs text-gray-600 hover:text-black cursor-pointer">
          Agora não
        </button>
      </div>
    </div>
  );
}

/**
 * O rótulo é `string` e não `ReactNode` de propósito: abaixo de `sm` ele some da tela e o
 * botão fica só com o ícone. Sem `aria-label` — e sem `title`, que serve ao mouse — os
 * quatro botões da barra viravam "botão, botão, botão, botão" no leitor de tela do
 * telefone, exatamente onde o texto não está lá para desempatar.
 */
function ToolbarButton({ onClick, disabled, icon, children }: {
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={children}
      title={children}
      className="px-2.5 py-1.5 sm:py-0.5 bg-[#ece9d8] text-black text-[11px] font-bold border border-white border-r-[#808080] border-b-[#808080] hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

/**
 * Punho de arraste, setas e o número da posição — as três formas de mudar a ordem.
 *
 * São três porque nenhuma sozinha serve a todo mundo: o arraste é o gesto natural com
 * mouse mas não existe no toque; as setas funcionam em tudo e no teclado, mas mover a
 * décima para o primeiro lugar custa nove toques; o número resolve o salto longo, que é
 * justamente o caso em que as setas cansam.
 *
 * O campo é `text` com `inputMode="numeric"` e não `type="number"`: as setinhas nativas
 * roubariam largura de um campo de 2 caracteres, e a roda do mouse sobre um `number`
 * focado muda o valor sem querer — dentro de uma lista que rola, isso é um desastre.
 */
function ControlesDeOrdem({ posicao, total, titulo, onMover }: {
  posicao: number;
  total: number;
  titulo: string;
  onMover: (destino: number) => void;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);

  const aplicar = () => {
    const n = Number(rascunho);
    setRascunho(null);
    if (!Number.isFinite(n) || n < 1) return;
    onMover(Math.min(total, Math.round(n)) - 1);
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <span
        // `cursor-grab` sem `onMouseDown`: quem arrasta é o `<li>`, que é o elemento com
        // `draggable`. Este punho existe para dizer ONDE pegar.
        aria-hidden="true"
        className="text-gray-400 text-sm leading-none cursor-grab select-none px-0.5"
        title="Arraste para reordenar"
      >
        ⠿
      </span>
      <input
        value={rascunho ?? String(posicao + 1)}
        onChange={e => setRascunho(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onFocus={e => e.currentTarget.select()}
        onBlur={aplicar}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setRascunho(null); e.currentTarget.blur(); }
        }}
        inputMode="numeric"
        aria-label={`Posição de ${titulo} na categoria, de 1 a ${total}`}
        className="bevel-in bg-white w-8 px-1 py-1 sm:py-0.5 text-[10px] text-center font-mono outline-none"
      />
      <div className="flex flex-col">
        <button
          onClick={() => onMover(posicao - 1)}
          disabled={posicao === 0}
          aria-label={`Subir ${titulo}`}
          className="px-1 text-[8px] leading-none text-gray-600 hover:text-[#002fa7] disabled:opacity-25 disabled:cursor-default cursor-pointer"
        >
          ▲
        </button>
        <button
          onClick={() => onMover(posicao + 1)}
          disabled={posicao >= total - 1}
          aria-label={`Descer ${titulo}`}
          className="px-1 text-[8px] leading-none text-gray-600 hover:text-[#002fa7] disabled:opacity-25 disabled:cursor-default cursor-pointer"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

function SidebarItem({ label, count, active, onClick, icon }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  /** Marca de origem — hoje só o elo das listas que chegaram por link. */
  icon?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-2 py-2 lg:py-1 text-xs cursor-pointer text-left ${
        active ? 'bg-[#0058e6] text-white font-bold' : 'text-black hover:bg-[#c2d7f2]'
      }`}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className={`text-[10px] shrink-0 ${active ? 'text-white/80' : 'text-gray-500'}`}>{count}</span>
    </button>
  );
}

/**
 * As gavetas de uma cifra.
 *
 * Continua ancorado DENTRO do item, e não flutuando por cima: a lista tem `overflow-y-auto`
 * e um popover absoluto seria recortado por ela. O que mudou foi onde ele nasce e como
 * cada opção se comporta:
 *
 *   • encostado à DIREITA, embaixo do botão que o abriu. Espalhado na largura toda, as
 *     caixinhas ficavam na borda esquerda da tela e o mouse tinha que atravessar o item
 *     inteiro para voltar — num monitor largo, um trajeto absurdo para marcar "Estudar".
 *   • uma opção por LINHA, e a linha inteira é o alvo. Antes o clique só valia no
 *     quadradinho de 13px e no texto colado nele; agora o `<label>` ocupa a faixa.
 */
function CategoryPicker({ categories, selectedIds, onToggle, onFechar }: {
  categories: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onFechar: () => void;
}) {
  return (
    <div className="bg-[#ece9d8] border-t border-[#808080] p-2 flex justify-end">
      <div className="w-full sm:w-64 sm:max-w-full bevel-out bg-[#ece9d8] p-1">
        <div className="flex items-center justify-between px-1.5 py-1 border-b border-dashed border-[#808080] mb-1">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Categorias</span>
          <button onClick={onFechar} aria-label="Fechar seletor de categorias" className="text-gray-500 hover:text-black cursor-pointer">
            <X size={11} aria-hidden="true" />
          </button>
        </div>
        {categories.length === 0 ? (
          <span className="block px-1.5 py-1 text-[10px] text-gray-600 italic">
            Crie uma categoria na barra lateral primeiro.
          </span>
        ) : (
          <div className="max-h-44 overflow-y-auto retro-scrollbar flex flex-col">
            {categories.map(cat => (
              <label
                key={cat.id}
                className={`flex items-center gap-2 px-1.5 py-2 sm:py-1 text-xs cursor-pointer ${
                  selectedIds.includes(cat.id) ? 'bg-[#dbe8fb] font-bold' : 'hover:bg-[#c2d7f2]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(cat.id)}
                  onChange={() => onToggle(cat.id)}
                  className="cursor-pointer shrink-0"
                />
                <span className="truncate">{cat.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onGoToCifras }: { onGoToCifras: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6 py-12">
      <Heart size={28} className="text-gray-300" />
      <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
        Nenhuma cifra favoritada ainda. Abra uma cifra e clique em <strong>Favoritar</strong> —
        ela aparece aqui e você pode organizá-la em categorias.
      </p>
      <button
        onClick={onGoToCifras}
        className="bevel-out bg-[#ece9d8] px-4 py-1.5 text-xs font-bold text-black hover:bg-white cursor-pointer active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
      >
        Procurar cifras
      </button>
    </div>
  );
}
