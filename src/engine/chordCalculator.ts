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
// Two INDEPENDENT metrics are computed here, deliberately kept apart:
//   • shapeScore  — difficulty of the LEFT HAND SHAPE: how far the fingers stretch, how
//     many fingers, pestana, and how far up the neck. This is what ranks voicings by
//     "hand difficulty".
//   • techniqueScore — difficulty of TECHNIQUE (deliberate muting / palm mute; in the
//     future also palhetada and ligados). A muted string is not "one more finger", so it
//     must NOT inflate the shape ranking (see item 1). It lives on its own axis.
// `score`/`label` reflect the SHAPE only, so interior mutes never make a shape rank harder
// than the same fretted shape without the mute.
function difficultyFromPlayability(
  p: PlayabilityResult
): { label: 'Fácil' | 'Média' | 'Difícil'; score: number; shapeScore: number; techniqueScore: number } {
  if (!p.isValid) return { label: 'Difícil', score: 99, shapeScore: 99, techniqueScore: 0 };

  let shape = 0;
  // Stretch: more frets between the closest and farthest note = harder.
  // 2-fret span adds 1, 3-fret adds 2, etc. (a tight 0-1 span costs nothing).
  shape += Math.max(0, p.stretch - 1);
  // Using a 4th finger is noticeably harder than 3 or fewer.
  shape += Math.max(0, p.fingersUsed - 3) * 1.5;
  // A pestana (barre) is harder for most players.
  if (p.barre) shape += 2;
  // Playing away from the open position (up the neck) is harder to reach and hold.
  if (p.highestFret >= 5) shape += 1; // out of the open position (5th fret and beyond)
  if (p.highestFret >= 9) shape += 1; // high up the neck

  // Technique axis (kept OFF the shape score). Muting a string between two ringing strings
  // is a right-hand/damping technique, not a harder left-hand shape.
  let technique = 0;
  if (p.hasInteriorMute) technique += 1.5;

  const label = shape <= 1.5 ? 'Fácil' : shape <= 3.5 ? 'Média' : 'Difícil';
  return { label, score: shape, shapeScore: shape, techniqueScore: technique };
}

// Public helper: classify how hard a fret shape is to play (shape difficulty only).
export function getVoicingDifficulty(
  frets: number[]
): { label: 'Fácil' | 'Média' | 'Difícil'; score: number; shapeScore: number; techniqueScore: number } {
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

  // Item 4 — pitch classes that are ALLOWED in the bass (lowest sounding string).
  // A tension (6ª, 7ª, 9ª, 11ª, 13ª) in the bass turns the chord into an UNINTENDED
  // inversion (e.g. C7 with Bb in the bass sounds like a Bb chord), which is a correctness
  // bug, not a preference. The only notes that may legitimately sit in the bass are the
  // triad tones — root, 3rd and 5th (interval < 9 semitones from the root, which also
  // covers sus 2/4). Everything from the 6th up (interval >= 9) is a tension and is
  // rejected below unless the user explicitly asked for that bass via a slash chord.
  // This applies to EVERY instrument: on the viola cebolão the idiomatic open bass is the
  // 5th (still allowed here), but a 7th in the bass is wrong there too.
  const allowedBassPcs = new Set<PitchClass>(
    chord.formula.intervals.filter(iv => iv < 9).map(iv => (chord.root + iv) % 12)
  );

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
        bassIsRoot = bassPc === chord.root; // slash on the root itself is still fundamental position
      } else {
        // Item 4 (hard filter): with no explicit slash, the lowest sounding string must be
        // a triad tone. A tension in the bass is an unintended inversion → discard. This
        // runs for standard instruments AND the viola (a 7th in the bass is wrong on both;
        // the viola's idiomatic open-5th bass is a triad tone, so it survives).
        if (!allowedBassPcs.has(bassPc)) {
          return;
        }
        bassIsRoot = bassPc === chord.root;
        if (bassIsRoot) {
          // Item 2: root in the bass = fundamental position, strongly preferred. Softer on
          // the viola, where the open (5th) bass is idiomatic and shouldn't be steamrolled.
          score += preferOpenBass ? 20 : 45;
        } else if (!preferOpenBass) {
          score -= 30; // Inversion (bass is 3rd or 5th). Valid but less standard.
        }
        // Viola (preferOpenBass): non-root triad tone in the bass keeps score neutral — the
        // open bass is idiomatic — but bassIsRoot above still lets fundamental voicings win
        // the tiebreak when one of equivalent difficulty exists.
      }
    } else {
      if (chord.bass !== undefined) {
        return; // No strings played, but bass was requested
      }
    }

    // Item 2 — reward the fundamental appearing on one of the TWO lowest strings, even when
    // the very lowest is an (idiomatic) 5th. Small weight: a desempate, not a dominating
    // term. Skipped for explicit slash chords, where the requested bass rules.
    if (chord.bass === undefined) {
      for (let i = 0; i < Math.min(2, numStrings); i++) {
        if (frets[i] >= 0 && stringFretNotes[i][frets[i]].pitchClass === chord.root) {
          score += 8;
          break;
        }
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

// Item 5 — reducible pool. When an extended chord has more theoretical notes than the
// instrument has positions (strings), these are the notes allowed to fall: the PERFECT 5th
// and the NATURAL upper extensions (9=14, 11=17, 13=21). Everything else stays protected —
// root, 3rd (or sus tone), the 6th, the diminished 7th, ALTERED 5ths (b5/#5) and ALTERED
// tensions (b9/#9/#11/b13) — because those define the chord's identity. This mirrors the
// existing requiredIntervals philosophy (chordCalculator.ts:162), which already treats the
// perfect 5th as "a mais descartável" and natural intermediate tensions as omissible.
const REDUCIBLE_INTERVALS = new Set<number>([7, 14, 17, 21]); // perfect 5th, 9th, 11th, 13th
// Base drop priority, used ONLY to break a proximity tie (most-disposable FIRST): the
// perfect 5th is least missed, then the lower natural extensions, protecting the highest
// one (the note that names the chord). Same order the relax fallback (line ~857) implies.
const BASE_DROP_ORDER = [7, 14, 17, 21];

/**
 * Item 5 — next-chord-guided note reduction. A step BEFORE voicing search: it decides which
 * PITCH CLASSES of an extended chord are eligible to be voiced, when the chord has more
 * theoretical notes than the instrument has positions (`capacity` = number of strings).
 *
 * Protected (never dropped here): root, 3rd/sus, the definer 7th and every altered tone —
 * i.e. all intervals NOT in REDUCIBLE_INTERVALS. Disposable pool: perfect 5th + natural
 * 9/11/13. When notes must be cut, the pool is ordered worst-to-drop by:
 *   1. proximity — a note whose pitch class is ABSENT from the next chord drops before one
 *      that is PRESENT (keep the shared colour tones, smoothing the harmonic transition);
 *   2. tie-break — the existing base priority (5th, then 9, 11, protecting the highest).
 * With no next chord (last of the progression) proximity is skipped: pure base priority.
 *
 * Returns a NEW Chord with `notes`/`formula.intervals`/`formula.requiredIntervals` trimmed;
 * returns the chord untouched when it already fits. This is complementary to — not a
 * duplicate of — item 3: item 5 chooses the harmonic CONTENT, item 3 later chooses the
 * physical STRING placement of that content, both looking at the same next chord.
 *
 * DIVERGENCE FROM EXISTING POLICY (reported, per the brief): the current requiredIntervals
 * protects the HIGHEST natural extension as the chord's "name". Item 5 deliberately makes
 * every natural extension (9/11/13) disposable subject to proximity — the brief's own
 * acceptance example, D#7(9,11), needs both the 9th and 11th to be proximity-eligible. The
 * altered-tone protection above keeps this aligned with the documented reduction philosophy.
 */
export function reduceExtendedChord(chord: Chord, nextChord: Chord | null, capacity: number): Chord {
  const intervals = chord.formula.intervals;
  const distinctPcs = new Set<PitchClass>(intervals.map(iv => (chord.root + iv) % 12));
  if (chord.bass !== undefined) distinctPcs.add(chord.bass); // an explicit bass occupies a position too
  if (distinctPcs.size <= capacity) return chord; // already fits — nothing to reduce

  const disposable = intervals.filter(iv => REDUCIBLE_INTERVALS.has(iv));
  const nextPcs = nextChord ? new Set<PitchClass>(nextChord.notes) : null;
  const sharedWithNext = (iv: number) => (nextPcs ? nextPcs.has(((chord.root + iv) % 12)) : false);
  const baseRank = (iv: number) => { const i = BASE_DROP_ORDER.indexOf(iv); return i === -1 ? 99 : i; };

  // Sort disposable notes worst-to-drop: not-shared before shared, then base priority.
  const dropOrder = [...disposable].sort((a, b) => {
    const sa = sharedWithNext(a) ? 1 : 0;
    const sb = sharedWithNext(b) ? 1 : 0;
    if (sa !== sb) return sa - sb; // 0 (absent from next) drops first
    return baseRank(a) - baseRank(b); // tie → most disposable by base order
  });

  let needToDrop = distinctPcs.size - capacity;
  const dropped = new Set<number>();
  for (const iv of dropOrder) {
    if (needToDrop <= 0) break;
    dropped.add(iv);
    needToDrop--;
  }

  const keptIntervals = intervals.filter(iv => !dropped.has(iv));
  const keptNotes = Array.from(new Set<PitchClass>(keptIntervals.map(iv => (chord.root + iv) % 12)));
  if (chord.bass !== undefined && !keptNotes.includes(chord.bass)) keptNotes.push(chord.bass);
  const origRequired = chord.formula.requiredIntervals ?? intervals;
  const keptRequired = origRequired.filter(iv => !dropped.has(iv));

  return {
    ...chord,
    notes: keptNotes,
    formula: { ...chord.formula, intervals: keptIntervals, requiredIntervals: keptRequired },
  };
}

/**
 * Item 3 — Voice leading (greedy). Given the chords of a progression IN ORDER, choose one
 * voicing to display per chord so that consecutive chords share as many notes as possible
 * (ideally the SAME note on the SAME string), minimizing hand jumps between chords.
 *
 * Strategy: GREEDY, processed RIGHT-TO-LEFT. The last chord takes its own best-ranked
 * voicing (calculateVoicings already returns candidates best-first). Each earlier chord
 * then picks — among candidates of EQUIVALENT difficulty to its own best — the one that
 * shares the most notes with the ALREADY-CHOSEN voicing of the NEXT chord. This keeps the
 * heuristic from trading a much easier shape for a slightly smoother connection.
 *
 * FUTURE WORK (intentionally NOT done here, as requested): this is a purely local greedy —
 * the best choice for the pair (i, i+1) can push the pair (i-1, i) toward a worse
 * connection (a "bad chain"). If that shows up in real progressions, the natural evolution
 * is dynamic programming (Viterbi) minimizing the ACCUMULATED voice-leading cost over the
 * whole sequence. Greedy solves the majority of cases and is what this task asked for.
 */
export function chooseVoicingsForProgression(
  tuning: Tuning,
  chords: Chord[],
  maxFret = 12,
  opts: { violaCebolao?: boolean } = {}
): (Voicing | null)[] {
  // Item 5 runs FIRST (forward pass): reduce each extended chord's harmonic content toward
  // its NEXT chord before any voicing is generated. Chords that already fit pass through
  // untouched, so plain triads are unaffected. Item 3's greedy then operates on the reduced
  // candidate sets — content selection first, physical placement second.
  const capacity = tuning.strings.length;
  const reducedChords = chords.map((c, i) =>
    reduceExtendedChord(c, i + 1 < chords.length ? chords[i + 1] : null, capacity)
  );
  const candidatesPerChord = reducedChords.map(c => calculateVoicings(tuning, c, maxFret, opts));
  const chosen: (Voicing | null)[] = new Array(chords.length).fill(null);

  // Coarse difficulty band (same buckets used by the calculateVoicings sort), so voice
  // leading only ever swaps between voicings that feel equally hard to the hand.
  const bandOf = (v: Voicing): number => {
    const d = v.difficultyScore ?? 0;
    return d <= 1.5 ? 0 : d <= 3.5 ? 1 : 2;
  };

  const pcAt = (v: Voicing, s: number): number | null =>
    v.frets[s] >= 0 ? (tuning.strings[s] + v.frets[s]) % 12 : null;

  // Connection strength between two voicings: the SAME note on the SAME string (identical
  // fret) is the ideal and weighs 10; a shared pitch class on any other string is a weaker
  // bonus weighing 1. Higher = smoother voice leading.
  const connection = (a: Voicing, b: Voicing): number => {
    let strength = 0;
    const setA = new Set<number>();
    for (let s = 0; s < tuning.strings.length; s++) {
      if (a.frets[s] >= 0 && b.frets[s] >= 0 && a.frets[s] === b.frets[s]) strength += 10;
      const pa = pcAt(a, s);
      if (pa !== null) setA.add(pa);
    }
    for (let s = 0; s < tuning.strings.length; s++) {
      const pb = pcAt(b, s);
      if (pb !== null && setA.has(pb)) strength += 1;
    }
    return strength;
  };

  for (let i = chords.length - 1; i >= 0; i--) {
    const cands = candidatesPerChord[i];
    if (cands.length === 0) { chosen[i] = null; continue; }

    const next = i + 1 < chords.length ? chosen[i + 1] : null;
    if (!next) { chosen[i] = cands[0]; continue; } // last chord (or next had no voicing): own best

    // Only consider candidates as easy as the best one — voice leading is a tiebreak among
    // equivalent-difficulty shapes, never a reason to jump to a harder voicing.
    const bestBand = bandOf(cands[0]);
    const equiv = cands.filter(v => bandOf(v) === bestBand);

    let best = equiv[0];
    let bestConn = connection(best, next);
    for (let k = 1; k < equiv.length; k++) {
      const conn = connection(equiv[k], next);
      if (conn > bestConn) { best = equiv[k]; bestConn = conn; } // ties keep the original (best-scored) order
    }
    chosen[i] = best;
  }

  return chosen;
}

