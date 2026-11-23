import { describe, expect, it } from 'vitest';
import { normalizeContribution, normalizeRecordingTranspose } from './timingApi';

describe('normalização do tom da gravação', () => {
  it.each([-11, -5, -2, 2, 6, 11])('preserva %s semitons e os limites de confiança', semitones => {
    for (const confidence of [0, 0.5, 1]) {
      const raw = { semitones, confidence, extra: true };
      expect(normalizeRecordingTranspose(raw)).toEqual({ semitones, confidence });
      expect(normalizeContribution({ id: 'auto', duration: 10, recordingTranspose: raw }).recordingTranspose)
        .toEqual({ semitones, confidence });
      expect(raw.extra).toBe(true);
    }
  });

  it('descarta formatos inválidos sem descartar o timing', () => {
    const invalid = [undefined, null, [], true, 2, '2', {}, { semitones: 2 },
      ...[0, -0, -12, 12, 1.5, NaN, Infinity, -Infinity, '2', null].map(semitones => ({ semitones, confidence: 1 })),
      ...[-1, 1.01, NaN, Infinity, '1', null, undefined].map(confidence => ({ semitones: 2, confidence }))];
    for (const recordingTranspose of invalid) {
      expect(normalizeRecordingTranspose(recordingTranspose)).toBeUndefined();
      const timing = normalizeContribution({ id: 'auto', duration: 10, recordingTranspose });
      expect(timing).not.toHaveProperty('recordingTranspose');
      expect(timing.duration).toBe(10);
    }
  });
});
