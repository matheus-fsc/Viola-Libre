/*
 * "Levar os favoritos no bolso" — guardar as cifras no aparelho.
 *
 * A promessa aqui é modesta de propósito, e o texto da tela diz isso: guardar as cifras
 * faz elas abrirem na hora e continuarem legíveis se a rede cair NO MEIO do uso. Não
 * transforma o site num aplicativo que abre do zero sem internet — para isso seria preciso
 * um service worker, que este projeto não tem. Prometer "offline" inteiro e entregar tela
 * branca no sítio sem sinal seria pior do que não oferecer nada.
 *
 * É TUDO OU NADA, E DE PROPÓSITO
 *
 * A primeira versão deixava escolher gaveta por gaveta. Medida a estante real, isso era
 * complexidade sem troco: a cifra pesa ~10 KB e uma estante inteira de cem músicas dá
 * ~1 MB, contra os GB que o navegador oferece. Escolher o que cabe só faz sentido quando
 * algo não cabe — aqui cabe tudo, então a pergunta certa é uma só: guarda ou não guarda.
 */
import { useState } from 'react';
import { HardDrive, Download, Trash2, Check, Loader } from 'lucide-react';
import {
  apagarCifras,
  formatarBytes,
  gravarPreferencia,
  lerPreferencia,
  temCache,
  type PreferenciaOffline,
} from '../../services/cifraCache';
import { estimarTamanho, type CacheDeCifras } from './useCacheDeCifras';

const botao =
  'bevel-out bg-[#ece9d8] px-3 py-2 sm:py-1.5 text-xs font-bold text-black hover:bg-white cursor-pointer ' +
  'flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ' +
  'active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white';

// ---------------------------------------------------------------------------

/**
 * O convite da primeira visita.
 *
 * Aparece uma vez, e responder "agora não" é resposta definitiva — a pergunta não volta.
 * O caminho para mudar de ideia fica dito na própria frase, senão "não" viraria uma porta
 * trancada para um recurso que a pessoa talvez quisesse depois.
 */
export function ConviteOffline({ quantas, ocupara, onResponder, ocupado }: {
  quantas: number;
  ocupara: string;
  onResponder: (v: PreferenciaOffline) => void;
  ocupado: boolean;
}) {
  return (
    <div className="bg-[#e8f0fe] border-2 border-[#0058e6] p-3 flex flex-col gap-2">
      <div className="text-xs font-bold text-[#002fa7] flex items-center gap-1.5">
        <HardDrive size={13} /> Guardar seus favoritos no aparelho?
      </div>
      <p className="text-[11px] text-gray-800 leading-relaxed">
        Suas <strong>{quantas} cifra{quantas === 1 ? '' : 's'}</strong> ficam guardadas aqui
        (~{ocupara}) e passam a abrir <strong>na hora</strong>, inclusive o "Próxima" de
        dentro da música — e continuam legíveis se a internet cair no meio do uso. Os
        favoritos novos são guardados sozinhos daí em diante.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => onResponder('sim')} disabled={ocupado} className={botao}>
          {ocupado ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
          Sim, guardar
        </button>
        <button
          onClick={() => onResponder('nao')}
          disabled={ocupado}
          className="px-3 py-2 sm:py-1.5 text-xs text-gray-600 hover:text-black cursor-pointer disabled:opacity-50"
        >
          Agora não
        </button>
        <span className="text-[10px] text-gray-500">dá para mudar em "No aparelho"</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PainelOffline({ cache, total, onAviso }: {
  cache: CacheDeCifras;
  /** Quantas cifras há na estante inteira. */
  total: number;
  onAviso: (tom: 'ok' | 'erro', texto: string) => void;
}) {
  const [pref, setPref] = useState<PreferenciaOffline | null>(lerPreferencia);
  const { resumo, espaco, progresso, faltam } = cache;

  if (!temCache()) {
    return (
      <div className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] p-3 text-[11px] text-gray-700">
        Este navegador não deixa guardar cifras no aparelho (costuma ser o caso em janela
        anônima). As cifras continuam abrindo normalmente com internet.
      </div>
    );
  }

  const baixar = async () => {
    const r = await cache.baixarTudo();
    if (!r) return;
    if (r.cancelado) {
      onAviso('ok', `Interrompido — ${r.baixadas} cifra(s) já ficaram guardadas.`);
      return;
    }
    // A falha é informada, não escondida: numa estante de quarenta, saber que duas não
    // vieram é a diferença entre confiar no que está no bolso e descobrir no sítio, sem sinal.
    onAviso(
      r.falhas > 0 ? 'erro' : 'ok',
      r.falhas > 0
        ? `${r.baixadas} guardada(s), ${r.falhas} não encontrada(s) no acervo.`
        : `${r.baixadas} cifra(s) guardadas — ${formatarBytes(r.bytes)} no aparelho.`
    );
  };

  const limpar = async () => {
    const chaves = [...cache.guardadas];
    await apagarCifras(chaves);
    cache.medir();
    onAviso('ok', `${chaves.length} cifra(s) apagadas do aparelho.`);
  };

  const trocarPreferencia = (v: PreferenciaOffline) => {
    gravarPreferencia(v);
    setPref(v);
    if (v === 'sim' && faltam > 0) void baixar();
  };

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
          <strong>{resumo?.itens ?? 0}</strong> de {total} cifra{total === 1 ? '' : 's'} ·{' '}
          <strong>{formatarBytes(resumo?.bytes ?? 0)}</strong>
        </span>
        {espaco && (
          <span className="text-gray-500">
            o navegador oferece {formatarBytes(espaco.total)} para este site
          </span>
        )}
      </div>

      <label className="flex items-center gap-2 text-[11px] cursor-pointer">
        <input
          type="checkbox"
          checked={pref === 'sim'}
          onChange={e => trocarPreferencia(e.target.checked ? 'sim' : 'nao')}
          className="cursor-pointer"
        />
        Guardar meus favoritos automaticamente
      </label>

      {progresso ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <Loader size={12} className="animate-spin shrink-0" />
            <span>Guardando {progresso.feitas} de {progresso.total}…</span>
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
          <button onClick={cache.parar} className={`${botao} self-start`}>Parar</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void baixar()}
            disabled={faltam === 0}
            className={botao}
            title={faltam === 0 ? 'Toda a sua estante já está guardada' : 'Guardar todos os favoritos no aparelho'}
          >
            {faltam === 0 ? <Check size={12} className="text-green-700" /> : <Download size={12} />}
            {faltam === 0 ? 'Tudo já está no aparelho' : `Guardar todos (${faltam}, ~${estimarTamanho(faltam)})`}
          </button>

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
