// Chord-token and cifra-line utilities shared between CifraGridEditor and useCifraTextStore.
// No React, no Zustand, no timing types — pure text/chord logic.

import { isValidChordToken } from '../engine/chordCalculator';

export { isValidChordToken };

export interface ChordPos { text: string; col: number; }

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return trimmed.split(/\s+/).every(t => isValidChordToken(t));
}

export function parseChordLine(line: string): ChordPos[] {
  const result: ChordPos[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === ' ') { i++; continue; }
    const start = i;
    while (i < line.length && line[i] !== ' ') i++;
    result.push({ text: line.slice(start, i), col: start });
  }
  return result;
}

export function buildChordLineText(chords: ChordPos[]): string {
  const sorted = [...chords].sort((a, b) => a.col - b.col);
  let result = '';
  for (const c of sorted) {
    if (result.length > c.col) result += ' ' + c.text;
    else { while (result.length < c.col) result += ' '; result += c.text; }
  }
  return result;
}

// Converts a pixel offset into a column count using the monospace ruler width (getCharW()
// in CifraGridEditor). Shared by chord-drag delta math (useCifraTextStore.updateChordDrag)
// and absolute click-to-column math (CifraGridEditor marker placement).
export function pixelDeltaToCol(deltaX: number, charW: number): number {
  return Math.round(deltaX / charW);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Rebuilds a chord-line + lyric-line pair as a sequence of inline word units, each unit
// stacking its chord (if any) directly above its word. Browsers wrap between units at the
// normal space boundaries, so a chord always travels with the word it's anchored to instead
// of the chord-line and lyric-line reflowing independently and drifting out of column-alignment.
function buildReflowedPair(chordLine: string, lyricLine: string): string {
  const chords = parseChordLine(chordLine);
  const words = parseChordLine(lyricLine); // generic space tokenizer — reused for lyric words

  if (words.length === 0) {
    return `<div class="cifra-line">${chordLine}</div><div class="cifra-line">${lyricLine}</div>`;
  }

  const chordsByWord = new Map<number, string[]>();
  const trailing: string[] = [];
  for (const c of chords) {
    const targetIdx = words.findIndex(w => c.col < w.col + w.text.length);
    if (targetIdx === -1) trailing.push(c.text);
    else chordsByWord.set(targetIdx, [...(chordsByWord.get(targetIdx) ?? []), c.text]);
  }

  // Cada acorde vira seu proprio <b> dentro do conteiner .cifra-word-chord — mesmo quando
  // varios acordes se empilham sobre a mesma palavra. Assim cada acorde continua sendo um
  // alvo de clique/hover individual (o viewer le b.textContent como nome do acorde); junta-los
  // num unico <b> faria o nome virar "F7/A Bb7(9/11)", invalido para diagrama e som.
  const chordCell = (list: string[] | undefined) =>
    list && list.length > 0 ? list.map(c => `<b>${escapeHtml(c)}</b>`).join(' ') : ' ';

  const units = words.map((w, idx) =>
    `<span class="cifra-word"><span class="cifra-word-chord">${chordCell(chordsByWord.get(idx))}</span><span class="cifra-word-text">${escapeHtml(w.text)}</span></span>`
  );

  if (trailing.length > 0) {
    units.push(`<span class="cifra-word"><span class="cifra-word-chord">${chordCell(trailing)}</span><span class="cifra-word-text">\u00A0</span></span>`);
  }

  return `<div class="cifra-line cifra-line-paired">${units.join(' ')}</div>`;
}

// Restructures raw cifra HTML (lines separated by literal \n, chords as <b>) into block-level
// per-line <div>s so it can wrap normally on narrow screens. Chord-line-over-lyric-line pairs
// get rebuilt via buildReflowedPair so the chord/word relationship survives wrapping; every
// other line (section headers, chord-only lines with no lyric under them, blank lines) is kept
// as-is since there's no column alignment to protect.
export function reflowCifraHtml(html: string): string {
  // Drop any stray <pre> wrapper tags left over from upstream tab-block extraction — they'd
  // otherwise force white-space:pre on part of the content via the browser's own stylesheet.
  const cleaned = html.replace(/<\/?pre[^>]*>/gi, '');
  const lines = cleaned.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const plain = line.replace(/<[^>]+>/g, '');

    if (plain.trim() === '') {
      out.push('<div class="cifra-line cifra-line-blank">&nbsp;</div>');
      continue;
    }

    if (isChordLine(plain)) {
      const nextLine = lines[i + 1];
      const nextPlain = nextLine !== undefined ? nextLine.replace(/<[^>]+>/g, '') : '';
      const nextIsLyric = nextLine !== undefined && nextPlain.trim() !== '' && !isChordLine(nextPlain);
      if (nextIsLyric) {
        out.push(buildReflowedPair(plain, nextPlain));
        i++; // consumed the lyric line too
        continue;
      }
    }

    out.push(`<div class="cifra-line">${line}</div>`);
  }

  return out.join('');
}
