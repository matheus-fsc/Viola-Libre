import type { NoteValue } from '../engine/noteValue';
import { useT } from '../i18n';

const FIGURE_KEYS = {
  whole: 'cifra.figuraSemibreve',
  half: 'cifra.figuraMinima',
  quarter: 'cifra.figuraSeminima',
  eighth: 'cifra.figuraColcheia',
  sixteenth: 'cifra.figuraSemicolcheia',
} as const;

/** Desenho próprio da figura: os símbolos musicais do Unicode faltam na fonte de muitos aparelhos. */
export function NoteValueIcon({ value, className = '' }: { value: NoteValue; className?: string }) {
  const t = useT();
  const { figure, dotted, count, beats } = value;
  const nome = t(FIGURE_KEYS[figure]);
  const rotulo = t(beats === 1 ? 'cifra.figuraUmTempo' : 'cifra.figuraTempos', {
    figura: dotted ? t('cifra.figuraPontuada', { figura: nome }) : nome,
    n: beats,
  });
  const hollow = figure === 'whole' || figure === 'half';
  const flags = figure === 'eighth' ? 1 : figure === 'sixteenth' ? 2 : 0;
  return (
    <span role="img" aria-label={rotulo} title={rotulo} className={`inline-flex items-end gap-0.5 ${className}`}>
      <svg viewBox="0 0 18 24" width="12" height="16" aria-hidden>
        <ellipse cx="6" cy="19" rx="4.2" ry="3" transform="rotate(-20 6 19)"
          fill={hollow ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={hollow ? 1.6 : 0} />
        {figure !== 'whole' && <line x1="9.6" y1="18" x2="9.6" y2="3" stroke="currentColor" strokeWidth="1.4" />}
        {Array.from({ length: flags }, (_, i) => (
          <path key={i} d={`M9.6 ${3 + i * 4} q5 3 4 8`} fill="none" stroke="currentColor" strokeWidth="1.4" />
        ))}
        {dotted && <circle cx="15.5" cy="18" r="1.4" fill="currentColor" />}
      </svg>
      {count > 1 && <span className="text-[10px] font-bold leading-none">×{count}</span>}
    </span>
  );
}
