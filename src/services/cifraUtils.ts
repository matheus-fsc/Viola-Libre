// Chord-token and cifra-line utilities shared between CifraGridEditor and useCifraTextStore.
// No React, no Zustand, no timing types — pure text/chord logic.

import { isValidChordToken, splitChordAnnotation, transposeChordString } from '../engine/chordCalculator';

export { isValidChordToken };

export interface ChordPos { text: string; col: number; }

// A barra de compasso pode separar acordes mesmo sem espaço. A barra do baixo é '/'.
const CHORD_TOKEN_RE = /[^\s|]+/g;

export function isChordLine(line: string): boolean {
  // Parênteses soltos agrupam uma sequência de acordes, às vezes quebrada em duas linhas:
  // "( A7  D7  C#7" e "F#m  G7 )  A7" (Punk da Periferia). Sozinhos não são palavra.
  const tokens = (line.match(CHORD_TOKEN_RE) ?? []).filter(token => !/^[()]+$/.test(token));
  return tokens.length > 0 && tokens.every(isValidChordToken);
}

export function parseChordLine(line: string): ChordPos[] {
  const result: ChordPos[] = [];
  for (const match of line.matchAll(CHORD_TOKEN_RE)) {
    if (!isValidChordToken(match[0])) continue;
    const { prefix, core } = splitChordAnnotation(match[0]);
    result.push({ text: core, col: match.index + prefix.length });
  }
  return result;
}

export function chordLineAnnotations(line: string, chords: ChordPos[]): ChordPos[] {
  const result: ChordPos[] = [];
  let start = 0;
  for (const { col, text } of chords) {
    for (const match of line.slice(start, col).matchAll(/\S+/g)) {
      result.push({ text: match[0], col: start + match.index });
    }
    start = col + text.length;
  }
  for (const match of line.slice(start).matchAll(/\S+/g)) {
    result.push({ text: match[0], col: start + match.index });
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

function renderChordLine(line: string, semitones: number): string {
  let html = '';
  let end = 0;
  for (const { text, col } of parseChordLine(line)) {
    const chord = semitones === 0 ? text : transposeChordString(text, semitones, false);
    html += escapeHtml(line.slice(end, col)) + '<b>' + escapeHtml(chord) + '</b>';
    end = col + text.length;
  }
  return html + escapeHtml(line.slice(end));
}

// Os índices dos timings seguem as quebras do texto original, mesmo quando o HTML cria outras quebras visuais.
export function cifraTimingLines(html: string): string[] {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').split('\n');
}

export function formatCifraChordHtml(html: string, semitones = 0): string {
  const decodeAnnotations = (text: string) =>
    text.replace(/&nbsp;/g, '\u00a0').replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&apos;|&#39;|&#x27;/gi, "'");

  return html.split(/(\n|<br\s*\/?>|<\/?pre\b[^>]*>)/gi).map(line => {
    // O acervo pode trazer a pontuação dentro ou fora de <b>, ou até omitir a marcação.
    // Reconhece a linha inteira antes de recolocar as tags só nos núcleos.
    const plain = decodeAnnotations(line.replace(/<\/?b>/gi, ''));
    if (isChordLine(plain)) return renderChordLine(plain, semitones);

    // Em linhas mistas a marcação da fonte indica quais trechos são acordes.
    return line.replace(/<b>(.*?)<\/b>/gi, (tag, body: string) => {
      const text = decodeAnnotations(body);
      if (isChordLine(text)) return renderChordLine(text, semitones);
      // Algumas grafias do acervo, como A7m, são tratadas na hora de montar o diagrama.
      return semitones === 0 ? tag : '<b>' + transposeChordString(body, semitones, false) + '</b>';
    });
  }).join('');
}

// Rebuilds a chord-line + lyric-line pair as a sequence of inline word units, each unit
// stacking its chord (if any) directly above its word. Browsers wrap between units at the
// normal space boundaries, so a chord always travels with the word it's anchored to instead
// of the chord-line and lyric-line reflowing independently and drifting out of column-alignment.
function buildReflowedPair(chordLine: string, lyricLine: string, timingAttributes: string): string {
  const chords = parseChordLine(chordLine);
  const words = [...lyricLine.matchAll(/\S+/g)].map(m => ({ text: m[0], col: m.index }));

  if (words.length === 0) {
    return `<div class="cifra-line">${chordLine}</div><div class="cifra-line">${lyricLine}</div>`;
  }

  const chordsByWord = new Map<number, string[]>();
  const trailing: string[] = [];
  let start = 0;
  for (const [index, c] of chords.entries()) {
    const coreEnd = c.col + c.text.length;
    const next = chords[index + 1];
    // Se há espaço entre dois acordes, o prefixo acompanha o que vem depois do espaço.
    // Sem espaço, uma barra de compasso compartilhada fica com o acorde anterior.
    const gap = chordLine.slice(coreEnd, next?.col);
    const end = next
      ? coreEnd + gap.search(/\s/.test(gap) ? /\S*$/ : /[([]*$/)
      : chordLine.length;
    const marked = escapeHtml(chordLine.slice(start, c.col)) + '<b>' + escapeHtml(c.text) + '</b>'
      + escapeHtml(chordLine.slice(coreEnd, end));
    const targetIdx = words.findIndex(w => c.col < w.col + w.text.length);
    if (targetIdx === -1) trailing.push(marked);
    else chordsByWord.set(targetIdx, [...(chordsByWord.get(targetIdx) ?? []), marked]);
    start = end;
  }

  // Cada acorde vira seu proprio <b> dentro do conteiner .cifra-word-chord — mesmo quando
  // varios acordes se empilham sobre a mesma palavra. Assim cada acorde continua sendo um
  // alvo de clique/hover individual (o viewer le b.textContent como nome do acorde); junta-los
  // num unico <b> faria o nome virar "F7/A Bb7(9/11)", invalido para diagrama e som.
  const chordCell = (list: string[] | undefined) =>
    list && list.length > 0 ? list.join('').trim() : ' ';

  const units = words.map((w, idx) =>
    `<span class="cifra-word"><span class="cifra-word-chord">${chordCell(chordsByWord.get(idx))}</span><span class="cifra-word-text">${escapeHtml(w.text)}</span></span>`
  );

  if (trailing.length > 0) {
    units.push(`<span class="cifra-word"><span class="cifra-word-chord">${chordCell(trailing)}</span><span class="cifra-word-text">\u00A0</span></span>`);
  }

  return `<div class="cifra-line cifra-line-paired"${timingAttributes}>${units.join(' ')}</div>`;
}

// Uma linha por <div> permite quebrar o texto em telas estreitas. Quando há letra abaixo,
// buildReflowedPair mantém o acorde e a palavra correspondente juntos na quebra.
export function reflowCifraHtml(html: string, firstTimingLine?: number): string {
  // Drop any stray <pre> wrapper tags left over from upstream tab-block extraction — they'd
  // otherwise force white-space:pre on part of the content via the browser's own stylesheet.
  const cleaned = formatCifraChordHtml(html.replace(/<\/?pre[^>]*>/gi, ''));
  const lines = cleaned.split(/(\n|<br\s*\/?>)/gi);
  const out: string[] = [];

  let timingLine = firstTimingLine ?? 0;
  const indexAttribute = (index: number) => firstTimingLine === undefined ? '' : ` data-timing-line="${index}"`;
  for (let i = 0; i < lines.length; i += 2) {
    const index = timingLine;
    // O editor conta as quebras do texto original. Um <br> sozinho só muda o layout.
    if (lines[i + 1] === '\n') timingLine++;
    const line = lines[i];
    const plain = line.replace(/<[^>]+>/g, '');

    if (plain.trim() === '') {
      out.push(`<div class="cifra-line cifra-line-blank"${indexAttribute(index)}>&nbsp;</div>`);
      continue;
    }

    if (isChordLine(plain)) {
      const nextLine = lines[i + 2];
      const nextPlain = nextLine !== undefined ? nextLine.replace(/<[^>]+>/g, '') : '';
      const nextIsLyric = nextLine !== undefined && nextPlain.trim() !== '' && !isChordLine(nextPlain);
      if (nextIsLyric) {
        const attrs = firstTimingLine === undefined ? '' : `${indexAttribute(timingLine)} data-timing-chord="${index}"`;
        out.push(buildReflowedPair(plain, nextPlain, attrs));
        if (lines[i + 3] === '\n') timingLine++;
        i += 2;
        continue;
      }
    }

    const chord = firstTimingLine !== undefined && isChordLine(plain) ? ' data-timing-chord-row' : '';
    out.push(`<div class="cifra-line"${indexAttribute(index)}${chord}>${line}</div>`);
  }

  return out.join('');
}
