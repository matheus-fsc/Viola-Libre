import { describe, expect, it } from 'vitest';
import { cleanYouTubeUrl, detectMediaType, extractYouTubeId, normalizeContribution } from './timingApi';

describe('normalizeContribution', () => {
  it('preserva e ordena os acordes alinhados sem alterar a entrada ou perder voltas', () => {
    const chord = { time: 3, lineIndex: 0, chordIndex: 1, chord: 'G7', confidence: 0.9 };
    const chordTimes = [chord, { ...chord, time: 1 }];
    expect(normalizeContribution({ id: 'auto', duration: 10, chordTimes }).chordTimes)
      .toEqual([chordTimes[1], chordTimes[0]]);
    expect(chordTimes[0].time).toBe(3);
    expect(normalizeContribution({ id: 'auto', duration: 10, chordTimes: [] }).chordTimes).toEqual([]);
  });

  it('descarta o campo inteiro quando o alinhamento tem formato inválido', () => {
    const chord = { time: 1, lineIndex: 0, chordIndex: 0, chord: 'C', confidence: 1 };
    const invalid = [null, 'inválido', {}, { ...chord, time: -1 }, { ...chord, time: NaN },
      { ...chord, time: Infinity }, { ...chord, time: '1' }, { ...chord, lineIndex: -1 },
      { ...chord, lineIndex: 0.5 }, { ...chord, chordIndex: -1 }, { ...chord, chordIndex: 0.5 },
      { ...chord, chord: ' ' }, { ...chord, confidence: -0.1 }, { ...chord, confidence: 1.1 },
      { ...chord, confidence: NaN }, { ...chord, confidence: undefined }];
    for (const entry of invalid) {
      expect(normalizeContribution({ id: 'auto', duration: 10, chordTimes: [chord, entry] }))
        .not.toHaveProperty('chordTimes');
    }
    for (const chordTimes of [undefined, null, {}, 'inválido']) {
      expect(normalizeContribution({ id: 'auto', duration: 10, chordTimes })).not.toHaveProperty('chordTimes');
    }
  });

  it('preserva o contrato camelCase e os formatos das regiões', () => {
    const raw = {
      id: 'manual-1',
      editorAlias: 'Ana',
      mediaUrl: 'https://example.com/faixa',
      mediaType: 'audio',
      bpm: 80,
      duration: 32,
      loops: [{ label: 'Refrão', startLine: 3, endLine: 6, repeatCount: 2, mediaTimestampStart: 12, mediaTimestampEnd: 20 }],
      instrumentalSections: [{ label: 'Intro', startLine: null, endLine: null, mediaTimestampStart: 0, mediaTimestampEnd: 4 }],
      phrases: [{ lineIndex: 0, startTime: 4.25, endTime: 6 }],
      sections: [{ label: 'Verso', type: 'verse', startTime: 4, endTime: null }],
      markers: [{ type: 'fine', time: 32 }],
      votes: 9,
      updatedAt: '2026-11-21',
      source: 'manual',
      reviewed: true,
      reviewedFrom: 'auto-1',
    } satisfies Parameters<typeof normalizeContribution>[0];
    expect(normalizeContribution(raw)).toEqual(raw);
    expect(normalizeContribution({ ...raw, source: 'auto', reviewed: false, reviewedFrom: null }))
      .toMatchObject({ source: 'auto', reviewed: false, reviewedFrom: null });
  });

  it('deriva o fim de cada frase do próximo início em ordem cronológica', () => {
    const line_timestamps = [
      { line: 1, media_timestamp_start: 7.75 },
      { line: 13, media_timestamp_start: 15 },
      { line: 0, media_timestamp_start: 0 },
    ];
    const intro = { label: 'Intro', startLine: null, endLine: null, mediaTimestampStart: 1, mediaTimestampEnd: 5 };
    expect(normalizeContribution({
      id: 'legado',
      duration: 32,
      editor_alias: 'Ana',
      media_url: 'https://example.com/faixa.mp3',
      media_type: 'audio',
      instrumental_sections: [intro],
      updated_at: '2026-11-21',
      line_timestamps,
    })).toMatchObject({
      editorAlias: 'Ana',
      mediaUrl: 'https://example.com/faixa.mp3',
      mediaType: 'audio',
      updatedAt: '2026-11-21',
      instrumentalSections: [intro],
      phrases: [
        { lineIndex: 0, startTime: 0, endTime: 7.75 },
        { lineIndex: 1, startTime: 7.75, endTime: 15 },
        { lineIndex: 13, startTime: 15, endTime: 32 },
      ],
    });
    expect(line_timestamps.map(timestamp => timestamp.line)).toEqual([1, 13, 0]);
  });

  it('descarta ocorrências inválidas e usa a primeira passagem válida como canônica', () => {
    const loop = {
      label: 'Repetição 1', startLine: 26, endLine: 51, repeatCount: 3,
      mediaTimestampStart: 6, mediaTimestampEnd: 10,
    };
    const occurrences = [
      { startTime: 42, endTime: 50 }, null, { startTime: '6', endTime: 10 },
      { startTime: 24.5, endTime: 33 }, { startTime: 0, endTime: Infinity },
      { startTime: -1, endTime: 6 }, { startTime: 10, endTime: 10 },
      { startTime: 6, endTime: 5 }, { startTime: NaN, endTime: 9 },
      { startTime: 12, endTime: 20 },
    ];
    const normalized = normalizeContribution({
      id: 'auto', duration: 60, loops: [{ ...loop, occurrences }],
    });
    expect(normalized.loops).toEqual([{
      ...loop, mediaTimestampStart: 12, mediaTimestampEnd: 20,
      occurrences: [occurrences[9], occurrences[3], occurrences[0]],
    }]);
    expect(occurrences[0]).toEqual({ startTime: 42, endTime: 50 });
    expect(normalizeContribution({
      id: 'auto', duration: 60, loops: [
        { ...loop, occurrences: [null] }, { ...loop, occurrences: 'inválido' },
      ],
    }).loops).toEqual([loop, loop]);
  });

  it('usa listas vazias e origem manual quando os campos faltam', () => {
    expect(normalizeContribution({ id: 'legado', duration: 32 })).toMatchObject({
      source: 'manual', editorAlias: null, mediaUrl: null, mediaType: null,
      loops: [], instrumentalSections: [], phrases: [], sections: [], markers: [],
    });
  });

  it('preserva campos camelCase explícitos durante a migração', () => {
    expect(normalizeContribution({
      id: 'migrado', duration: 32, phrases: [], editorAlias: null,
      line_timestamps: [{ line: 0, media_timestamp_start: 3 }],
      editor_alias: 'Ana',
    })).toMatchObject({ phrases: [], editorAlias: null });
  });
});

// O seed de vídeo (/api/internal/video/*) grava links vindos de fontes diferentes
// (busca no YouTube, página do CifraClub), então o extrator precisa aguentar todas
// as formas de URL que o YouTube publica — não só o watch?v=.
describe('extractYouTubeId', () => {
  const ID = 'dQw4w9WgXcQ';

  it.each([
    ['watch',          `https://www.youtube.com/watch?v=${ID}`],
    ['watch com t',    `https://www.youtube.com/watch?v=${ID}&t=42s`],
    ['encurtado',      `https://youtu.be/${ID}`],
    ['embed',          `https://www.youtube.com/embed/${ID}`],
    ['shorts',         `https://www.youtube.com/shorts/${ID}`],
    ['live',           `https://www.youtube.com/live/${ID}`],
    ['sem protocolo',  `youtube.com/watch?v=${ID}`],
  ])('reconhece a forma %s', (_form, url) => {
    expect(extractYouTubeId(url)).toBe(ID);
  });

  it('devolve null para o que não é vídeo do YouTube', () => {
    expect(extractYouTubeId('https://www.cifraclub.com.br/artista/musica/')).toBeNull();
    expect(extractYouTubeId('https://exemplo.com/audio.mp3')).toBeNull();
    expect(extractYouTubeId('')).toBeNull();
  });

  it('normaliza qualquer forma para a URL canônica de watch', () => {
    expect(cleanYouTubeUrl(`https://youtu.be/${ID}?si=abc`)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(cleanYouTubeUrl(`https://www.youtube.com/shorts/${ID}`)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
});

describe('detectMediaType', () => {
  it('classifica os links que o seed produz', () => {
    expect(detectMediaType('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(detectMediaType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
    expect(detectMediaType('https://exemplo.com/faixa.mp3')).toBe('audio');
    expect(detectMediaType('https://exemplo.com/pagina')).toBe('other');
    expect(detectMediaType('')).toBeNull();
  });
});

describe('normalização de instrumentais sem linhas no meio da música', () => {
  it.each(['instrumentalSections', 'instrumental_sections'] as const)('preserva %s e seus tempos', key => {
    const section = { label: 'Interlúdio', startLine: null, endLine: null, mediaTimestampStart: 15, mediaTimestampEnd: 25 };
    const timing = normalizeContribution({ id: 'interludio', duration: 40, [key]: [section], phrases: [
      { lineIndex: 1, startTime: 0, endTime: 15 },
      { lineIndex: 3, startTime: 25, endTime: 40 },
    ] });
    expect(timing.instrumentalSections).toEqual([section]);
  });
});
