/*
 * Escolher o tom pela lista, em vez de só somar meio tom de cada vez.
 *
 * O estado da transposição continua sendo o deslocamento em semitons — é ele que move
 * acordes, tabs e diagramas. Aqui a lista só traduz "quero em Lá" para o deslocamento
 * correspondente, então nada muda no motor.
 *
 * A lista sai do próprio tom da música e mantém o sufixo dela: numa cifra em Em as opções
 * são Em, Fm, F#m…, não E, F, F#. Tom maior e tom menor não são a mesma lista.
 */
import { useEffect, type ReactNode } from 'react';
import { Heart } from 'lucide-react';
import { transposeChordString } from '../../engine/chordCalculator';
import { shortestTranspose } from '../../engine/transposeKey';
import type { DeteccaoTom } from '../../engine/detectKey';
import { TonsPossiveis } from './TonsPossiveis';
import type { EstadoTomSalvo } from './tomSalvo';

/**
 * O tom é da PESSOA, não da cifra: o mesmo arquivo serve a quem canta em Sol e a quem
 * canta em Si. Guardar isso na estante é o que faz a música abrir no tom certo da próxima
 * vez — e o botão só aparece quando há divergência entre a tela e o que está guardado,
 * para não virar mais um controle permanente disputando espaço com os que se usa sempre.
 *
 * Salvar não pede confirmação nem espera rede: escreve no localStorage e a lista de
 * /favoritos, que lê a mesma store, muda no mesmo instante.
 */
export function SalvarTom({ estado, songKey, offsetAtual, onSalvar, className = '' }: {
  estado: EstadoTomSalvo;
  songKey: string;
  offsetAtual: number;
  onSalvar(): void;
  className?: string;
}) {
  if (estado === null) return null;

  if (estado === 'guardado') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[9px] text-gray-500 leading-none ${className}`}
        title="Esta cifra abre neste tom porque é o que está guardado nos seus favoritos"
      >
        <Heart size={9} className="fill-red-500 text-red-500 shrink-0" />
        seu tom
      </span>
    );
  }

  const alvo = transposeChordString(songKey, offsetAtual, false);
  return (
    <button
      onClick={onSalvar}
      className={`inline-flex items-center gap-1 bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-[10px] font-bold text-black leading-tight hover:bg-white cursor-pointer active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${className}`}
      title={`Guardar ${alvo || 'este tom'} nos favoritos — a cifra passa a abrir assim`}
    >
      <Heart size={10} className="fill-red-500 text-red-500 shrink-0" />
      <span className="truncate">Salvar tom{alvo ? ` ${alvo}` : ''}</span>
    </button>
  );
}

/**
 * A fita vai de −5 a +6: abaixar à esquerda, original no meio, subir à direita.
 *
 * São os 12 tons sem repetir nenhum — passar de +6 já é a mesma nota que −5 pelo outro
 * lado. Fica uma casa fora do centro exato, mas o alternativa seria repetir o trítono nas
 * duas pontas com o mesmo nome, o que parece defeito.
 */
const OFFSETS = Array.from({ length: 12 }, (_, i) => i - 5);

interface GradeProps {
  /** Tom original da música, sempre tríade — vem do `detectKey`. */
  songKey: string;
  /** Deslocamento atual, em semitons. */
  offset: number;
  onSelect(offset: number): void;
  /** Frase do `descricaoDoTom`. Aparece sob a fita quando há ressalva a fazer. */
  descricao?: string;
  /** A leitura completa. Quando vem, a fita ganha o painel de confiança e campo harmônico. */
  deteccao?: DeteccaoTom | null;
}

/** A grade em si, sem posicionamento — serve solta numa folha ou dentro de um popover. */
export function GradeDeTons({ songKey, offset, onSelect, descricao, deteccao }: GradeProps) {
  const atual = shortestTranspose(offset);

  return (
    <div className="p-1.5">
      <div className="flex items-stretch gap-px">
        {OFFSETS.map(o => {
          const rotulo = transposeChordString(songKey, o, false);
          const selecionado = o === atual;
          const original = o === 0;
          return (
            <button
              key={o}
              onClick={() => onSelect(o)}
              aria-pressed={selecionado}
              /* flex-1 + min-w-0: as casas dividem a largura disponível em vez de
                 estourar, então a mesma fita serve no popover e na folha do telefone.
                 Sem padding lateral: numa tela de 296px sobram ~22px por casa, e "D#"
                 ocupa 19 — o respiro tem que vir do gap, não de dentro da casa. */
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 border leading-none cursor-pointer ${
                selecionado
                  ? 'bg-[#316ac5] text-white border-[#316ac5]'
                  : original
                    ? 'bg-white border-[#002fa7] text-black hover:bg-[#c2d7f2]'
                    : 'bg-[#ece9d8] border-gray-400 text-black hover:bg-white'
              }`}
              title={original ? `Tom original da música (${rotulo})` : `${rotulo} — ${o > 0 ? '+' : ''}${o} semitom${Math.abs(o) > 1 ? 's' : ''}`}
            >
              <span className="text-[11px] font-bold truncate max-w-full">{rotulo || '?'}</span>
              <span className={`text-[8px] font-normal ${selecionado ? 'text-white/75' : 'text-gray-500'}`}>
                {original ? '●' : `${o > 0 ? '+' : ''}${o}`}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-between px-0.5 pt-1 text-[9px] text-gray-500 select-none">
        <span>abaixar</span>
        <span className="text-[#002fa7]">● original</span>
        <span>subir</span>
      </div>
      {/* A ressalva vem DEPOIS da fita, não antes: quem abriu isto quer trocar o tom, e
          esse é o controle. O aviso informa quem for ler, sem atrasar quem só quer clicar. */}
      {descricao && !deteccao && (
        <p className="px-0.5 pt-1.5 text-[9px] leading-snug text-gray-600 border-t border-[#d4d0c8] mt-1">
          {descricao}
        </p>
      )}
      {/* Havendo a leitura completa, ela substitui a frase: o painel diz a mesma coisa e
          ainda mostra em cima de que a leitura se apoia. */}
      {deteccao && <TonsPossiveis deteccao={deteccao} />}
    </div>
  );
}

interface SeletorProps extends GradeProps {
  aberto: boolean;
  onAbrir(aberto: boolean): void;
  /** Como o mostrador aparece fechado. */
  gatilho: ReactNode;
}

/**
 * Mostrador clicável + diálogo. Usado nos painéis do desktop; no telefone a folha do Tom
 * já é o container, então lá se usa a `GradeDeTons` direto.
 *
 * O diálogo é centralizado na viewport em vez de ancorado no botão porque o painel lateral
 * tem `overflow-y-auto` — e no CSS isso faz o eixo horizontal deixar de ser `visible`, o
 * que recortaria uma fita de 420px pendurada num painel de 176px.
 */
export function SeletorDeTom({ songKey, offset, onSelect, aberto, onAbrir, gatilho, descricao, deteccao }: SeletorProps) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onAbrir(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onAbrir]);

  const desabilitado = !songKey;

  return (
    <div className="inline-flex">
      <button
        onClick={() => !desabilitado && onAbrir(!aberto)}
        disabled={desabilitado}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="font-bold text-xs bg-white border border-gray-400 px-1 text-[#002fa7] min-w-[20px] text-center cursor-pointer hover:bg-[#c2d7f2] disabled:cursor-default disabled:hover:bg-white"
        title={desabilitado ? 'Tom desconhecido' : descricao ?? 'Escolher o tom'}
      >
        {gatilho}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30" onClick={() => onAbrir(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Escolher o tom"
            /* Altura limitada + rolagem interna: o painel "avançado" cresce bastante, e sem
               teto o diálogo passava do alto e do pé da tela — com a barra de título fora de
               alcance, já que ele é posicionado pelo CENTRO. A folha do telefone sempre teve
               isso (`max-h-[75vh]` + `overflow-y-auto`); aqui faltava. A barra de título fica
               `shrink-0` para o × continuar sempre visível enquanto se rola o conteúdo. */
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[420px] max-w-[94vw] max-h-[85vh] flex flex-col bg-[#ece9d8] bevel-out shadow-xl select-none"
          >
            <div className="shrink-0 winxp-gradient-blue text-white px-2 py-0.5 flex items-center justify-between font-bold text-xs">
              <span>Tom</span>
              <button
                onClick={() => onAbrir(false)}
                className="bg-red-600 border border-white border-r-gray-600 border-b-gray-600 px-1.5 text-white font-bold leading-tight"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto retro-scrollbar">
              <GradeDeTons songKey={songKey} offset={offset} descricao={descricao} deteccao={deteccao} onSelect={o => { onSelect(o); onAbrir(false); }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
