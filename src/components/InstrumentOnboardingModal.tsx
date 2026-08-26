import React from 'react';
import type { Instrument } from '../engine/types';
import { PRESET_INSTRUMENTS } from '../engine/tunings';
import { useDialog } from '../hooks/useDialog';

interface Props {
  onSelect: (inst: Instrument) => void;
  onSkip: () => void;
}

/**
 * Rótulos só desta tela, sem mexer no `name` do instrumento.
 *
 * Aqui a pergunta é "qual é o seu instrumento?", e quem toca guitarra não se reconhece em
 * "Violão" — mas a afinação é a mesma, então o preset serve aos dois. O `name` continua
 * "Violão" no resto do app de propósito: ele aparece em `<select>` estreitos (na barra da
 * cifra o campo tem 90px) onde o nome composto seria cortado no meio.
 */
const ROTULO_ONBOARDING: Record<string, string> = {
  violao: 'Violão/Guitarra',
};

/** Escrito uma vez porque o rodapé o renderiza duas — uma por largura de tela. */
const ROTULO_PULAR = 'Decidir depois (usar Viola Caipira)';

/**
 * O `<wbr>` depois da barra é a única quebra permitida no rótulo composto: sem ele o
 * navegador não garante quebra no `/` e pode partir "Guitarra" ao meio na coluna estreita
 * do telefone. Com ele, ou cabe numa linha só, ou vira "Violão/" + "Guitarra".
 */
function rotulo(inst: Instrument): React.ReactNode {
  const texto = ROTULO_ONBOARDING[inst.id] ?? inst.name;
  if (!texto.includes('/')) return texto;
  return texto.split('/').map((parte, i) => (
    <React.Fragment key={i}>
      {i > 0 && <>/<wbr /></>}
      {parte}
    </React.Fragment>
  ));
}

export const InstrumentOnboardingModal: React.FC<Props> = ({ onSelect, onSkip }) => {
  // Esc equivale a "decidir depois": é a saída sem escolher, que já existe no botão.
  const { ref: dialogRef, props: dialogProps } = useDialog({ onClose: onSkip, titleId: 'titulo-onboarding-instrumento' });

  // No telefone o diálogo é uma folha que sobe pela borda de baixo, e não uma janela
  // centralizada: janela é metáfora de desktop, e ali no meio da tela as catorze opções
  // caíam longe do polegar. Encostada embaixo, a folha cresce para cima e o primeiro toque
  // acontece onde a mão já está. Do `sm` para cima volta a ser a janela XP de sempre.
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 font-mono">
      {/* A folha é dividida em três faixas — título, miolo rolável, rodapé — porque só o
          miolo pode rolar. São catorze instrumentos, e numa tela de 568px de altura o
          diálogo media 692px: ficava com o topo cortado e o "Decidir depois" abaixo da
          dobra, sem rolagem nenhuma para alcançá-lo. Título e rodapé fixos mantêm à vista
          a pergunta que se está respondendo e a saída de quem não quer responder.

          `max-h-[85%]` e não `85vh`: a unidade de viewport no iOS mede a tela com a barra
          do navegador recolhida, e a folha ficaria mais alta do que o espaço real. A
          porcentagem se resolve contra a sobreposição, que já é do tamanho certo. */}
      <div
        ref={dialogRef}
        {...dialogProps}
        className="w-full sm:w-[480px] max-w-full max-h-[85%] sm:max-h-full flex flex-col bg-[#ece9d8] border-[3px] border-b-0 sm:border-b-[3px] border-[#0058e6] rounded-t-lg shadow-2xl"
      >
        <div className="shrink-0 winxp-gradient-blue text-white px-3 py-2 sm:py-1.5 flex items-center rounded-t-md font-bold text-sm select-none">
          <span id="titulo-onboarding-instrumento">🎸 Qual é o seu instrumento?</span>
        </div>

        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-4 flex flex-col gap-4 text-xs min-h-0 overflow-y-auto retro-scrollbar">
          <p className="text-gray-700 leading-relaxed">
            Escolha seu instrumento principal para carregarmos automaticamente a afinação
            certa sempre que você abrir uma cifra ou o dicionário de acordes. Dá pra trocar
            a qualquer momento depois.
          </p>

          {/* `items-stretch` deixa os botões de uma linha com a mesma altura mesmo quando
              um deles quebra em duas linhas — sem isso, "Violão/Guitarra" ficaria mais alto
              que os vizinhos na largura de telefone. `leading-tight` e `hyphens-none` mantêm
              a quebra contida e sempre na barra, nunca no meio de "Guitarra".
              `min-h-12` (48px) é o piso de alvo de toque; no desktop, onde se aponta com o
              mouse, o botão volta a ter a altura do próprio conteúdo. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-stretch">
            {PRESET_INSTRUMENTS.map(inst => (
              <button
                key={inst.id}
                onClick={() => onSelect(inst)}
                className="bevel-out bg-[var(--color-winxp-panel)] min-h-12 sm:min-h-0 px-1.5 sm:px-2 py-3 font-bold text-xs leading-tight hyphens-none hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white cursor-pointer text-center"
              >
                {rotulo(inst)}
              </button>
            ))}
          </div>
        </div>

        {/* Rodapé fora da área que rola: a saída sem escolher precisa estar sempre à mão.
            São dois elementos, e não um com variantes `sm:`, porque `.bevel-out` mora na
            mesma camada das utilitárias do Tailwind e vem depois na ordem — `sm:border-0`
            nunca ganharia dela, e a moldura de 2px vazaria para o link do desktop. Cada
            largura ganha o controle que lhe cabe, e o rótulo é o mesmo objeto. */}
        <div className="shrink-0 border-t border-[#808080]/30 px-4 sm:px-5 py-3 sm:py-2 flex justify-center sm:justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-2">
          {/* Telefone: botão de largura inteira e 48px de alvo — como link de 16px era um
              alvo que exigia mira, no lugar da tela onde o polegar erra mais. */}
          <button
            onClick={onSkip}
            className="sm:hidden w-full min-h-12 bevel-out bg-[var(--color-winxp-panel)] px-3 text-xs font-bold text-gray-700 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white cursor-pointer"
          >
            {ROTULO_PULAR}
          </button>
          {/* Desktop: o link discreto de sempre, que ali não disputa com o mouse. */}
          <button
            onClick={onSkip}
            className="hidden sm:inline text-gray-500 hover:text-gray-800 underline cursor-pointer text-xs"
          >
            {ROTULO_PULAR}
          </button>
        </div>
      </div>
    </div>
  );
};
