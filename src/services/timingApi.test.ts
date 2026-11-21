import { describe, expect, it } from 'vitest';
import { cleanYouTubeUrl, detectMediaType, extractYouTubeId, normalizeContribution } from './timingApi';

describe('normalizeContribution', () => {
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
