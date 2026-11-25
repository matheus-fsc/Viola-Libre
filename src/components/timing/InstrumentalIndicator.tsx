import { useT } from '../../i18n';
import { formatSeconds } from '../../services/timingApi';

export function InstrumentalIndicator({ label, countdown, progress, wide = false }: {
  wide?: boolean; label: string; countdown: number | null; progress: number;
}) {
  const t = useT();
  return (
    <div className={`border-[#98acd0] bg-[#eef3fa] px-2 py-1 text-[10px] font-bold text-[#385683] max-w-full ${wide ? 'border-b w-full' : 'rounded-sm border w-fit'}`}>
      <span aria-live="polite" aria-atomic="true">{label || t('cifra.rolagemInstrumental')}</span>
      {countdown != null && <span className="ml-2">{t('cifra.rolagemLetraEm', { tempo: formatSeconds(countdown) })}</span>}
      <div className="mt-1 h-0.5 bg-[#d4d0c8]" aria-hidden="true">
        <div className="h-full bg-[#316ac5]" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
      </div>
    </div>
  );
}
