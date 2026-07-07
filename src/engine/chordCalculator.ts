import type { Tuning, Chord, Voicing, PitchClass, ReverseChordMatch, ChordFormula } from './types';
import { NOTE_NAMES_SHARP, NOTE_NAMES_FLAT, CHORD_FORMULAS } from './tunings';

// Converts a note name (e.g. "C", "F#", "Bb") to a PitchClass (0-11)
export function noteNameToPitchClass(name: string): PitchClass {
  const normalized = name.trim();
  let index = NOTE_NAMES_SHARP.indexOf(normalized);
  if (index !== -1) return index;
  
  index = NOTE_NAMES_FLAT.indexOf(normalized);
  if (index !== -1) return index;
  
  // Handle case-insensitivity or minor typos
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  index = NOTE_NAMES_SHARP.indexOf(upper);
  if (index !== -1) return index;
  
  index = NOTE_NAMES_FLAT.indexOf(upper);
  if (index !== -1) return index;

  throw new Error(`Nota inválida: ${name}`);
}

// Check if a root name indicates we should use flat naming conventions
export function shouldUseFlats(rootName: string): boolean {
  return rootName.includes('b') || rootName === 'F' || rootName === 'd' || rootName === 'g' || rootName === 'c';
}

// Convert MIDI number to note name
export function midiToNoteName(midi: number, useFlats: boolean): string {
  const pc = midi % 12;
  return useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc];
}

// Parse a chord string like "Am7/E" into { root, suffix, bass }
export function parseChordString(chordStr: string): { root: string; suffix: string; bass: string } {
  let root = '';
  let suffix = '';
  let bass = '';

  const parts = chordStr.split('/');
  let mainChord = parts[0].trim();

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    // Um trecho pós-barra é BAIXO invertido apenas quando é uma nota (A–G com # ou b
    // opcional). Caso contrário — dígito puro (13), ou acidente antes do dígito (-9, +5,
    // 9b) — é uma tensão/alteração empilhada e pertence ao sufixo do acorde. Assim
    // distinguimos "Am7/E" (baixo E) de "A7/9" (tensão) e de "G7/4/9/13" (pilha de tensões).
    if (/^[A-Ga-g][#b]?$/.test(part)) {
      bass = part;
    } else {
      mainChord += '/' + part;
    }
  }

  if (mainChord.length >= 2 && (mainChord[1] === '#' || mainChord[1] === 'b')) {
    root = mainChord.slice(0, 2);
    suffix = mainChord.slice(2);
  } else if (mainChord.length >= 1) {
    root = mainChord.slice(0, 1);
    suffix = mainChord.slice(1);
  }

  return { root, suffix, bass };
}

// Transpose a chord string by semitones. Uses +120 offset to handle negative semitones safely.
export function transposeChordString(chordStr: string, semitones: number, preferFlats: boolean): string {
  const { root, suffix, bass } = parseChordString(chordStr);
  if (!root) return chordStr;

  try {
    const rootPc = noteNameToPitchClass(root);
    const transposedRootPc = (rootPc + semitones + 120) % 12;
    const transposedRoot = preferFlats ? NOTE_NAMES_FLAT[transposedRootPc] : NOTE_NAMES_SHARP[transposedRootPc];

    let transposedBass = '';
    if (bass) {
      const bassPc = noteNameToPitchClass(bass);
      const transposedBassPc = (bassPc + semitones + 120) % 12;
      transposedBass = preferFlats ? NOTE_NAMES_FLAT[transposedBassPc] : NOTE_NAMES_SHARP[transposedBassPc];
    }

    return transposedRoot + suffix + (transposedBass ? '/' + transposedBass : '');
  } catch {
    return chordStr;
  }
}

// Unicode / alias normalization — e.g. 'º' (U+00BA ordinal) → '°' (U+00B0 degree)
const SUFFIX_ALIASES: Record<string, string> = {
  'º': '°',     // º → °  (masculine ordinal → degree sign, both mean dim)
  'º7': '°7',   // º7 → °7
  'dim': '°',
  'dim7': '°7',
  'o': '°',
  'o7': '°7',
  '+': 'aug',
  'M7': 'Maj7',
  'maj7': 'Maj7',
  'Δ': 'Maj7',       // Δ → Maj7
  'Δ7': 'Maj7',
  'ø': 'm7(b5)',     // ø → m7(b5) (half-dim)
  'ø7': 'm7(b5)',
  'm+': 'm(#5)',     // m+ → m(#5) (minor augmented)
  'maug': 'm(#5)',
  'm#5': 'm(#5)',
  '4/7': '7sus4',    // notação BR: 4ª + 7ª = 7sus4
  '7/4': '7sus4',
  '4(7)': '7sus4',
  'm7M': 'm(Maj7)',  // notação BR: menor com sétima maior
  'mMaj7': 'm(Maj7)',
  'm(7M)': 'm(Maj7)',
  '6/9': '6(9)',     // notação de barra p/ sexta com nona
  'm6/9': 'm6(9)',
  '69': '6(9)',      // 6/9 grudado (ex.: Db69)
  'm69': 'm6(9)',
};

// Normaliza grafias equivalentes de um sufixo para a forma canônica que a tabela
// (CHORD_FORMULAS) já entende — a 1ª passada do "strangler". O que não virar entrada
// da tabela aqui sai limpo o suficiente para o parser genérico (parseSuffixToFormula)
// montar os intervalos. Regras cobertas:
//   • glifos: º → °
//   • caixa:  maj → Maj  (resolve 'maj9' vs 'Maj9')
//   • 7+ (marca de sétima MAIOR na notação BR) → Maj7  — mas NÃO 7+5/7+9, onde o + é
//     acidente de outro grau (o negative-lookahead evita reescrever nesses casos).
function normalizeSuffix(input: string): string {
  let s = input.trim();
  s = s.replace(/º/g, '°');           // ordinal → grau (dim)
  s = s.replace(/maj/g, 'Maj');       // caixa: maj7/maj9 → Maj7/Maj9
  s = s.replace(/7\+(?![\d#b])/g, 'Maj7'); // 7+ = sétima maior (não 7+5, 7+9)
  return SUFFIX_ALIASES[s] ?? s;
}

// Mapeia um grau (número) para o intervalo composto em semitons a partir da tônica,
// na convenção de tensões de jazz/MPB. Graus baixos (3,4,5,6) têm tratamento próprio
// no parser porque MODIFICAM a tríade em vez de adicionar oitava acima.
function grauParaIntervalo(grau: number): number | null {
  switch (grau) {
    case 2: return 14;  // 2ª tratada como 9ª (nona)
    case 3: return 4;   // terça maior
    case 4: return 5;   // quarta justa
    case 5: return 7;   // quinta justa
    case 6: return 9;   // sexta maior
    case 7: return 10;  // sétima (dominante)
    case 9: return 14;  // nona
    case 11: return 17; // décima primeira
    case 13: return 21; // décima terceira
    default: return null;
  }
}

/**
 * Parser genérico de FALLBACK (strangler): só é chamado por resolveFormula quando o
 * sufixo — já normalizado — NÃO existe em CHORD_FORMULAS. Monta os intervalos por partes:
 * qualidade base (m, 7, Maj7/7M, dim/°, aug, sus...) + pilha de tensões/alterações que
 * podem vir por parênteses (7(9)), parênteses encadeados (7(9)(11)), vírgula (7(9,#11))
 * ou barra (7/4/9/13). Retorna o MESMO formato { intervals, requiredIntervals } da tabela.
 *
 * requiredIntervals (política, alinhada ao Passo 5): obrigatórios = tônica + terça +
 * sétima + quinta ALTERADA (b5/#5) + toda tensão com acidente + a tensão estendida mais
 * aguda (o "nome" do acorde). A quinta JUSTA nunca é obrigatória (é a nota mais
 * descartável); tensões naturais intermediárias também não — assim sempre há voicing tocável.
 */
function parseSuffixToFormula(suffixRaw: string): ChordFormula | null {
  let s = suffixRaw.trim();
  if (s === '') return null; // '' = maior puro, resolvido pela tabela

  let third: number | null = 4; // 4 maior, 3 menor, null = omitida (sus / grau isolado)
  let fifth: number | null = 7; // 7 justa, 6 (b5), 8 (#5), null = omitida
  let seventh: number | null = null; // 10 dominante, 11 maior, 9 diminuta
  const extra = new Set<number>();
  const required = new Set<number>([0]);
  let ok = false;
  let alteredBase = false; // dim/aug: quinta alterada — não implicar 7ª dominante

  // 1) terça menor: 'm' minúsculo inicial (não confundir com 'Maj'/'M' maiúsculo)
  if (s[0] === 'm' && !/^maj/i.test(s)) { third = 3; s = s.slice(1); ok = true; }

  const eat = (re: RegExp): boolean => {
    const m = re.exec(s);
    if (m && m.index === 0) { s = s.slice(m[0].length); return true; }
    return false;
  };

  // 2) qualidades base que alteram quinta / terça. O lookahead (?!M) evita que '°7' seja
  // consumido como diminuta-com-7ª em '°7M' (dim + sétima MAIOR) — nesse caso cai no ramo
  // '°' (tríade dim) e o '7M' seguinte vira sétima maior.
  if (eat(/^(dim7|°7)(?!M)/)) { third = 3; fifth = 6; seventh = 9; required.add(3).add(6).add(9); alteredBase = true; ok = true; }
  else if (eat(/^(dim|°)/)) { third = 3; fifth = 6; required.add(3).add(6); alteredBase = true; ok = true; }
  else if (eat(/^aug/)) { fifth = 8; required.add(8); alteredBase = true; ok = true; }
  else if (eat(/^sus4/)) { third = null; extra.add(5); required.add(5); ok = true; }
  else if (eat(/^sus2/)) { third = null; extra.add(2); required.add(2); ok = true; }
  else if (eat(/^sus/)) { third = null; extra.add(5); required.add(5); ok = true; }

  // 3) marca de sétima
  if (eat(/^(Maj7|M7|7M)/)) { seventh = 11; ok = true; }
  else if (eat(/^7/)) { if (seventh === null) seventh = 10; ok = true; }

  // 4) tensões/alterações restantes: normaliza delimitadores (parênteses, vírgula, barra)
  const rest = s.replace(/[()]/g, ' ').replace(/[,/]/g, ' ').trim();
  const tokens = rest.length ? rest.split(/\s+/) : [];

  let sawExtended = false;  // presença de 9/11/13 (dispara sétima dominante implícita)
  let sawSixth = false;     // presença de 6 (bloqueia sétima implícita: é 6/9, não 9)
  let suppressImplied7 = false; // 'add' explícito não implica sétima
  let maxExt = -1;          // tensão estendida mais aguda (vira obrigatória)

  for (const raw of tokens) {
    let tok = raw;
    if (tok === '') continue;
    // 'sus' pode vir depois da 7ª (ex.: 7sus, Ab7sus) — trata como sus4.
    if (/^sus4?$/i.test(tok)) { third = null; extra.add(5); required.add(5); ok = true; continue; }
    if (/^sus2$/i.test(tok)) { third = null; extra.add(2); required.add(2); ok = true; continue; }
    // marca de sétima maior como TOKEN (dentro de parênteses ou após barra):
    // ex.: m(7M/9), 6(5-/7M). O '7+' já virou 'Maj7' no normalizeSuffix.
    if (/^(Maj7|M7|7M)$/.test(tok)) { seventh = 11; ok = true; continue; }
    const wasAdd = /^add/i.test(tok);
    if (wasAdd) { tok = tok.replace(/^add/i, ''); suppressImplied7 = true; }
    const mm = /^([#b+-]?)(\d+)([#b+-]?)$/.exec(tok);
    // Token não numérico/não reconhecido → NÃO é acorde. Rejeitar em vez de ignorar,
    // senão "Amor" (A + 'mor') viraria Am, poluindo isChordLine com falsos positivos.
    if (!mm) return null;
    const accCh = mm[1] || mm[3];
    const acc = (accCh === '#' || accCh === '+') ? 1 : (accCh === 'b' || accCh === '-') ? -1 : 0;
    const grau = parseInt(mm[2], 10);

    switch (grau) {
      case 3: // terça explícita
        third = 4 + acc; required.add(4 + acc); ok = true; break;
      case 5: // altera a QUINTA (não adiciona nota) — b5/#5 substituem a justa
        if (acc !== 0) { fifth = 7 + acc; required.add(7 + acc); }
        ok = true; break;
      case 4:
        if (wasAdd) { extra.add(5); required.add(5); }        // add4: mantém a terça
        else if (acc > 0) { extra.add(6); required.add(6); }  // #4/#11: tensão, mantém terça
        else if (acc < 0) { extra.add(4); }                   // b4 ~ terça: ignora
        else { third = null; extra.add(5); required.add(5); } // 4 puro = sus4 (sem terça)
        ok = true; break;
      case 2: extra.add(14); ok = true; break;                // 2 como nona adicionada
      case 6: extra.add(9); required.add(9); sawSixth = true; ok = true; break;
      case 7: if (seventh === null) seventh = 10; ok = true; break;
      case 9: case 11: case 13: {
        const iv = grauParaIntervalo(grau)! + acc;
        extra.add(iv);
        if (acc !== 0) required.add(iv); // tensão alterada é característica → obrigatória
        sawExtended = true;
        maxExt = Math.max(maxExt, iv);
        ok = true; break;
      }
      default: break;
    }
  }

  if (!ok) return null;

  // sétima dominante implícita em acordes estendidos (9/11/13) sem sétima explícita,
  // exceto quando é acorde de sexta (6/9), 'add', ou base alterada (dim/aug) — que não
  // trazem a b7.
  if (seventh === null && sawExtended && !sawSixth && !suppressImplied7 && !alteredBase) seventh = 10;

  // monta obrigatórios: terça, quinta alterada, sétima, e a tensão estendida mais aguda
  if (third !== null) required.add(third);
  if (fifth === 6 || fifth === 8) required.add(fifth);
  if (seventh !== null) required.add(seventh);
  if (maxExt > 0) required.add(maxExt);

  const noteSet = new Set<number>([0]);
  if (third !== null) noteSet.add(third);
  if (fifth !== null) noteSet.add(fifth);
  if (seventh !== null) noteSet.add(seventh);
  extra.forEach(iv => noteSet.add(iv));

  const intervals = Array.from(noteSet).sort((a, b) => a - b);
  const requiredIntervals = Array.from(required).sort((a, b) => a - b);

  return {
    name: `Personalizado (${suffixRaw})`,
    suffix: suffixRaw,
    intervals,
    requiredIntervals,
  };
}

// Resolve a fórmula de um sufixo: tabela PRIMEIRO (fonte de verdade, intocada), parser
// genérico só como fallback. Usado por buildChord e isValidChordToken para compartilharem
// exatamente o mesmo vocabulário (tabela + parser).
function resolveFormula(suffix: string): ChordFormula | null {
  const norm = normalizeSuffix(suffix);
  const fromTable = CHORD_FORMULAS.find(f => f.suffix === norm);
  if (fromTable) return fromTable;
  return parseSuffixToFormula(norm);
}

// Valid root note pattern: A-G (upper or lower) optionally followed by b or #
const ROOT_RE = /^[A-Ga-g][b#]?$/;

/**
 * Returns true if `token` is a chord symbol the engine knows how to handle.
 * Accepts every suffix in CHORD_FORMULAS + all SUFFIX_ALIASES + 'N.C.' / 'NC'.
 * Used by isChordLine in cifraUtils.ts so both share the same vocabulary.
 */
export function isValidChordToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (/^N\.?C\.?$/i.test(t)) return true;  // No Chord marker

  const { root, suffix, bass } = parseChordString(t);
  if (!root || !ROOT_RE.test(root)) return false;
  if (bass && !ROOT_RE.test(bass)) return false;
  if (suffix === '') return true;  // plain major chord
  // Tabela primeiro, parser de fallback depois — mesmo vocabulário de buildChord, para
  // isChordLine (cifraUtils) aceitar tudo que o motor sabe montar.
  return resolveFormula(suffix) !== null;
}

// Build a Chord object from root name, formula suffix, and optional bass name
export function buildChord(rootName: string, suffix: string, bassName?: string): Chord {
  const root = noteNameToPitchClass(rootName);
  // Tabela primeiro (comportamento intocado); parser genérico só quando a tabela falha.
  const formula = resolveFormula(suffix);
  if (!formula) {
    throw new Error(`Fórmula não encontrada para o sufixo: ${suffix}`);
  }

  let notes = formula.intervals.map(interval => (root + interval) % 12);
  
  let bass: PitchClass | undefined = undefined;
  if (bassName) {
    bass = noteNameToPitchClass(bassName);
    if (!notes.includes(bass)) {
      notes = [...notes, bass];
    }
  }
  
  return {
    root,
    rootName,
    formula,
    notes,
    bass,
    bassName
  };
}

// Detailed playability evaluator and barre detector
interface PlayabilityResult {
  isValid: boolean;
  fingersUsed: number;
  barre?: {
    fret: number;
    startString: number;
    endString: number;
  };
  stretch: number;
  highestFret: number; // highest fretted position (0 if all-open) — how far up the neck
  playabilityIssues: string[];
  hasInteriorMute?: boolean;
}

export function evaluatePlayability(frets: number[]): PlayabilityResult {
  const issues: string[] = [];
  const fretted = frets.filter(f => f > 0);
  
  if (fretted.length === 0) {
    return { isValid: true, fingersUsed: 0, stretch: 0, highestFret: 0, playabilityIssues: [] };
  }

  const minFret = Math.min(...fretted);
  const maxFret = Math.max(...fretted);
  const stretch = maxFret - minFret;

  // 1. Check fret stretch stretch
  // Usually, a 4-fret stretch is comfortable. 5-fret is only possible at low frets (fret 1-5)
  if (stretch > 4) {
    if (!(stretch === 5 && minFret <= 2)) {
      return { isValid: false, fingersUsed: 99, stretch, highestFret: maxFret, playabilityIssues: ["Abertura de dedos muito grande"] };
    }
  }

  // 2. Identify Barres and count fingers
  let barre: PlayabilityResult['barre'] = undefined;
  let fingersUsed = 0;

  // Find strings fretted at minFret
  const minFretStrings: number[] = [];
  frets.forEach((fret, idx) => {
    if (fret === minFret) {
      minFretStrings.push(idx);
    }
  });

  // A candidate barre exists if 2+ strings sit at minFret with no open (0) string
  // between the first and last of them.
  let candidateBarre: PlayabilityResult['barre'] = undefined;
  if (minFretStrings.length >= 2) {
    const startString = minFretStrings[0];
    const endString = minFretStrings[minFretStrings.length - 1];

    let openStringInBetween = false;
    for (let i = startString; i <= endString; i++) {
      if (frets[i] === 0) {
        openStringInBetween = true;
        break;
      }
    }

    if (!openStringInBetween) {
      candidateBarre = { fret: minFret, startString, endString };
    }
  }

  // A barre (pestana) is only adopted when it is physically NECESSARY — i.e. when
  // fretting each pressed string with its own finger would require more than 4 fingers.
  // Open-position chords like Ré maior (xx0232) or Lá maior (x02220) have <= 4 pressed
  // strings and are played with separate fingers, not a pestana. This prevents shapes
  // such as Ré maior from being wrongly displayed as a barre chord.
  if (candidateBarre && fretted.length > 4) {
    barre = candidateBarre;
    // The index finger does the barre (1 finger); strings above the barre need extra fingers.
    fingersUsed = 1;
    frets.forEach((fret, idx) => {
      if (fret > minFret) {
        fingersUsed++;
      } else if (fret === minFret && (idx < barre!.startString || idx > barre!.endString)) {
        // Fretted at minFret but outside the barre span (rarely happens with standard configurations)
        fingersUsed++;
      }
    });
  } else {
    // No barre needed: each fretted string uses its own finger.
    fingersUsed = fretted.length;
  }

  // Check for interior mutes (muted string between two played strings)
  let firstPlayed = -1;
  let lastPlayed = -1;
  for (let i = 0; i < frets.length; i++) {
    if (frets[i] >= 0) {
      if (firstPlayed === -1) firstPlayed = i;
      lastPlayed = i;
    }
  }
  let hasInteriorMute = false;
  if (firstPlayed !== -1 && lastPlayed !== -1) {
    for (let i = firstPlayed + 1; i < lastPlayed; i++) {
      if (frets[i] === -1) {
        hasInteriorMute = true;
        break;
      }
    }
  }
  if (hasInteriorMute) {
    issues.push("Abafamento de corda interna");
  }

  // Check finger count (max 4 fingers)
  if (fingersUsed > 4) {
    return { isValid: false, fingersUsed, stretch, highestFret: maxFret, playabilityIssues: ["Exige mais de 4 dedos"], hasInteriorMute };
  }

  return {
    isValid: true,
    fingersUsed,
    barre,
    stretch,
    highestFret: maxFret,
    playabilityIssues: issues,
    hasInteriorMute
  };
}

// Difficulty derived purely from the physical shape (independent of the heuristic score).
// The factors are the ones a player actually feels: how far the fingers stretch across
// frets, how many fingers are needed, whether there is a pestana, and interior mutes.
function difficultyFromPlayability(p: PlayabilityResult): { label: 'Fácil' | 'Média' | 'Difícil'; score: number } {
  if (!p.isValid) return { label: 'Difícil', score: 99 };

  let d = 0;
  // Stretch: more frets between the closest and farthest note = harder.
  // 2-fret span adds 1, 3-fret adds 2, etc. (a tight 0-1 span costs nothing).
  d += Math.max(0, p.stretch - 1);
  // Using a 4th finger is noticeably harder than 3 or fewer.
  d += Math.max(0, p.fingersUsed - 3) * 1.5;
  // A pestana (barre) is harder for most players.
  if (p.barre) d += 2;
  // Muting a string between two ringing strings is awkward.
  if (p.hasInteriorMute) d += 1.5;
  // Playing away from the open position (up the neck) is harder to reach and hold.
  if (p.highestFret >= 5) d += 1; // out of the open position (5th fret and beyond)
  if (p.highestFret >= 9) d += 1; // high up the neck

  const label = d <= 1.5 ? 'Fácil' : d <= 3.5 ? 'Média' : 'Difícil';
  return { label, score: d };
}

// Public helper: classify how hard a fret shape is to play.
export function getVoicingDifficulty(frets: number[]): { label: 'Fácil' | 'Média' | 'Difícil'; score: number } {
  return difficultyFromPlayability(evaluatePlayability(frets));
}

// Build a Voicing object from a raw fret array (e.g. a user-edited shape), filling in
// note names, barre/mute info and difficulty so it can be rendered like a generated one.
export function buildVoicingFromFrets(frets: number[], tuning: Tuning, useFlats = false): Voicing {
  const p = evaluatePlayability(frets);
  const notes = frets.map((fret, sIdx) => (fret < 0 ? 'X' : midiToNoteName(tuning.strings[sIdx] + fret, useFlats)));
  return {
    frets: [...frets],
    notes,
    barre: p.barre,
    score: 0,
    playabilityIssues: p.playabilityIssues,
    hasInteriorMute: p.hasInteriorMute,
    difficultyScore: difficultyFromPlayability(p).score,
  };
}

// Generate all valid voicings for a given tuning and chord.
// opts.violaCebolao: for the viola caipira (open tunings like Cebolão), the open strings
// already form a chord, so the characteristic voicing keeps the open bass even when it is
// the 5th (an inversion). In that mode we don't force the root into the bass.
export function calculateVoicings(
  tuning: Tuning,
  chord: Chord,
  maxFret = 12,
  opts: { violaCebolao?: boolean } = {}
): Voicing[] {
  const voicings: Voicing[] = [];
  const numStrings = tuning.strings.length;
  const useFlats = shouldUseFlats(chord.rootName);
  // Conjunto de intervalos obrigatórios em vigor. Começa no estrito da fórmula, mas pode
  // ser relaxado numa 2ª passada se a busca estrita não achar nenhum voicing (ver abaixo)
  // — necessário em instrumentos com poucas cordas (viola 5, cavaquinho 4), onde acordes
  // densos como 7(9/11) exigem mais notas distintas do que cabem nas cordas.
  let activeRequiredIntervals = chord.formula.requiredIntervals;
  const preferOpenBass = !!opts.violaCebolao;

  // Pre-calculate which frets on which strings are part of the chord
  // stringNotes[stringIndex][fret] = { pitchClass, noteName, midi }
  const stringFretNotes: { pitchClass: PitchClass, name: string, midi: number }[][] = [];
  for (let s = 0; s < numStrings; s++) {
    const openMidi = tuning.strings[s];
    stringFretNotes[s] = [];
    // fret 0 to maxFret
    for (let f = 0; f <= maxFret; f++) {
      const midi = openMidi + f;
      const pc = midi % 12;
      stringFretNotes[s][f] = {
        pitchClass: pc,
        name: midiToNoteName(midi, useFlats),
        midi
      };
    }
  }

  // Backtracking recursive search
  const currentFrets: number[] = new Array(numStrings).fill(-1);

  function search(stringIdx: number, activeFrettedCount: number, minFret: number, maxFretVal: number) {
    // Prune early if stretch is already too large
    if (activeFrettedCount > 0 && (maxFretVal - minFret) > 4) {
      // Allow a stretch of 5 ONLY if minFret <= 2 (close to the nut)
      if (!((maxFretVal - minFret) === 5 && minFret <= 2)) {
        return;
      }
    }

    if (stringIdx === numStrings) {
      // We have a complete shape! Let's check playability and completeness.
      validateAndScoreVoicing(currentFrets);
      return;
    }

    // Option 1: Mute string (-1)
    currentFrets[stringIdx] = -1;
    search(stringIdx + 1, activeFrettedCount, minFret, maxFretVal);

    // Option 2: Open string (0)
    const openPc = stringFretNotes[stringIdx][0].pitchClass;
    if (chord.notes.includes(openPc)) {
      currentFrets[stringIdx] = 0;
      search(stringIdx + 1, activeFrettedCount, minFret, maxFretVal);
    }

    // Option 3: Press a fret (1 to maxFret)
    for (let f = 1; f <= maxFret; f++) {
      const pc = stringFretNotes[stringIdx][f].pitchClass;
      if (chord.notes.includes(pc)) {
        currentFrets[stringIdx] = f;
        
        const newMin = minFret === -1 ? f : Math.min(minFret, f);
        const newMax = maxFretVal === -1 ? f : Math.max(maxFretVal, f);
        
        search(stringIdx + 1, activeFrettedCount + 1, newMin, newMax);
      }
    }
  }

  function validateAndScoreVoicing(frets: number[]) {
    // 1. Check that we are not muting too many strings (at least 3 strings must be played)
    const playedStrings = frets.filter(f => f >= 0);
    if (playedStrings.length < Math.min(3, numStrings)) {
      return;
    }

    // 2. Check if all required intervals are present
    const playedPitchClasses = new Set<PitchClass>();
    frets.forEach((fret, sIdx) => {
      if (fret >= 0) {
        playedPitchClasses.add(stringFretNotes[sIdx][fret].pitchClass);
      }
    });

    let requiredPcs = activeRequiredIntervals
      ? activeRequiredIntervals.map(interval => (chord.root + interval) % 12)
      : chord.notes;

    if (chord.customNotes) {
      requiredPcs = Array.from(new Set([...requiredPcs, ...chord.customNotes]));
    }

    if (chord.bass !== undefined && !requiredPcs.includes(chord.bass)) {
      requiredPcs = [...requiredPcs, chord.bass];
    }

    const hasAllRequired = requiredPcs.every(pc => playedPitchClasses.has(pc));
    if (!hasAllRequired) {
      return;
    }

    // 3. Evaluate physical playability
    const playability = evaluatePlayability(frets);
    if (!playability.isValid) {
      return;
    }

    // 4. Calculate note names played
    const notesPlayed = frets.map((fret, sIdx) => {
      if (fret === -1) return "X";
      return stringFretNotes[sIdx][fret].name;
    });

    // 5. Score voicing
    let score = 100;

    // A. Bass note correctness
    // Find lowest played string (for EADGBE, lowest string is index 0. For Cebolão, index 0 is 5th pair, Lá2)
    // Wait, let's verify if index 0 is indeed the lowest string.
    // In PRESET_INSTRUMENTS, the strings array is [lowest, ..., highest]. Yes, index 0 is lowest!
    let lowestPlayedIdx = -1;
    for (let i = 0; i < numStrings; i++) {
      if (frets[i] >= 0) {
        lowestPlayedIdx = i;
        break;
      }
    }

    let bassIsRoot = false;
    if (lowestPlayedIdx !== -1) {
      const bassPc = stringFretNotes[lowestPlayedIdx][frets[lowestPlayedIdx]].pitchClass;
      if (chord.bass !== undefined) {
        if (bassPc !== chord.bass) {
          return; // Discard this voicing because it doesn't have the requested bass note as the lowest note
        }
        score += 35; // Got the exact requested bass note!
      } else if (!preferOpenBass) {
        // Standard instruments: prefer the root in the bass (fundamental position).
        if (bassPc === chord.root) {
          score += 45; // Bass is the root (tônica / 1º grau)! Strongly preferred.
          bassIsRoot = true;
        } else {
          score -= 30; // Inversion (bass is 3rd, 5th, etc.). Valid but less standard.
        }
      }
      // Viola (preferOpenBass): no root/inversion adjustment — the open bass is idiomatic.
    } else {
      if (chord.bass !== undefined) {
        return; // No strings played, but bass was requested
      }
    }

    // B. Fret Stretch penalty
    score -= playability.stretch * 12;

    // C. Finger Count penalty
    // Para tríades simples, menos dedos = mais fácil = melhor.
    // MAS para acordes complexos (sétimas, nonas), os shapes clássicos (jazz/bossa) EXIGEM 3 ou 4 dedos.
    // Se punirmos dedos aqui, shapes bizarros com cordas soltas ganham dos clássicos.
    const isComplexChord = chord.formula.suffix.includes('7') || chord.formula.suffix.includes('9') || chord.formula.suffix.includes('dim');
    if (!isComplexChord) {
      score -= playability.fingersUsed * 8;
    } else {
      // Para acordes complexos, não punimos o uso de 3 ou 4 dedos. 
      // Na verdade, penalizamos apenas se usar dedos DEMAIS (ex: 5 dedos se fosse possível, o que já é barrado).
      // Um pequeno bônus pode ser dado se for um shape clássico de 4 dedos agrupados (sem cordas soltas)
      if (playability.fingersUsed === 4) {
        score += 5; // Valoriza o shape fechado clássico
      }
    }

    // D. Barre penalty
    if (playability.barre) {
      score -= 15;
    }

    // E. Open Strings bonus
    const openCount = frets.filter(f => f === 0).length;
    if (!isComplexChord) {
      score += openCount * 18; // Tríades adoram cordas soltas
    } else {
      score += openCount * 5; // Acordes complexos não dependem tanto de cordas soltas (às vezes atrapalham a sonoridade)
    }

    // F. Average Fret penalty (strongly prefer shapes closer to the nut — the
    // traditional open chords. Without a firm position penalty, a full-ringing shape
    // high up the neck can outscore the open shape that mutes a couple of low strings.)
    const frettedOnly = frets.filter(f => f > 0);
    if (frettedOnly.length > 0) {
      const avgFret = frettedOnly.reduce((a, b) => a + b, 0) / frettedOnly.length;
      score -= avgFret * 7;
    }

    // G. Muted strings penalty (we want full ringing strings, especially on Viola)
    const mutedCount = frets.filter(f => f === -1).length;
    score -= mutedCount * 15;

    // G2. Interior muted string penalty (muting inside played strings is hard!)
    if (playability.hasInteriorMute) {
      score -= 35;
    }

    // H. Completeness bonus (if it has optional tones too)
    const totalUniqueChordTones = chord.notes.length;
    const playedUniqueChordTones = Array.from(playedPitchClasses).filter(pc => chord.notes.includes(pc)).length;
    if (playedUniqueChordTones === totalUniqueChordTones) {
      score += 15; // Complete chord voicing!
    }

    // I. Filtro especial para acordes com sétima
    // Prioriza os que preencham mais mas não repitam notas, 
    // e caso repitam, que repitam a sétima.
    const isSeventhChord = chord.formula.suffix.includes('7') || chord.formula.suffix.includes('dim7');
    if (isSeventhChord) {
      const playedPcsList = frets.filter(f => f >= 0).map((f, sIdx) => stringFretNotes[sIdx][f].pitchClass);
      const uniquePcsCount = new Set(playedPcsList).size;
      const totalPlayedStrings = playedPcsList.length;
      const repeatedNotesCount = totalPlayedStrings - uniquePcsCount;

      if (repeatedNotesCount === 0) {
        // Preenche mais cordas sem repetir notas
        score += totalPlayedStrings * 10;
      } else {
        // Tenta encontrar o intervalo da sétima (9, 10, ou 11 semitons acima da tônica)
        const seventhInterval = chord.formula.intervals.find(i => [9, 10, 11].includes(i % 12));
        if (seventhInterval !== undefined) {
          const seventhPc = (chord.root + seventhInterval) % 12;
          const seventhPlayedCount = playedPcsList.filter(pc => pc === seventhPc).length;
          
          if (seventhPlayedCount > 1) {
            // Prioriza repetição da sétima
            score += (seventhPlayedCount - 1) * 12; 
          }
          
          const otherRepeats = repeatedNotesCount - (seventhPlayedCount > 1 ? seventhPlayedCount - 1 : 0);
          // Penaliza repetição de outras notas
          score -= otherRepeats * 5;
        }
      }
    }

    // J. Filtro para Acordes Maiores
    // Prioridade para acordes mais "cheios" (com o maior número de notas sendo tocadas)
    // para que o acorde maior soe bem "maior" e encorpado.
    if (chord.formula.name === "Maior" || chord.formula.suffix === "") {
      const playedStringsCount = frets.filter(f => f >= 0).length;
      // Bônus forte pela quantidade de cordas soando simultaneamente
      score += playedStringsCount * 12;
      
      // Bônus extra se usar literalmente todas as cordas do instrumento
      if (playedStringsCount === numStrings) {
        score += 25;
      }

      // Se preferir focar estritamente em notas *pressionadas* (f > 0)
      const frettedCount = frets.filter(f => f > 0).length;
      score += frettedCount * 5;
    }

    voicings.push({
      frets: [...frets],
      notes: notesPlayed,
      barre: playability.barre,
      score: Math.max(1, Math.round(score)),
      playabilityIssues: playability.playabilityIssues,
      hasInteriorMute: playability.hasInteriorMute,
      bassIsRoot,
      difficultyScore: difficultyFromPlayability(playability).score
    });
  }

  // Kick off search
  // search(stringIdx, activeFrettedCount, minFret, maxFretVal)
  search(0, 0, -1, -1);

  // Fallback p/ instrumentos com poucas cordas: se o conjunto obrigatório ESTRITO não
  // produziu nenhum voicing (ex.: 7(9/11) na viola cebolão-ré, que exige 5 notas distintas
  // em 5 cordas com o baixo preso), relaxa dropando as extensões naturais superiores
  // (9=14, 11=17, 13=21) — as mais omissíveis — e refaz a busca. Mantém tônica, terça,
  // sétima e alterações características. Só dispara quando o resultado seria vazio, então
  // não muda nada para acordes/instrumentos que já geravam voicings (ex.: violão).
  if (voicings.length === 0 && chord.formula.requiredIntervals) {
    const relaxado = chord.formula.requiredIntervals.filter(iv => iv !== 14 && iv !== 17 && iv !== 21);
    if (relaxado.length >= 2 && relaxado.length < chord.formula.requiredIntervals.length) {
      activeRequiredIntervals = relaxado;
      search(0, 0, -1, -1);
    }
  }

  // Sort voicings (priorities, in order):
  // 1. Voicings without interior mutes first
  // 2. Difficulty band: Fácil → Média → Difícil (easy shapes first)
  // 3. Neck position: shapes toward the nut (left side of the neck) first. Variations
  //    are grouped into 4-fret regions so the open/low shapes always come before the
  //    ones high up the neck. (A shape at the 7th–10th fret must never be offered before
  //    a near-the-nut shape, even a thin one with the root in the bass.)
  // 4. Bass on the root (tônica / 1º grau) first — within a region, fundamental position
  //    wins (this is what makes the open root chord the #0). Skipped on viola, where
  //    bassIsRoot is never set, so the characteristic open bass wins on score.
  // 5. Score descending (within a region, the best-sounding / fullest shape)
  // 6. Finer difficulty, then absolute lowest fret.
  const positionRegion = (v: Voicing) => {
    const maxFret = Math.max(...v.frets.filter(f => f > 0), 0);
    return Math.floor(maxFret / 4); // 0: posição aberta (casas 0–3), 1: 4ª–7ª, 2: 8ª–11ª, ...
  };
  // Coarse difficulty band from the stored physical difficulty score.
  const difficultyBand = (v: Voicing) => {
    const d = v.difficultyScore ?? 0;
    return d <= 1.5 ? 0 : d <= 3.5 ? 1 : 2; // 0: Fácil, 1: Média, 2: Difícil
  };
  return voicings.sort((a, b) => {
    const muteA = a.hasInteriorMute ? 1 : 0;
    const muteB = b.hasInteriorMute ? 1 : 0;
    if (muteA !== muteB) {
      return muteA - muteB; // 0 (sem abafamento) antes de 1 (com abafamento)
    }
    const bandA = difficultyBand(a);
    const bandB = difficultyBand(b);
    if (bandA !== bandB) {
      return bandA - bandB; // fáceis, depois médios, depois difíceis
    }
    const regionA = positionRegion(a);
    const regionB = positionRegion(b);
    if (regionA !== regionB) {
      return regionA - regionB; // canto esquerdo do braço primeiro
    }
    if (a.bassIsRoot !== b.bassIsRoot) {
      return a.bassIsRoot ? -1 : 1; // baixo na tônica primeiro
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const diffA = a.difficultyScore ?? 0;
    const diffB = b.difficultyScore ?? 0;
    if (diffA !== diffB) {
      return diffA - diffB; // acorde mais fácil primeiro
    }
    const maxFretA = Math.max(...a.frets.filter(f => f > 0), 0);
    const maxFretB = Math.max(...b.frets.filter(f => f > 0), 0);
    return maxFretA - maxFretB;
  });
}

export function detectChord(frets: number[], tuning: Tuning): ReverseChordMatch[] {

  
  // Calculate midi notes played
  const playedMidis: number[] = [];
  let lowestPlayedMidi = -1;
  
  frets.forEach((fret, sIdx) => {
    if (fret >= 0) {
      const midi = tuning.strings[sIdx] + fret;
      playedMidis.push(midi);
      if (lowestPlayedMidi === -1 || midi < lowestPlayedMidi) {
        lowestPlayedMidi = midi;
      }
    }
  });

  if (playedMidis.length === 0) return [];

  const playedPcs = Array.from(new Set(playedMidis.map(m => m % 12)));
  const bassPc = lowestPlayedMidi % 12;
  const useFlats = playedPcs.some(pc => [10, 3, 8, 1].includes(pc)); // heuristic: if has Bb, Eb, Ab, Db
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const bassNoteName = noteNames[bassPc];

  const matches: ReverseChordMatch[] = [];

  // Iterate over all possible roots (0 to 11)
  for (let r = 0; r < 12; r++) {
    const rootName = noteNames[r];
    
    // Check all chord formulas
    CHORD_FORMULAS.forEach(formula => {
      const formulaPcs = formula.intervals.map(i => (r + i) % 12);
      const requiredPcs = formula.requiredIntervals 
        ? formula.requiredIntervals.map(i => (r + i) % 12)
        : formulaPcs;

      // 1. All played notes must belong to the formula
      const allPlayedAreInFormula = playedPcs.every(pc => formulaPcs.includes(pc));
      
      // 2. All required notes of the formula must be played
      const allRequiredArePlayed = requiredPcs.every(pc => playedPcs.includes(pc));

      if (allPlayedAreInFormula && allRequiredArePlayed) {
        // Is it a perfect match? (Played note classes exactly match the formula pitch classes)
        const isPerfectMatch = playedPcs.length === formulaPcs.length && 
          playedPcs.every(pc => formulaPcs.includes(pc)) &&
          formulaPcs.every(pc => playedPcs.includes(pc));
          
        const isInversion = bassPc !== r;
        
        // Build chord name (e.g. C7 or C7/E)
        let chordName = `${rootName}${formula.suffix}`;
        if (isInversion) {
          chordName += `/${bassNoteName}`;
        }

        matches.push({
          chordName,
          rootName,
          suffix: formula.suffix,
          isPerfectMatch,
          isInversion,
          bassNoteName
        });
      }
    });
  }

  // Ordenação — mostra o "baixo em" (inversão) quando o grave real não é a fundamental,
  // em vez de colapsar num acorde exótico de raiz na nota do baixo. Critérios, em ordem:
  //   1. Match exato do conjunto de notas primeiro (isPerfectMatch).
  //   2. Qualidade comum vence qualidade EXÓTICA: uma tríade maior/menor invertida se
  //      disfarça de acorde raro na nota do grave (D–F#–A com F# no baixo casa com
  //      F#m(#5)). Preferimos a leitura comum expressa como slash chord → "D/F#", não
  //      "F#m(#5)". (Só de desempate: se o acorde exótico for o ÚNICO match, ele aparece.)
  //   3. Baixo coerente: dentro da mesma classe de qualidade, posição fundamental (raiz no
  //      grave) antes de inversão — assim "C6" (Dó no grave) não vira "Am7/C". O slash só
  //      assume o topo quando o grave NÃO é a fundamental, pois aí a posição fundamental
  //      do mesmo acorde nem chega a ser gerada (o laço só cria candidatos cuja fórmula
  //      casa com as notas tocadas — nunca inventa raiz na nota do baixo).
  //   4. Determinismo: nome mais curto (mais simples), depois alfabético.
  // Escopo por instrumento (Cuidado 2): vale para TODOS os instrumentos. detectChord é
  // reconhecimento reverso (nomeia o que está sendo tocado) e um baixo diferente da
  // fundamental É uma inversão em qualquer instrumento. O preferOpenBass da viola atua só
  // na GERAÇÃO de voicings (calculateVoicings), não aqui. Para suprimir por instrumento no
  // futuro, bastaria um parâmetro opcional — sem quebrar a assinatura atual.
  return matches.sort((a, b) => {
    if (a.isPerfectMatch !== b.isPerfectMatch) {
      return a.isPerfectMatch ? -1 : 1;
    }
    const exoticaA = QUALIDADES_EXOTICAS.has(a.suffix) ? 1 : 0;
    const exoticaB = QUALIDADES_EXOTICAS.has(b.suffix) ? 1 : 0;
    if (exoticaA !== exoticaB) {
      return exoticaA - exoticaB; // qualidade comum (0) antes da exótica (1)
    }
    if (a.isInversion !== b.isInversion) {
      return a.isInversion ? 1 : -1; // posição fundamental antes da inversão
    }
    if (a.chordName.length !== b.chordName.length) {
      return a.chordName.length - b.chordName.length;
    }
    return a.chordName.localeCompare(b.chordName);
  });
}

// Qualidades raras nas quais uma tríade maior/menor invertida acaba casando por engano
// (a 3ª no grave de um acorde maior forma um "m(#5)" de raiz nessa 3ª). Entre matches
// igualmente exatos, essas leituras cedem lugar ao slash chord da qualidade comum.
const QUALIDADES_EXOTICAS = new Set<string>(['m(#5)', 'm6-']);

