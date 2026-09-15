/*
 * Escolher o idioma da INTERFACE.
 *
 * Só a moldura muda: rótulo de aba, botão, aviso, texto de ajuda. O acervo continua
 * como está, porque cifra e letra pertencem à fonte, não a quem lê, e traduzir o nome
 * de uma música seria inventar um dado que não existe. É a mesma fronteira que o
 * SeletorDeNotacao respeita, e por isso os dois componentes são irmãos na aparência:
 * ficam lado a lado no mesmo painel.
 */
import { IDIOMAS, setIdioma, useIdioma, useT } from '../i18n';

interface Props {
  /** Sem moldura nem título, para encaixar num painel que já tem os seus. */
  embutido?: boolean;
  className?: string;
}

export function SeletorDeIdioma({ embutido = false, className = '' }: Props) {
  const idioma = useIdioma();
  const t = useT();

  const grade = (
    <div className="p-1.5">
      <div className="flex items-stretch gap-px" role="group" aria-label={t('idioma.grupo')}>
        {IDIOMAS.map(({ id, label, sigla }) => {
          const selecionado = id === idioma;
          return (
            <button
              key={id}
              onClick={() => setIdioma(id)}
              aria-pressed={selecionado}
              /* lang no próprio botão: o rótulo está no idioma que ele oferece, e sem
                 isto o leitor de tela lê "English" com a prosódia do português. */
              lang={id}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 border leading-none cursor-pointer ${
                selecionado
                  ? 'bg-[#316ac5] text-white border-[#316ac5]'
                  : 'bg-[#ece9d8] border-gray-400 text-black hover:bg-white'
              }`}
              title={label}
            >
              <span className="text-[11px] font-bold truncate max-w-full">{label}</span>
              <span className={`text-[8px] font-normal truncate max-w-full ${selecionado ? 'text-white/75' : 'text-gray-500'}`}>
                {sigla}
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-0.5 pt-1 text-[9px] text-gray-500 select-none leading-tight">
        {t('idioma.nota')}
      </p>
    </div>
  );

  if (embutido) return <div className={className}>{grade}</div>;

  return (
    <div className={`bg-[#ece9d8] bevel-out select-none ${className}`}>
      <div className="winxp-gradient-blue text-white px-2 py-0.5 font-bold text-xs">
        {t('idioma.titulo')}
      </div>
      {grade}
    </div>
  );
}
