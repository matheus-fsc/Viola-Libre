/*
 * /favoritos — a estante pessoal de cifras.
 *
 * Tudo aqui sai do localStorage (ver `services/cifraFavorites.ts`), então a página abre
 * e funciona inteira offline: filtrar, organizar em categorias e exportar não tocam a
 * rede. O servidor entra só como espelho — o sync no primeiro render acrescenta o que
 * está lá e nunca remove o que é local.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Download, Upload, RefreshCw, Search, FolderPlus, Trash2, Pencil, X, ShieldAlert } from 'lucide-react';
import { useCifraFavorites } from '../../hooks/useCifraFavorites';
import {
  countByCategory,
  createCategory,
  deleteCategory,
  downloadFavoritesBackup,
  entryKey,
  foldText,
  importFavoritesBackup,
  offersDifferentIdentity,
  parseImportedFile,
  MAX_FILE_BYTES,
  prettifySlug,
  removeEntry,
  renameCategory,
  syncFavoritesFromServer,
  toggleEntryCategory,
  uncategorizedCount,
  updateStore,
  type FavoriteEntry,
} from '../../services/cifraFavorites';

/** Filtro da barra lateral. Strings livres seriam ambíguas com id de categoria. */
type Selection = { kind: 'all' } | { kind: 'loose' } | { kind: 'category'; id: string };

type SortMode = 'recentes' | 'titulo' | 'artista';

const SORT_LABEL: Record<SortMode, string> = {
  recentes: 'Mais recentes',
  titulo: 'Título (A-Z)',
  artista: 'Artista (A-Z)',
};

const displayArtist = (entry: FavoriteEntry): string => entry.artistName ?? prettifySlug(entry.artistSlug);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A reconciliação de abertura agora roda no App (useFavoritesBootSync), valendo para
  // qualquer rota. Aqui sobrou só o botão "Sincronizar", para quem quiser forçar.

  const counts = useMemo(() => countByCategory(store), [store]);
  const looseCount = useMemo(() => uncategorizedCount(store), [store]);

  const visible = useMemo(() => {
    const needle = foldText(query.trim());
    const filtered = store.entries.filter(entry => {
      if (selection.kind === 'category' && !entry.categoryIds.includes(selection.id)) return false;
      if (selection.kind === 'loose' && entry.categoryIds.length > 0) return false;
      if (!needle) return true;
      return foldText(`${entry.title} ${displayArtist(entry)}`).includes(needle);
    });

    const ordered = [...filtered];
    if (sort === 'titulo') ordered.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    else if (sort === 'artista') ordered.sort((a, b) => displayArtist(a).localeCompare(displayArtist(b), 'pt-BR'));
    else ordered.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return ordered;
  }, [store, selection, query, sort]);

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
          <ToolbarButton onClick={() => setExportOpen(v => !v)} icon={<Download size={11} />}>Exportar</ToolbarButton>
          <ToolbarButton onClick={() => fileInputRef.current?.click()} icon={<Upload size={11} />}>Importar</ToolbarButton>
        </div>
      </div>

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
                />
              )}
              <button
                onClick={() => setEditingCategory(cat.id)}
                title="Renomear categoria"
                className="p-2 lg:p-1 text-gray-600 hover:text-[#002fa7] cursor-pointer shrink-0"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => {
                  updateStore(s => deleteCategory(s, cat.id));
                  setSelection(sel => (sel.kind === 'category' && sel.id === cat.id ? { kind: 'all' } : sel));
                }}
                title="Apagar categoria (as cifras continuam nos favoritos)"
                className="p-2 lg:p-1 text-gray-600 hover:text-[#cc3300] cursor-pointer shrink-0"
              >
                <Trash2 size={11} />
              </button>
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
              {(Object.keys(SORT_LABEL) as SortMode[]).map(mode => (
                <option key={mode} value={mode}>{SORT_LABEL[mode]}</option>
              ))}
            </select>
          </div>

          {store.entries.length === 0 ? (
            <EmptyState onGoToCifras={() => navigate('/cifras')} />
          ) : visible.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-gray-500 italic text-xs px-6">
              Nenhuma cifra nesta categoria corresponde à busca.
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5 overflow-y-auto retro-scrollbar">
              {visible.map(entry => {
                const key = entryKey(entry);
                return (
                  <li key={key} className="border border-[#d4d0c8] hover:bg-[#c2d7f2] transition-colors">
                    <div className="flex items-center gap-2 p-2">
                      <button
                        onClick={() => navigate(`/cifras/${entry.artistSlug}/${entry.songSlug}`)}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                        title="Abrir cifra"
                      >
                        <div className="text-xs font-bold text-[#002fa7] truncate">{entry.title}</div>
                        <div className="text-[10px] text-gray-600 truncate">
                          {displayArtist(entry)}
                          {entry.versionName ? ` · ${entry.versionName}` : ''}
                        </div>
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

function ToolbarButton({ onClick, disabled, icon, children }: {
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1.5 sm:py-0.5 bg-[#ece9d8] text-black text-[11px] font-bold border border-white border-r-[#808080] border-b-[#808080] hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function SidebarItem({ label, count, active, onClick }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-2 py-2 lg:py-1 text-xs cursor-pointer text-left ${
        active ? 'bg-[#0058e6] text-white font-bold' : 'text-black hover:bg-[#c2d7f2]'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`text-[10px] shrink-0 ${active ? 'text-white/80' : 'text-gray-500'}`}>{count}</span>
    </button>
  );
}

function CategoryPicker({ categories, selectedIds, onToggle }: {
  categories: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="bg-[#ece9d8] border-t border-[#808080] p-2 flex flex-wrap gap-x-4 gap-y-1">
      {categories.length === 0 ? (
        <span className="text-[10px] text-gray-600 italic">
          Crie uma categoria na barra lateral primeiro.
        </span>
      ) : (
        categories.map(cat => (
          <label key={cat.id} className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-[#002fa7]">
            <input
              type="checkbox"
              checked={selectedIds.includes(cat.id)}
              onChange={() => onToggle(cat.id)}
              className="cursor-pointer"
            />
            <span>{cat.name}</span>
          </label>
        ))
      )}
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
