/*
 * A faixa de navegação de quem está percorrendo uma lista.
 *
 * Aparece duas vezes na mesma cifra, de propósito, porque são dois momentos diferentes:
 * em cima, para quem chegou e já quer pular; no fim, para quem ACABOU de tocar e tem a
 * mão no violão — nesse instante, rolar a página inteira de volta só para achar "próxima"
 * é o que quebra o ritmo de uma roda.
 */
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ListMusic } from 'lucide-react';
import type { PosicaoNaLista } from '../../services/listaAberta';

const botao =
  'bevel-out bg-[var(--color-winxp-panel)] text-black text-xs font-bold flex items-center gap-1 ' +
  'min-h-9 sm:min-h-0 px-2 py-1 sm:py-0.5 hover:bg-white ' +
  'active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white';

/** Ponta da lista: o lugar continua ocupado, apagado, para os botões não dançarem. */
const inerte = 'opacity-35 cursor-default pointer-events-none';

export function BarraDaLista({ pos, posicao }: {
  pos: PosicaoNaLista;
  /** `'topo'` ganha o rótulo por extenso; `'fim'` fecha a cifra e repete a contagem. */
  posicao: 'topo' | 'fim';
}) {
  const rotulo = `${pos.nome} · ${pos.posicao} de ${pos.total}`;

  return (
    <nav
      aria-label={`Navegação da lista ${pos.nome}`}
      className={`bevel-out bg-[var(--color-winxp-panel)] px-2 py-1.5 flex items-center gap-2 shrink-0 ${
        posicao === 'fim' ? 'mt-3' : ''
      }`}
    >
      {/* `aria-disabled` em vez de sumir: um botão que desaparece na última música faria os
          outros dois saltarem de lugar justamente quando a mão vai clicar. */}
      {pos.anterior ? (
        <Link to={pos.anterior} className={botao} title={pos.tituloAnterior ? `Anterior: ${pos.tituloAnterior}` : 'Música anterior da lista'}>
          <ChevronLeft size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Anterior</span>
        </Link>
      ) : (
        <span aria-disabled="true" className={`${botao} ${inerte}`}>
          <ChevronLeft size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Anterior</span>
        </span>
      )}

      {/* O miolo cresce e encolhe; os dois lados têm largura fixa, então o rótulo é quem
          paga a conta da tela estreita — e ele é a parte que dá para truncar sem perder o
          gesto. */}
      <Link
        to={pos.voltarPara}
        className="flex-1 min-w-0 flex items-center justify-center gap-1.5 text-xs text-[#002fa7] hover:underline"
        title={`Voltar para ${pos.nome}`}
      >
        <ListMusic size={13} aria-hidden="true" className="shrink-0" />
        <span className="truncate font-bold">{pos.nome}</span>
        <span className="shrink-0 text-gray-600 font-mono tabular-nums">
          {pos.posicao}/{pos.total}
        </span>
      </Link>

      {pos.proxima ? (
        <Link to={pos.proxima} className={botao} title={pos.tituloProxima ? `Próxima: ${pos.tituloProxima}` : 'Próxima música da lista'}>
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={`${botao} ${inerte}`}>
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      )}

      <span className="sr-only">{rotulo}</span>
    </nav>
  );
}
