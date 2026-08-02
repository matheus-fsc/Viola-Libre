/*
 * Escolher como os acordes reconhecidos são ESCRITOS.
 *
 * O mesmo acorde tem grafias diferentes conforme o padrão: o F–A–C–G que o Cifra Club
 * escreve "F9" o mundo escreve "Fadd9", e o "B°" brasileiro é o "Bdim7" internacional.
 * A tabela do motor tem 17 grupos desses sinônimos, e antes deste seletor o desempate era
 * o nome mais curto — que fazia F–A–C–G virar "F2", grafia que ninguém usa aqui.
 *
 * Só o rótulo muda. As notas do acorde são as mesmas nos dois padrões: a leitura da cifra
 * fica sempre na convenção brasileira, porque ela pertence à fonte e não a quem lê.
 */
import { NOTATION_STANDARDS, type NotationStandard } from '../engine/notation';
import { useNotationStore } from '../stores/useNotationStore';

/** Exemplo vivo do que muda, para a escolha não depender de saber a teoria de cor. */
const AMOSTRA: Record<NotationStandard, string> = {
  'pt-BR': 'F9 · B° · C7M',
  intl: 'Fadd9 · Bdim7 · CMaj7',
};

interface Props {
  /** Sem moldura nem título — para encaixar dentro de um painel que já tem os seus. */
  embutido?: boolean;
  className?: string;
}

export function SeletorDeNotacao({ embutido = false, className = '' }: Props) {
  const standard = useNotationStore(s => s.standard);
  const setStandard = useNotationStore(s => s.setStandard);

  const grade = (
    <div className="p-1.5">
      <div className="flex items-stretch gap-px" role="group" aria-label="Padrão de notação">
        {NOTATION_STANDARDS.map(({ id, label }) => {
          const selecionado = id === standard;
          return (
            <button
              key={id}
              onClick={() => setStandard(id)}
              aria-pressed={selecionado}
              /* flex-1 + min-w-0: as duas casas dividem a largura em vez de estourar, então
                 a mesma peça serve no painel do desktop e na folha do telefone. O rótulo
                 longo ("Brasileiro (Cifra Club)") quebraria numa tela estreita, por isso o
                 nome curto some abaixo de sm e o título completo fica no `title`. */
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 border leading-none cursor-pointer ${
                selecionado
                  ? 'bg-[#316ac5] text-white border-[#316ac5]'
                  : 'bg-[#ece9d8] border-gray-400 text-black hover:bg-white'
              }`}
              title={label}
            >
              <span className="text-[11px] font-bold truncate max-w-full">
                <span className="sm:hidden">{id === 'pt-BR' ? 'Brasileiro' : 'Internacional'}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
              <span className={`text-[8px] font-normal truncate max-w-full ${selecionado ? 'text-white/75' : 'text-gray-500'}`}>
                {AMOSTRA[id]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-0.5 pt-1 text-[9px] text-gray-500 select-none leading-tight">
        Muda só como o acorde é escrito. As notas continuam as mesmas.
      </p>
    </div>
  );

  if (embutido) return <div className={className}>{grade}</div>;

  return (
    <div className={`bg-[#ece9d8] bevel-out select-none ${className}`}>
      <div className="winxp-gradient-blue text-white px-2 py-0.5 font-bold text-xs">
        Notação
      </div>
      {grade}
    </div>
  );
}
