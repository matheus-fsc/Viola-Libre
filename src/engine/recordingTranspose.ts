import type { RecordingTranspose } from '../services/timingApi';
import { shortestTranspose } from './transposeKey';

export function recordingTargetTom(recordingTranspose: RecordingTranspose): number {
  // O detector mede a partir da cifra original, por isso o alvo não soma o ajuste atual.
  return shortestTranspose(recordingTranspose.semitones);
}

export function transposeNotice(recordingTranspose: RecordingTranspose | null | undefined, currentTom: number) {
  if (!recordingTranspose || !Number.isInteger(currentTom)) return null;
  const delta = shortestTranspose(recordingTargetTom(recordingTranspose) - currentTom);
  if (delta === 0) return null;
  const semitones = Math.abs(delta);
  const direction = delta > 0 ? 'above' : 'below';
  const side = delta > 0 ? 'Acima' : 'Abaixo';
  const unit = semitones === 1 ? 'Semitom' : semitones % 2 ? 'Semitons' : semitones === 2 ? 'Tom' : 'Tons';
  // A chave mantém o cálculo puro e deixa o componente reagir à troca de idioma.
  const label = `cifra.gravacao${side}${unit}` as const;
  return { semitones, direction, label };
}
