import { useState } from 'react';
import { recordingTargetTom, transposeNotice } from '../../engine/recordingTranspose';
import { useT } from '../../i18n';
import type { RecordingTranspose } from '../../services/timingApi';

export function RecordingTransposeNotice({ songKey, recordingTranspose, currentTom, onSelect }: {
  songKey: string;
  recordingTranspose: RecordingTranspose;
  currentTom: number;
  onSelect: (tom: number) => void;
}) {
  const t = useT();
  const storageKey = `viola_recording_transpose_dismissed:${songKey}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const notice = transposeNotice(recordingTranspose, currentTom);
  if (dismissed || !notice) return null;
  const dismiss = () => {
    setDismissed(true);
    // O aviso não pode impedir a leitura quando o navegador bloqueia o armazenamento.
    try { localStorage.setItem(storageKey, '1'); } catch { /* A escolha vale nesta sessão. */ }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-[#98acd0] bg-[#eef3fa] px-2 py-1 text-[10px] font-bold text-[#385683]">
      <span role="status">{t(notice.label, { semitones: notice.semitones, tones: notice.semitones / 2 })}</span>
      <button type="button" onClick={() => onSelect(recordingTargetTom(recordingTranspose))}
        className="bevel-out bg-[#ece9d8] px-2 py-0.5 text-[#002fa7] hover:bg-white">
        {t('cifra.gravacaoAplicar')}
      </button>
      <button type="button" onClick={dismiss} aria-label={t('cifra.gravacaoDispensar')}
        className="ml-auto px-1 text-[#385683] hover:bg-white">×</button>
    </div>
  );
}
