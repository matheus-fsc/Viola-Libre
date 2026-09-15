/*
 * O painel de controle do site.
 *
 * Todas as escolhas de quem visita moravam espalhadas pelo lugar onde por acaso foram
 * criadas: o instrumento na barra lateral do Dicionário de Acordes, a notação dentro do
 * editor de acordes, a ordem das cordas num popup que só aparece uma vez na vida, e a
 * autorização do YouTube no meio da Política de Privacidade. Cada uma dessas telas é um
 * bom lugar para DECIDIR na hora, e um péssimo lugar para REVER a decisão depois: quem
 * quer trocar não lembra por onde entrou.
 *
 * Aqui elas aparecem juntas, e as telas de origem continuam funcionando. Um seletor que
 * escreve na mesma store aparece nos dois lugares e concorda consigo mesmo.
 *
 * Nada nesta página vai para o servidor. Tudo é localStorage, e é por isso que a página
 * não é indexável (ver `src/utils/seoRoutes.ts`): para o rastreador ela é uma casca.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Instrument } from '../../engine/types';
import { PRESET_INSTRUMENTS } from '../../engine/tunings';
import { SeletorDeIdioma } from '../../components/SeletorDeIdioma';
import { SeletorDeNotacao } from '../../components/SeletorDeNotacao';
import { YouTubeJsConsentControl } from '../../components/YouTubeJsGate';
import { useVisualizationStore } from '../../stores/useVisualizationStore';
import { useT } from '../../i18n';

interface Props {
  /** O instrumento em uso agora, para o painel abrir marcando o certo. */
  instrument: Instrument;
  /**
   * Trocar aqui muda o app inteiro E grava a preferência, que é o que separa esta tela
   * do seletor da barra lateral: lá a troca é um experimento e dura a sessão, aqui é uma
   * decisão e sobrevive ao fechar o navegador.
   */
  onInstrumentChange: (inst: Instrument) => void;
}

/** Moldura de uma seção, no formato de painel do XP. */
const Secao: React.FC<{ titulo: string; nota?: string; children: React.ReactNode }> = ({ titulo, nota, children }) => (
  <section className="bg-[#ece9d8] bevel-out">
    <h2 className="winxp-gradient-blue text-white px-2 py-0.5 font-bold text-xs select-none">
      {titulo}
    </h2>
    <div className="p-2 flex flex-col gap-2">
      {nota && <p className="text-[11px] text-gray-600 leading-snug">{nota}</p>}
      {children}
    </div>
  </section>
);

/**
 * Botão de escolha reutilizado pelo instrumento e pela ordem das cordas.
 *
 * Mesma anatomia dos botões do SeletorDeIdioma e do SeletorDeNotacao (rótulo em cima,
 * legenda pequena embaixo, azul quando escolhido), porque um painel de preferências em
 * que cada linha se comporta de um jeito diferente é um painel que ninguém varre com os
 * olhos.
 */
const Opcao: React.FC<{
  rotulo: string;
  legenda?: string;
  selecionado: boolean;
  onClick: () => void;
}> = ({ rotulo, legenda, selecionado, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selecionado}
    className={`flex-1 min-w-0 basis-[7rem] flex flex-col items-center justify-center gap-0.5 px-2 py-2 border leading-none cursor-pointer ${
      selecionado
        ? 'bg-[#316ac5] text-white border-[#316ac5]'
        : 'bg-[#ece9d8] border-gray-400 text-black hover:bg-white'
    }`}
    title={rotulo}
  >
    <span className="text-[11px] font-bold truncate max-w-full">{rotulo}</span>
    {legenda && (
      <span className={`text-[8px] font-normal truncate max-w-full ${selecionado ? 'text-white/75' : 'text-gray-500'}`}>
        {legenda}
      </span>
    )}
  </button>
);

export const Preferencias: React.FC<Props> = ({ instrument, onInstrumentChange }) => {
  const t = useT();
  const navigate = useNavigate();
  const stringOrder = useVisualizationStore(s => s.stringOrder);
  const setStringOrder = useVisualizationStore(s => s.setStringOrder);

  return (
    <div className="p-2 sm:p-4">
      <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white flex flex-col font-sans">

        {/* Mesma barra dos documentos (Termos, Privacidade): esta página é irmã deles na
            navegação, alcançada pelo ícone da área de trabalho e não pela faixa de abas. */}
        <div className="winxp-gradient-blue text-white px-3 py-1.5 flex justify-between items-center gap-2 select-none">
          <span className="font-bold text-xs sm:text-sm font-mono truncate">{t('preferencias.titulo')}</span>
          <button
            onClick={() => navigate('/')}
            className="shrink-0 px-2 py-0.5 bg-[#ece9d8] text-black border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-[10px] sm:text-xs hover:bg-white cursor-pointer"
            title={t('preferencias.voltarDica')}
          >
            {t('preferencias.voltar')}
          </button>
        </div>

        <div className="p-3 sm:p-5 flex flex-col gap-4 max-w-3xl">
          <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{t('preferencias.intro')}</p>

          {/* Duas colunas no desktop e uma no telefone: os painéis são curtos, e empilhar
              todos numa coluna só numa tela larga deixaria metade da página vazia. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

            <Secao titulo={t('preferencias.instrumentoTitulo')} nota={t('preferencias.instrumentoNota')}>
              <div className="flex flex-wrap gap-px">
                {PRESET_INSTRUMENTS.map(inst => (
                  <Opcao
                    key={inst.id}
                    rotulo={inst.name}
                    legenda={inst.tunings.find(afinacao => afinacao.id === inst.defaultTuningId)?.name}
                    selecionado={inst.id === instrument.id}
                    onClick={() => onInstrumentChange(inst)}
                  />
                ))}
              </div>
            </Secao>

            {/* Sem `nota` própria: o SeletorDeIdioma já traz a sua, e duas explicações
                empilhadas dizendo a mesma coisa é ruído. */}
            <Secao titulo={t('preferencias.idiomaTitulo')}>
              <SeletorDeIdioma embutido />
            </Secao>

            <Secao titulo={t('preferencias.exibicaoTitulo')}>
              <div className="flex flex-col gap-1">
                <h3 className="text-[11px] font-bold font-mono text-gray-700">{t('preferencias.notacaoTitulo')}</h3>
                <SeletorDeNotacao embutido />
              </div>
              <div className="flex flex-col gap-1 border-t border-[#d4d0c8] pt-2">
                <h3 className="text-[11px] font-bold font-mono text-gray-700">{t('preferencias.cordasTitulo')}</h3>
                {/* `stringOrder` começa `null` (ninguém respondeu o popup de boas-vindas).
                    Aqui nenhum dos dois aparece marcado nesse caso, que é a verdade: não
                    há escolha feita ainda. Marcar "Padrão" fingiria uma decisão. */}
                <div className="flex flex-wrap gap-px">
                  <Opcao
                    rotulo={t('preferencias.cordasPadrao')}
                    legenda={t('preferencias.cordasPadraoNota')}
                    selecionado={stringOrder === 'standard'}
                    onClick={() => setStringOrder('standard')}
                  />
                  <Opcao
                    rotulo={t('preferencias.cordasInvertida')}
                    legenda={t('preferencias.cordasInvertidaNota')}
                    selecionado={stringOrder === 'inverted'}
                    onClick={() => setStringOrder('inverted')}
                  />
                </div>
                <p className="px-0.5 text-[9px] text-gray-500 select-none leading-tight">
                  {t('preferencias.cordasNota')}
                </p>
              </div>
            </Secao>

            <Secao titulo={t('preferencias.terceirosTitulo')} nota={t('preferencias.terceirosNota')}>
              <YouTubeJsConsentControl />
            </Secao>

          </div>
        </div>
      </div>
    </div>
  );
};
