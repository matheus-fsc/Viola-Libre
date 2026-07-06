// MOCK — ponto único de troca. Quando o backend adicionar `views`/`favorited`
// em SongSummary (GET /api/artistas/{slug}/musicas), apague este arquivo e
// troque useArtistSongFilter para ler song.views / song.favorited direto.
import type { Song } from './api';

export interface SongWithStats extends Song {
  views: number;
  favorited: number;
}

// djb2 hash -> inteiro pseudo-aleatório determinístico em [0, max). Mesma
// artistSlug+song sempre gera o mesmo número, então o ranking não "pisca"
// entre reloads/re-renders (diferente de Math.random()).
function seededScore(seed: string, max: number): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % max;
}

export function attachMockStats(artistSlug: string, songs: Song[]): SongWithStats[] {
  return songs.map(s => ({
    ...s,
    views: seededScore(`${artistSlug}:${s.slug}:views`, 50_000),
    favorited: seededScore(`${artistSlug}:${s.slug}:fav`, 5_000),
  }));
}
