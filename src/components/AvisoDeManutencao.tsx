/**
 * A faixa que aparece enquanto a API está em manutenção.
 *
 * O backup diário do banco derruba a API por alguns minutos. Sem aviso, isso chegava ao
 * usuário como cifra que não abre e console cheio de erro — a cara de site quebrado, para
 * uma parada planejada que termina sozinha.
 *
 * A faixa diz três coisas, nessa ordem de importância: que é manutenção (não defeito), que
 * é rápida, e que o site vai se recuperar sozinho. A última é a que importa: o interceptor
 * em `api.ts` repete as leituras quando a API voltar, então ninguém precisa recarregar
 * nada — e dizer isso evita que a pessoa fique apertando F5 contra um servidor ocupado.
 *
 * Fica no topo e empurra o conteúdo em vez de flutuar sobre ele. Uma tarja fixa cobriria a
 * barra de abas justamente enquanto a navegação é a única coisa que ainda funciona.
 *
 * O `z-50` não é enfeite: a área de trabalho é um `fixed inset-0 z-0`, e elemento
 * posicionado pinta por cima de conteúdo estático. Sem empilhar, a faixa renderizava
 * certinho no DOM e ficava escondida atrás do céu azul.
 */
import { useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { assinarManutencao, estadoDaManutencao } from '../services/manutencao';

export function AvisoDeManutencao() {
  const t = useT();
  const estado = useSyncExternalStore(assinarManutencao, estadoDaManutencao, estadoDaManutencao);

  if (!estado.emManutencao) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-50 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 border-b border-[#d4a017] bg-[#fdf3d2] px-3 py-1.5 text-center text-[11px] leading-snug text-[#6b4e00]"
    >
      <strong className="font-bold">{t('manutencao.titulo')}</strong>
      {/* A frase da própria API vem primeiro quando existe: se um dia a janela mudar de
          duração ou de motivo, o servidor consegue dizer isso sem depender de um deploy
          do site. A nossa fica de reserva. */}
      <span>{estado.mensagem ?? t('manutencao.texto')}</span>
      <span className="text-[#8a6d1f]">{t('manutencao.sozinho')}</span>
    </div>
  );
}
