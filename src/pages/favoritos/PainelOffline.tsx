/*
 * "Levar a lista no bolso" — baixar cifras para o aparelho.
 *
 * A promessa aqui é modesta de propósito, e o texto da tela diz isso: guardar as cifras
 * faz elas abrirem na hora e continuarem legíveis se a rede cair NO MEIO do uso. Não
 * transforma o site num aplicativo que abre do zero sem internet — para isso seria preciso
 * um service worker, que este projeto não tem. Prometer "offline" inteiro e entregar tela
 * branca no sítio sem sinal seria pior do que não oferecer nada.
 */
import { useEffect, useRef, useState } from 'react';
import { HardDrive, Download, Trash2, Check, Loader } from 'lucide-react';
import {
  espacoDoNavegador,
  formatarBytes,
  resumoDoCache,
  apagarCifras,
  temCache,
  BYTES_POR_CIFRA_ESTIMADO,
} from '../../services/cifraCache';
import { baixarLista, type ProgressoDownload } from '../../services/baixarLista';

export interface EscopoOffline {
  /** Rótulo do que está selecionado: "Roda de terça", "Todos os favoritos". */
  nome: string;
  /** As chaves `artista/musica` da seleção atual. */
  chaves: string[];
  /** Todas as chaves da estante, para o "salvar tudo". */
  todas: string[];
}

const botao =
  'bevel-out bg-[#ece9d8] px-3 py-2 sm:py-1.5 text-xs font-bold text-black hover:bg-white cursor-pointer ' +
  'flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ' +
  'active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white';

export function PainelOffline({ escopo, onAviso }: {
  escopo: EscopoOffline;
  onAviso: (tom: 'ok' | 'erro', texto: string) => void;
}) {
  const [resumo, setResumo] = useState<{ chaves: Set<string>; itens: number; bytes: number } | null>(null);
  const [espaco, setEspaco] = useState<{ usado: number; total: number } | null>(null);
  const [progresso, setProgresso] = useState<ProgressoDownload | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const medir = () => {
    void resumoDoCache().then(setResumo);
    void espacoDoNavegador().then(setEspaco);
  };

  useEffect(() => {
    // O ResizeObserver não serve aqui: o que muda é o disco, não o layout. A medição
    // acontece na montagem e depois de cada download ou limpeza.
    void resumoDoCache().then(setResumo);
    void espacoDoNavegador().then(setEspaco);
    return () => abortRef.current?.abort();
  }, []);

  if (!temCache()) {
    return (
      <div className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] p-3 text-[11px] text-gray-700">
        Este navegador não deixa guardar cifras no aparelho (costuma ser o caso em janela
        anônima). As cifras continuam abrindo normalmente com internet.
      </div>
    );
  }

  const guardadas = resumo?.chaves ?? new Set<string>();
  const naSelecao = escopo.chaves.filter(c => guardadas.has(c)).length;
  const faltamSelecao = escopo.chaves.length - naSelecao;
  const faltamTodas = escopo.todas.filter(c => !guardadas.has(c)).length;

  const baixar = async (chaves: string[], rotulo: string) => {
    if (chaves.length === 0) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgresso({ feitas: 0, total: chaves.length, falhas: 0 });

    const r = await baixarLista(chaves, setProgresso, ctrl.signal);
    setProgresso(null);
    abortRef.current = null;
    medir();

    if (r.cancelado) {
      onAviso('ok', `Download interrompido — ${r.baixadas} cifra(s) já ficaram guardadas.`);
      return;
    }
    // A falha é informada, não escondida: numa lista de quarenta, saber que duas não vieram
    // é a diferença entre confiar no que está no bolso e descobrir no sítio, sem sinal.
    onAviso(
      r.falhas > 0 ? 'erro' : 'ok',
      r.falhas > 0
        ? `${rotulo}: ${r.baixadas} guardada(s), ${r.falhas} não encontrada(s) no acervo.`
        : `${rotulo}: ${r.baixadas} cifra(s) guardadas — ${formatarBytes(r.bytes)} no aparelho.`
    );
  };

  const limpar = async () => {
    const chaves = [...guardadas];
    await apagarCifras(chaves);
    medir();
    onAviso('ok', `${chaves.length} cifra(s) apagadas do aparelho.`);
  };

  const estimativa = (n: number) => formatarBytes(n * BYTES_POR_CIFRA_ESTIMADO);

  return (
    <div className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] p-3 flex flex-col gap-2">
      <div className="text-xs font-bold text-[#002fa7] flex items-center gap-1.5">
        <HardDrive size={12} /> Cifras guardadas no aparelho
      </div>

      <p className="text-[10px] text-gray-700 leading-relaxed">
        Guardar faz a cifra abrir <strong>na hora</strong> — inclusive o "Próxima" de dentro
        da música — e continuar legível se a internet cair no meio do uso. Não substitui a
        internet para <em>abrir o site</em>: para isso o navegador ainda precisa de sinal na
        primeira carga.
      </p>

      <div className="bevel-in bg-white px-2 py-1.5 text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          <strong>{resumo?.itens ?? 0}</strong> cifra{resumo?.itens === 1 ? '' : 's'} ·{' '}
          <strong>{formatarBytes(resumo?.bytes ?? 0)}</strong>
        </span>
        {espaco && (
          <span className="text-gray-500">
            o navegador oferece {formatarBytes(espaco.total)} para este site
          </span>
        )}
      </div>

      {progresso ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <Loader size={12} className="animate-spin shrink-0" />
            <span>Baixando {progresso.feitas} de {progresso.total}…</span>
            {progresso.falhas > 0 && <span className="text-[#992200]">({progresso.falhas} falhou)</span>}
          </div>
          {/* Barra em `div`, não `<progress>`: o elemento nativo ignora a moldura do tema
              XP em quase todo navegador, e aqui ela é o que faz a peça pertencer à tela. */}
          <div className="bevel-in bg-white h-3 overflow-hidden">
            <div
              className="h-full bg-[#316ac5] transition-all duration-150"
              style={{ width: `${Math.round((progresso.feitas / Math.max(1, progresso.total)) * 100)}%` }}
            />
          </div>
          <button onClick={() => abortRef.current?.abort()} className={`${botao} self-start`}>
            Parar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void baixar(escopo.chaves, escopo.nome)}
            disabled={faltamSelecao === 0}
            className={botao}
            title={faltamSelecao === 0
              ? `Todas as ${escopo.chaves.length} cifras de "${escopo.nome}" já estão guardadas`
              : `Guardar as cifras de "${escopo.nome}" no aparelho`}
          >
            {/* Guardado, o nome da seleção sai do rótulo: ele já está na barra lateral e no
                título do painel, e repetido aqui só servia para truncar no meio da palavra.
                Na hora de BAIXAR ele fica, porque aí é o que diz o que se está baixando. */}
            {faltamSelecao === 0 ? <Check size={12} className="text-green-700" /> : <Download size={12} />}
            <span className="truncate max-w-[18rem]">
              {faltamSelecao === 0
                ? 'Já está no aparelho'
                : `Salvar ${escopo.nome} (${faltamSelecao}, ~${estimativa(faltamSelecao)})`}
            </span>
          </button>

          {/* Só aparece quando "salvar tudo" significa mais do que o botão ao lado já faz. */}
          {faltamTodas > faltamSelecao && (
            <button onClick={() => void baixar(escopo.todas, 'Todos os favoritos')} className={botao}>
              <Download size={12} />
              Salvar tudo ({faltamTodas}, ~{estimativa(faltamTodas)})
            </button>
          )}

          {(resumo?.itens ?? 0) > 0 && (
            <button onClick={() => void limpar()} className={`${botao} text-[#992200]`}>
              <Trash2 size={12} />
              Apagar as guardadas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
