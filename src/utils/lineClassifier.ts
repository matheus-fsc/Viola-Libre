import { isChordLine } from '../services/cifraUtils';

const SECTION_LINE_RE = /^\[([^\]]+)\]$/;
const INSTR_RE =
  /\b(interlude|interlúdio|interludio|solo|ponte|bridge|instrumental|intro|introdução|introducao|finalização)\b/i;

// Unbracketed section labels inserted by auto-detection scripts (e.g. "Intro", "Verso 1").
// Only matches a standalone keyword — never a lyric that happens to start with one.
const UNBRACKETED_SECTION_RE =
  /^(intro(?:dução|ducao)?|vers[oa](?:\s+\d+)?|\d+[oa]?\s+vers[oa]|refrão|refr[aã]o|coro|pré.?refrão|pre.?refr[aã]o|ponte|bridge|solo(?:\s+\d+)?|final(?:ização)?|outro)$/i;

// Tab detection — same three forms as tabTransposer.ts
const TAB_LABELED_RE  = /^[A-Ga-g#b]{1,3}\|/;          // E|---0---  or  G#|---
const TAB_ANON_RE     = /^\|+[-x0-9hpb/\\~^.]/;         // |---0---  or  ||---
const TAB_BARE_RE     = /^[-0-9xhpb/\\~^.]+$/;          // bare: ---0-2---

function isTabLine(trimmed: string): boolean {
  if (TAB_LABELED_RE.test(trimmed) || TAB_ANON_RE.test(trimmed)) return true;
  // Bare tab: only tab chars, at least 4 chars, has a digit/x AND a dash
  return TAB_BARE_RE.test(trimmed) && trimmed.length >= 4
    && /[0-9x]/.test(trimmed) && /-/.test(trimmed);
}

/** Classification of a single raw line from useCifraTextStore.lines.
 *  Blank lines return 'lyric' — callers that need to exclude blanks must
 *  additionally check `line.trim() !== ''`. */
export type LineType = 'chord' | 'section' | 'instrumental' | 'tab' | 'lyric';

/**
 * Classify one cifra text line.
 *
 * - 'section':      [Cabeçalho] genérico (Verso, Refrão, Ponte…)
 * - 'instrumental': [Intro] / [Solo] / [Ponte] / keywords do INSTR_RE
 * - 'chord':        linha cujos tokens são todos símbolos de acorde válidos
 * - 'tab':          linha de tablatura (E|---0, |---0, ou bare ---0-2---)
 * - 'lyric':        todo o resto, incluindo linhas em branco
 */
export function classifyLine(line: string): LineType {
  const trimmed = line.trim();
  if (!trimmed) return 'lyric';
  if (SECTION_LINE_RE.test(trimmed)) {
    return INSTR_RE.test(trimmed) ? 'instrumental' : 'section';
  }
  if (UNBRACKETED_SECTION_RE.test(trimmed)) {
    return INSTR_RE.test(trimmed) ? 'instrumental' : 'section';
  }
  if (isChordLine(line)) return 'chord';
  if (isTabLine(trimmed)) return 'tab';
  return 'lyric';
}
