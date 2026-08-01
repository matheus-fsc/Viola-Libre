/*
 * Barra única do mobile: 4 destinos no alcance do polegar.
 *
 * No telefone o painel de controles não existe — tudo o que ele tinha entra por aqui, em
 * folhas que sobem de baixo. A regra que organiza os destinos é quanto o músico mexe no
 * controle *durante* a música: Tom e Rolagem viram destino próprio, o resto se agrupa.
 *
 * "Rolagem" é o único que não abre folha: ele liga a rolagem e a própria barra vira o
 * transporte. Duas barras empilhadas seria o pior dos mundos numa tela de 360px.
 *
 * Este arquivo é só a moldura (barra, folha, backdrop). O conteúdo de cada destino vem
 * pronto da CifraViewer, que é quem tem o estado.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, FastForward, Gauge, Hand, Pause, Rewind, RotateCcw, Settings, SkipBack, X } from 'lucide-react';

/** Abre uma folha com o conteúdo dado. */
export interface DestinoFolha {
  id: string;
  tipo: 'folha';
  icone: ReactNode;
  rotulo: string;
  /** Usado na barra quando `rotulo` não cabe nos ~66px de um quarto de tela estreita. */
  rotuloCurto?: string;
  /** O valor corrente, sob o rótulo — é o que evita abrir a folha só para conferir. */
  valor?: string;
  conteudo: ReactNode;
}

/** Age direto, sem folha (hoje só a Rolagem). */
export interface DestinoAcao {
  id: string;
  tipo: 'acao';
  icone: ReactNode;
  rotulo: string;
  ativo: boolean;
  onClick(): void;
}

export type Destino = DestinoFolha | DestinoAcao;

interface Props {
  destinos: Destino[];
  /** id da folha aberta, ou null. Controlado de fora para a rolagem poder fechá-la. */
  aberto: string | null;
  onAbrir(id: string | null): void;
  /** Enquanto true, a barra troca os destinos pelo transporte. */
  rolando: boolean;
  transporte: ReactNode;
}

export function MobileCifraBar({ destinos, aberto, onAbrir, rolando, transporte }: Props) {
  const folha = destinos.find((d): d is DestinoFolha => d.tipo === 'folha' && d.id === aberto);

  // Esc fecha — teclado físico existe em tablet e é o que o usuário tenta primeiro.
  useEffect(() => {
    if (!folha) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onAbrir(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [folha, onAbrir]);

  return (
    <>
      {folha && (
        <>
          <div
            onClick={() => onAbrir(null)}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden
          />
          <div
            role="dialog"
            aria-label={folha.rotulo}
            className="fixed inset-x-0 bottom-0 z-50 md:hidden bevel-out bg-[var(--color-winxp-panel)] border-t-2 border-white max-h-[75vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            <button
              onClick={() => onAbrir(null)}
              className="shrink-0 py-2 flex justify-center cursor-pointer"
              aria-label="Fechar"
            >
              <span className="block w-10 h-1 bg-[#808080] rounded-full" />
            </button>

            <div className="shrink-0 winxp-gradient-blue text-white px-3 py-1.5 flex items-center justify-between select-none">
              <span className="font-bold text-xs">{folha.rotulo}</span>
              <button
                onClick={() => onAbrir(null)}
                className="bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0.5 text-[10px] font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto retro-scrollbar p-2 flex flex-col gap-2">
              {folha.conteudo}
            </div>
          </div>
        </>
      )}

      {/* A barra some quando a folha está aberta: a folha já ocupa o alcance do polegar,
          e as duas juntas empilhariam dois níveis de controle no mesmo canto. */}
      {!folha && (
        <div className="fixed inset-x-2 bottom-2 z-50 md:hidden bevel-out bg-[var(--color-winxp-panel)] border border-gray-500 shadow-xl mb-[env(safe-area-inset-bottom)]">
          {rolando ? (
            transporte
          ) : (
            <div className="flex items-stretch">
              {destinos.map(d => {
                const ativo = d.tipo === 'acao' && d.ativo;
                return (
                  <button
                    key={d.id}
                    onClick={() => (d.tipo === 'acao' ? d.onClick() : onAbrir(d.id))}
                    aria-expanded={d.tipo === 'folha' ? aberto === d.id : undefined}
                    className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-2 min-h-[56px] border-r border-gray-400 last:border-r-0 cursor-pointer ${
                      ativo ? 'bg-[#316ac5] text-white' : 'text-black hover:bg-white'
                    }`}
                  >
                    <span className="text-base leading-none">{d.icone}</span>
                    <span className="text-[10px] font-bold leading-none truncate max-w-full">
                      {(d.tipo === 'folha' && d.rotuloCurto) || d.rotulo}
                    </span>
                    {d.tipo === 'folha' && d.valor && (
                      <span className="text-[9px] leading-none text-[#002fa7] truncate max-w-full">{d.valor}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Peças das folhas — o padrão rótulo à esquerda, controle à direita.
// ---------------------------------------------------------------------------

export function GrupoAjustes({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="bevel-in bg-white">
      {titulo && (
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-[#d4d0c8]">
          {titulo}
        </div>
      )}
      {children}
    </div>
  );
}

export function LinhaAjuste({ rotulo, dica, children }: {
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  // Quebra em vez de truncar: com o controle do lado sobram ~110px para o rótulo, e
  // "Transposição / Meio tom por vez" virava "Transpo... / Meio tom p...".
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2.5 border-b border-[#d4d0c8] last:border-b-0">
      <div className="min-w-[45%] flex-1">
        <div className="text-xs font-bold text-black">{rotulo}</div>
        {dica && <div className="text-[10px] text-gray-500">{dica}</div>}
      </div>
      <div className="shrink-0 flex items-center gap-1">{children}</div>
    </div>
  );
}

/** −/valor/+ com alvos de toque de 36px. */
export function Stepper({ onMenos, onMais, children, rotuloMenos = '−', rotuloMais = '+' }: {
  onMenos(): void;
  onMais(): void;
  children: ReactNode;
  rotuloMenos?: string;
  rotuloMais?: string;
}) {
  const btn = 'bevel-out bg-[var(--color-winxp-panel)] px-2.5 py-1.5 text-xs font-bold min-w-[36px] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white';
  return (
    <div className="flex items-center gap-1">
      <button onClick={onMenos} className={btn}>{rotuloMenos}</button>
      <span className="font-mono text-xs font-bold min-w-[52px] text-center">{children}</span>
      <button onClick={onMais} className={btn}>{rotuloMais}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transporte — o que a barra vira enquanto a rolagem está ligada.
// ---------------------------------------------------------------------------

interface TransporteProps {
  userSeeking: boolean;
  onToggle(): void;
  onRestart(): void;
  onSeek(segundos: number): void;
  mult: number;
  onMult(m: number): void;
  elapsed: number;
  total: number;
  fmtTime(s: number): string;
  secao: string | null;
  loopA: number | null;
  loopB: number | null;
  onLoopA(): void;
  onLoopB(): void;
  onLoopLimpar(): void;
  showTabs: boolean;
  onToggleTabs(): void;
}

const NUDGE_SEC = 5;

/**
 * Linha de cima: só o que se usa tocando — pausar, velocidade e sair.
 *
 * Seek, loop A→B e tabs ficam atrás do chevron. São coisas de ensaio, não de execução, e
 * o Viola Libre é o único que as tem — o certo é tirá-las do caminho, não jogá-las fora.
 */
export function TransporteMobile(p: TransporteProps) {
  const [expandido, setExpandido] = useState(false);
  /** Float: 1.0000000001 nunca acontece com step 0.1, mas comparar por tolerância é barato. */
  const alterado = Math.abs(p.mult - 1) > 0.001;
  const btn = 'bevel-out bg-[var(--color-winxp-panel)] px-2 py-2 text-xs font-bold border border-gray-400 text-[#002fa7] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white';

  return (
    <div className="flex flex-col">
      {/* Uma linha só, e apertada: numa viewport de 296px o slider é o primeiro a ser
          espremido, então tudo em volta anda com gap-1.5 e o mostrador numérico só
          aparece quando há largura para ele. */}
      <div className="flex items-center gap-1.5 px-1.5 py-1.5">
        <button
          onClick={p.onToggle}
          className="bevel-out bg-[#316ac5] text-white px-2.5 py-2 text-xs font-bold border border-gray-400 shrink-0 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
          title={p.userSeeking ? 'Ajustando a posição' : 'Pausar (Espaço)'}
          aria-label={p.userSeeking ? 'Ajustando a posição' : 'Pausar'}
        >
          {p.userSeeking ? <Hand size={14} /> : <Pause size={14} />}
        </button>

        {/* Velocidade contínua: três botões discretos gastavam a mesma largura e não
            alcançavam o meio-termo, que é justamente onde o músico costuma parar.
            Um velocímetro só, em vez de ícones nas duas pontas: o número à direita já
            diz onde a alavanca está, e sobra largura para o slider na tela estreita.

            Fora do 1×, o velocímetro vira o botão de voltar — ocupa o mesmo slot, então
            o slider não encolhe, e aparece exatamente quando serve para algo. Slider é
            fácil de esbarrar com o polegar, e sem isto não há caminho de volta ao normal
            a não ser mirar o meio do curso. */}
        {alterado ? (
          <button
            onClick={() => p.onMult(1)}
            className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-1.5 border border-gray-400 shrink-0 text-[#cc3300] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
            title="Voltar à velocidade normal (1×)"
            aria-label="Voltar à velocidade normal"
          >
            <RotateCcw size={13} />
          </button>
        ) : (
          <Gauge size={15} className="shrink-0 text-[#002fa7]" aria-hidden />
        )}
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={p.mult}
          onChange={e => p.onMult(Number(e.target.value))}
          className="flex-1 min-w-[60px] accent-[#316ac5] cursor-pointer"
          aria-label={`Velocidade da rolagem: ${p.mult.toFixed(1)}×`}
        />
        {/* Vermelho fora do padrão, como o BPM editado à mão faz no painel. */}
        <span className={`font-mono text-[10px] font-bold tabular-nums shrink-0 ${alterado ? 'text-[#cc3300]' : 'text-[#002fa7]'}`}>
          {p.mult.toFixed(1)}×
        </span>

        <button
          onClick={() => setExpandido(v => !v)}
          aria-expanded={expandido}
          className={`bevel-out px-2 py-2 text-xs font-bold border border-gray-400 shrink-0 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${
            expandido ? 'bg-[#316ac5] text-white' : 'bg-[var(--color-winxp-panel)] text-[#002fa7]'
          }`}
          title={expandido ? 'Fechar ajustes da rolagem' : 'Ajustes da rolagem'}
        >
          <Settings size={14} />
        </button>
        <button onClick={p.onToggle} className={`${btn} shrink-0`} title="Parar a rolagem" aria-label="Parar a rolagem">
          <X size={14} />
        </button>
      </div>

      {expandido && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2 pt-1 border-t border-gray-400">
          <button onClick={p.onRestart} className={btn} title="Voltar ao início (Home)" aria-label="Voltar ao início"><SkipBack size={14} /></button>
          <button onClick={() => p.onSeek(-NUDGE_SEC)} className={btn} title={`Voltar ${NUDGE_SEC}s`} aria-label={`Voltar ${NUDGE_SEC} segundos`}><Rewind size={14} /></button>
          <button onClick={() => p.onSeek(NUDGE_SEC)} className={btn} title={`Avançar ${NUDGE_SEC}s`} aria-label={`Avançar ${NUDGE_SEC} segundos`}><FastForward size={14} /></button>
          {p.total > 0 && (
            <span className="font-mono text-[10px] font-bold text-[#002fa7] tabular-nums px-1">
              {p.fmtTime(p.elapsed)} / {p.fmtTime(p.total)}
            </span>
          )}
          <button
            onClick={p.onLoopA}
            className={`px-2.5 py-2 text-xs font-bold border leading-tight ${p.loopA !== null ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400'}`}
            title="Marcar início do loop na posição atual"
          >
            A
          </button>
          <button
            onClick={p.onLoopB}
            className={`px-2.5 py-2 text-xs font-bold border leading-tight ${p.loopB !== null ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400'}`}
            title="Marcar fim do loop na posição atual"
          >
            B
          </button>
          {(p.loopA !== null || p.loopB !== null) && (
            <button onClick={p.onLoopLimpar} className="px-2 py-2 text-xs font-bold border border-gray-400 bg-[#ece9d8] text-[#cc3300] flex items-center gap-1" title="Limpar o loop">
              <X size={12} /> Loop
            </button>
          )}
          <button
            onClick={p.onToggleTabs}
            className={`px-2.5 py-2 text-[10px] font-bold border leading-tight flex items-center gap-1 ${!p.showTabs ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400'}`}
            title={p.showTabs ? 'Ocultar as tabs' : 'Mostrar as tabs'}
          >
            Tabs {p.showTabs ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          {p.secao && (
            <span className="text-[10px] font-bold text-[#660033] max-w-[110px] truncate" title={p.secao}>{p.secao}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function BotaoFolha({ onClick, ativo, disabled, children, title }: {
  onClick(): void;
  ativo?: boolean;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`bevel-out px-3 py-2 text-xs font-bold border border-gray-400 flex items-center justify-center gap-1.5 disabled:opacity-50 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${
        ativo ? 'bg-[#316ac5] text-white' : 'bg-[var(--color-winxp-panel)] text-black hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}
