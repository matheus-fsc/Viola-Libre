import { describe, expect, it } from 'vitest';
import { cleanYouTubeUrl, detectMediaType, extractYouTubeId } from './timingApi';

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
