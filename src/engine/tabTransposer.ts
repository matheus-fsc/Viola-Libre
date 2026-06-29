import { NOTE_NAMES_SHARP } from './tunings';
import { PRESET_INSTRUMENTS } from './tunings';

export interface ContentSegment {
  type: 'html' | 'tab';
  content: string;
}

export interface TabEvent {
  pos: number;       // char position in row content
  fret: number;      // 0 = open, >=1 = fretted
  width: number;     // chars occupied (1 for 0-9, 2 for 10-24)
  techAfter?: string; // technique after this note (h, p, /, \, ~, b)
}

export interface ParsedTabRow {
  label: string;      // string label as shown in tab (e, B, G, D, A, E, F#, etc.)
  midiOpen: number;   // MIDI value of this open string
  events: TabEvent[];
  contentRaw: string; // raw content after the '|'
}

export interface ParsedTab {
  rows: ParsedTabRow[];    // ordered HIGH to LOW (top row = thinnest string)
  sourceName: string;
  totalWidth: number;      // content chars per row
}

// Known open string MIDI values by label (allows multiple octave guesses)
// We pick the octave that makes musical sense based on context
const LABEL_TO_MIDI_CANDIDATES: Record<string, number[]> = {
  'E': [64, 52, 40, 28],  // E4 (guitar high), E3, E2 (guitar low), E1 (bass)
  'e': [64, 52],
  'B': [59, 47, 35],
  'b': [59, 47],
  'G': [55, 43, 31],
  'g': [55, 67],          // g can be G4 (ukulele) or G3
  'D': [62, 50, 38, 26],
  'd': [62, 50],
  'A': [69, 57, 45, 33],
  'a': [69, 57, 45],
  'F#': [66, 54, 42],
  'f#': [66, 54],
  'Gb': [66, 54, 42],
  'C': [60, 48, 36],
  'c': [60, 48],
  'F': [65, 53, 41],
  'f': [65, 53],
  'Bb': [58, 46, 34],
  'Ab': [56, 44],
  'Eb': [63, 51],
  'H': [59, 47],  // German notation for B
};

// Known instrument tuning patterns (strings ordered HIGH to LOW as shown in tab)
interface KnownTuning {
  labels: string[];
  midi: number[];
  name: string;
  instrumentId: string;
}

const KNOWN_TAB_TUNINGS: KnownTuning[] = [
  // Guitar standard
  { labels: ['e','B','G','D','A','E'], midi: [64,59,55,50,45,40], name: 'Violão Padrão (EADGBE)', instrumentId: 'violao' },
  { labels: ['E','B','G','D','A','E'], midi: [64,59,55,50,45,40], name: 'Violão Padrão (EADGBE)', instrumentId: 'violao' },
  // Guitar Drop D
  { labels: ['e','B','G','D','A','D'], midi: [64,59,55,50,45,38], name: 'Drop D', instrumentId: 'violao' },
  // Guitar DADGAD
  { labels: ['D','A','G','D','A','D'], midi: [62,57,55,50,45,38], name: 'DADGAD', instrumentId: 'violao' },
  // Bass 4-string
  { labels: ['G','D','A','E'], midi: [43,38,33,28], name: 'Baixo Padrão (EADG)', instrumentId: 'contrabaixo' },
  { labels: ['g','d','a','E'], midi: [43,38,33,28], name: 'Baixo Padrão (EADG)', instrumentId: 'contrabaixo' },
  // Ukulele (reentrant)
  { labels: ['A','E','C','G'], midi: [69,64,60,55], name: 'Ukulele Padrão (gCEA)', instrumentId: 'ukulele' },
  { labels: ['a','e','C','g'], midi: [69,64,60,67], name: 'Ukulele Reentrante', instrumentId: 'ukulele' },
  // Viola Caipira Cebolão em Ré (high to low: D4 A3 F#3 D3 A2)
  { labels: ['D','A','F#','D','A'], midi: [62,57,54,50,45], name: 'Viola Cebolão em Ré', instrumentId: 'viola' },
  { labels: ['D','A','F#','A','D'], midi: [62,57,54,50,45], name: 'Viola Cebolão em Ré', instrumentId: 'viola' },
  // Viola Cebolão em Mi
  { labels: ['E','B','G#','E','B'], midi: [64,59,56,52,47], name: 'Viola Cebolão em Mi', instrumentId: 'viola' },
  // Bandolim
  { labels: ['E','A','D','G'], midi: [76,69,62,55], name: 'Bandolim Padrão', instrumentId: 'bandolim' },
  // Cavaquinho
  { labels: ['D','B','G','D'], midi: [62,59,55,50], name: 'Cavaquinho Padrão', instrumentId: 'cavaquinho' },
];

// Detect best matching known tuning from string labels
export function detectSourceTuning(labels: string[]): KnownTuning | null {
  // Try exact match first
  for (const kt of KNOWN_TAB_TUNINGS) {
    if (kt.labels.length === labels.length) {
      const match = kt.labels.every((l, i) => l.toLowerCase() === labels[i].toLowerCase());
      if (match) return kt;
    }
  }
  // Try partial match (last N labels matching)
  for (const kt of KNOWN_TAB_TUNINGS) {
    if (kt.labels.length === labels.length) {
      const noteNames = labels.map(l => l.replace(/[0-9]/g, '').toLowerCase());
      const ktNames = kt.labels.map(l => l.toLowerCase());
      const noteClasses = noteNames.map(n => pitchClassOfLabel(n));
      const ktClasses = ktNames.map(n => pitchClassOfLabel(n));
      if (noteClasses.every((pc, i) => pc !== -1 && pc === ktClasses[i])) {
        return kt;
      }
    }
  }
  // Fallback: try to match from PRESET_INSTRUMENTS
  return matchFromPresets(labels);
}

function pitchClassOfLabel(label: string): number {
  const map: Record<string, number> = {
    'c':0,'c#':1,'db':1,'d':2,'d#':3,'eb':3,'e':4,'f':5,
    'f#':6,'gb':6,'g':7,'g#':8,'ab':8,'a':9,'a#':10,'bb':10,'b':11,'h':11
  };
  return map[label.toLowerCase()] ?? -1;
}

function matchFromPresets(labels: string[]): KnownTuning | null {
  for (const inst of PRESET_INSTRUMENTS) {
    for (const tuning of inst.tunings) {
      // tuning.strings is low to high; we need high to low for labels
      const reversed = [...tuning.strings].reverse();
      if (reversed.length !== labels.length) continue;
      const tuningLabels = reversed.map(midi => NOTE_NAMES_SHARP[midi % 12]);
      const labelsNorm = labels.map(l => l.replace(/[0-9]/g, ''));
      if (tuningLabels.every((tl, i) => tl.toLowerCase() === labelsNorm[i].toLowerCase())) {
        return {
          labels: tuningLabels,
          midi: reversed,
          name: `${inst.name} — ${tuning.name}`,
          instrumentId: inst.id,
        };
      }
    }
  }
  return null;
}

// Heuristic to pick MIDI octave for a string given its neighbors
function resolveMidi(label: string, neighborMidis: number[], position: 'high' | 'middle' | 'low'): number {
  const normalized = label.replace(/[0-9]/g, '');
  const candidates = LABEL_TO_MIDI_CANDIDATES[normalized] ?? LABEL_TO_MIDI_CANDIDATES[normalized.toLowerCase()] ?? [];
  if (candidates.length === 0) return -1;

  if (neighborMidis.length === 0) {
    // No neighbors - use position heuristic
    if (position === 'high') return candidates[0];
    if (position === 'low') return candidates[candidates.length - 1];
    return candidates[Math.floor(candidates.length / 2)];
  }

  const avg = neighborMidis.reduce((a, b) => a + b, 0) / neighborMidis.length;
  // Pick candidate closest to neighbor average but within reasonable range (±12 semitones)
  let best = candidates[0];
  let bestDist = Math.abs(best - avg);
  for (const c of candidates) {
    const dist = Math.abs(c - avg);
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

// Parse raw tab text (multi-line string) into ParsedTab
// Assumes rows ordered high to low (standard tab format)
// Guitar standard tuning assumed for 6-string anonymous tabs (high to low)
const GUITAR_STD_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'] as const;
const GUITAR_STD_MIDI   = [64, 59, 55, 50, 45, 40] as const;

// Bare tab line: only dashes, digits, and technique chars — no label or pipe
const BARE_TAB_RE = /^[-0-9xhpb/\\~^.]+$/;
const isBareTabLine = (l: string) =>
  BARE_TAB_RE.test(l) && l.length >= 4 && /[0-9]/.test(l) && /-/.test(l);

export function parseTabText(text: string): ParsedTab | null {
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Accept: labeled (E|---), pipe-anonymous (|---), or bare (---3---)
  const LABELED_RE = /^([A-Ga-g#b♭]{1,3})\|(.*?)$/;
  const ANON_RE    = /^\|(.*?)$/;
  const isTabLine  = (l: string) => LABELED_RE.test(l) || ANON_RE.test(l) || isBareTabLine(l);

  const tabLines = rawLines.filter(isTabLine);
  if (tabLines.length < 2) return null;

  let allAnonymous = true;
  const parsedLines = tabLines.map((l, i) => {
    const lm = LABELED_RE.exec(l);
    if (lm) {
      allAnonymous = false;
      return { label: lm[1], content: lm[2].replace(/\|$/, '') };
    }
    const am = ANON_RE.exec(l);
    if (am) return { label: String(i + 1), content: am[1].replace(/\|$/, '') };
    // Bare line — no pipe at all, content is the whole line
    return { label: String(i + 1), content: l };
  });

  const totalWidth = Math.max(...parsedLines.map(l => l.content.length));

  // 6 anonymous rows with no tuning label → assume violão standard (E A D G B e)
  if (allAnonymous && parsedLines.length === 6) {
    parsedLines.forEach((l, i) => { l.label = GUITAR_STD_LABELS[i]; });
    const rows: ParsedTabRow[] = parsedLines.map((line, idx) => ({
      label: line.label,
      midiOpen: GUITAR_STD_MIDI[idx],
      contentRaw: line.content,
      events: parseRowEvents(line.content),
    }));
    return { rows, sourceName: 'Violão Padrão (assumido)', totalWidth };
  }

  // Detect MIDI values for each row
  // First try known tuning
  const labels = parsedLines.map(l => l.label);
  const known = detectSourceTuning(labels);

  let midiValues: number[];
  let sourceName: string;
  if (known) {
    midiValues = known.midi;
    sourceName = known.name;
  } else {
    // Resolve each string's MIDI individually using neighbors
    midiValues = [];
    for (let i = 0; i < labels.length; i++) {
      const knownNeighbors = midiValues.filter(m => m > 0);
      const position = i === 0 ? 'high' : i === labels.length - 1 ? 'low' : 'middle';
      midiValues.push(resolveMidi(labels[i], knownNeighbors, position));
    }
    sourceName = 'Instrumento detectado';
  }

  // Parse events for each row
  const rows: ParsedTabRow[] = parsedLines.map((line, idx) => ({
    label: line.label,
    midiOpen: midiValues[idx] ?? -1,
    contentRaw: line.content,
    events: parseRowEvents(line.content),
  }));

  return { rows, sourceName, totalWidth };
}

function parseRowEvents(content: string): TabEvent[] {
  const events: TabEvent[] = [];
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    if (/\d/.test(ch)) {
      // Start of a fret number
      const ch2 = content[i + 1];
      let fret: number;
      let width: number;

      if (ch2 !== undefined && /\d/.test(ch2)) {
        fret = parseInt(ch + ch2, 10);
        width = 2;
      } else {
        fret = parseInt(ch, 10);
        width = 1;
      }

      // Check for technique after this fret
      const nextIdx = i + width;
      const tech = content[nextIdx];
      const techAfter = tech && /[hpb/\\~^]/.test(tech) ? tech : undefined;

      events.push({ pos: i, fret, width, techAfter });
      i += width;
      if (techAfter) i++; // consume technique char
    } else if (/[hpb/\\~^]/.test(ch)) {
      // Loose technique char (before a note), skip
      i++;
    } else {
      // Dash or other separator
      i++;
    }
  }

  return events;
}

// Find best (string, fret) position for a given MIDI pitch on target instrument
// targetMidi: open string MIDI values ordered HIGH to LOW (matching tab display order)
// handPos: current hand position (fret number center)
export function findBestPosition(
  pitch: number,
  targetMidi: number[],
  handPos: number,
  maxFret = 17
): { stringIdx: number; fret: number } | null {
  const candidates: { stringIdx: number; fret: number; dist: number }[] = [];

  for (let s = 0; s < targetMidi.length; s++) {
    const openMidi = targetMidi[s];
    if (openMidi < 0) continue;
    const fret = pitch - openMidi;
    if (fret >= 0 && fret <= maxFret) {
      const dist = fret === 0 ? 0 : Math.abs(fret - handPos);
      candidates.push({ stringIdx: s, fret, dist });
    }
  }

  if (candidates.length === 0) return null;

  // Sort: prefer open strings (fret 0), then closest to hand position, then lower fret
  candidates.sort((a, b) => {
    if (a.fret === 0 && b.fret !== 0) return -1;
    if (b.fret === 0 && a.fret !== 0) return 1;
    if (Math.abs(a.dist - b.dist) > 1) return a.dist - b.dist;
    return a.fret - b.fret;
  });

  return candidates[0];
}

// Get display label for a MIDI note class
export function midiToLabel(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  return NOTE_NAMES_SHARP[pc];
}

// Transpose a tab block text to a new tuning
// sourceTab: parsed tab
// targetMidi: target instrument strings ordered HIGH to LOW
// targetLabels: string labels for target instrument (high to low)
// extraSemitones: additional transposition (e.g., from chord transpose offset)
export function transposeTab(
  sourceTab: ParsedTab,
  targetMidi: number[],
  targetLabels: string[],
  extraSemitones = 0,
  startHandPos = 0
): string {
  // Build a timeline: each "slot" is a unique char position that has notes
  // Collect all note positions across all source rows
  const allPositions = new Set<number>();
  for (const row of sourceTab.rows) {
    for (const ev of row.events) {
      allPositions.add(ev.pos);
    }
  }
  const sortedPositions = [...allPositions].sort((a, b) => a - b);

  // For each position, get all notes across strings
  interface NoteAtPos {
    srcStringIdx: number;
    pitch: number;
    techAfter?: string;
    origWidth: number;
    origPos: number;
  }

  const timeline: Array<{
    pos: number;
    notes: NoteAtPos[];
  }> = sortedPositions.map(pos => ({
    pos,
    notes: sourceTab.rows.flatMap((row, si) =>
      row.events
        .filter(ev => ev.pos === pos)
        .map(ev => ({
          srcStringIdx: si,
          pitch: row.midiOpen >= 0 ? row.midiOpen + ev.fret + extraSemitones : -1,
          techAfter: ev.techAfter,
          origWidth: ev.width,
          origPos: ev.pos,
        }))
    ),
  }));

  // For each timeline slot, find positions on target
  interface Placement {
    targetStringIdx: number;
    fret: number;
    techAfter?: string;
    sourcePos: number;
    origWidth: number;
  }

  let handPos = startHandPos;
  const placements: Placement[] = [];

  for (const slot of timeline) {
    for (const note of slot.notes) {
      if (note.pitch < 0) continue;
      const best = findBestPosition(note.pitch, targetMidi, handPos);
      if (best) {
        placements.push({
          targetStringIdx: best.stringIdx,
          fret: best.fret,
          techAfter: note.techAfter,
          sourcePos: slot.pos,
          origWidth: note.origWidth,
        });
        if (best.fret > 0) handPos = best.fret;
      }
    }
  }

  // Build column layout: map source char position → output column index
  const outputColumns: Array<{
    sourcePos: number;
    cellsByString: Map<number, { fret: number; techAfter?: string }>;
    colWidth: number;    // digit chars for fret number (1 or 2)
    hasTechAfter: boolean; // any cell in this column has a technique suffix
  }> = [];

  const posToColIdx = new Map<number, number>();
  for (const pos of sortedPositions) {
    const idx = outputColumns.length;
    posToColIdx.set(pos, idx);
    outputColumns.push({ sourcePos: pos, cellsByString: new Map(), colWidth: 1, hasTechAfter: false });
  }

  for (const p of placements) {
    const colIdx = posToColIdx.get(p.sourcePos);
    if (colIdx === undefined) continue;
    const col = outputColumns[colIdx];
    col.cellsByString.set(p.targetStringIdx, { fret: p.fret, techAfter: p.techAfter });
    if (p.fret >= 10) col.colWidth = 2;
    if (p.techAfter) col.hasTechAfter = true;
  }

  // Compute gap (dashes) before each column based on original char positions
  const colGaps: number[] = [];
  for (let i = 0; i < sortedPositions.length; i++) {
    if (i === 0) {
      colGaps.push(Math.max(1, sortedPositions[0]));
    } else {
      // account for previous column's effective width (digits + optional tech char)
      const prevCol = outputColumns[i - 1];
      const prevEffWidth = prevCol.colWidth + (prevCol.hasTechAfter ? 1 : 0);
      const prevEnd = sortedPositions[i - 1] + prevEffWidth;
      const gap = Math.max(1, sortedPositions[i] - prevEnd);
      colGaps.push(gap);
    }
  }

  // Build output rows for each target string
  const maxLabelLen = Math.max(...targetLabels.map(l => l.length), 1);
  const outputRows = targetLabels.map((label, si) => {
    let row = label.padStart(maxLabelLen) + '|';

    for (let ci = 0; ci < outputColumns.length; ci++) {
      const col = outputColumns[ci];

      row += '-'.repeat(colGaps[ci]);

      const cell = col.cellsByString.get(si);
      if (cell !== undefined) {
        const fretStr = String(cell.fret).padStart(col.colWidth, '0');
        row += fretStr;
        if (col.hasTechAfter) row += cell.techAfter ?? '-';
      } else {
        // no note on this string in this column — fill with dashes
        row += '-'.repeat(col.colWidth + (col.hasTechAfter ? 1 : 0));
      }
    }

    row += '-|';
    return row;
  });

  return outputRows.join('\n');
}

// Main function: split HTML into html/tab segments
export function splitHtmlByTabs(html: string): ContentSegment[] {
  const segments: ContentSegment[] = [];

  // Match <span class="tablatura"> or <div class="tablatura"> elements
  // Also match <span class="cnt"> which CifraClub uses for tab-like content
  const tabElRe = /<(span|div)[^>]+class="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/gi;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tabElRe.exec(html)) !== null) {
    const classes = match[2];
    const innerHtml = match[3];

    // Only treat as tab if the class includes tablatura or cnt
    if (!/(^|\s)(tablatura|cnt)(\s|$)/.test(classes)) continue;

    // Strip HTML tags from inner content to get raw text
    const innerText = innerHtml.replace(/<[^>]+>/g, '');

    // Verify it actually looks like a tab (has at least 2 tab lines).
    // Accepts labeled (E|---), pipe-anonymous (|---), and bare (---3---).
    const lines = innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const tabLineCount = lines.filter(l =>
      /^[A-Ga-g#b]{1,3}\|/.test(l) || /^\|[-x0-9hpb/\\~^.]/.test(l) || isBareTabLine(l)
    ).length;

    if (tabLineCount < 2) continue;

    if (match.index > lastIdx) {
      segments.push({ type: 'html', content: html.slice(lastIdx, match.index) });
    }
    segments.push({ type: 'tab', content: innerText });
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < html.length) {
    segments.push({ type: 'html', content: html.slice(lastIdx) });
  }

  // Fallback: no tablatura elements found → try raw tab line detection
  if (segments.length === 1 && segments[0].type === 'html') {
    return detectRawTabBlocks(html);
  }

  return segments;
}

// Fallback: detect raw tab blocks in HTML by looking at text content
function detectRawTabBlocks(html: string): ContentSegment[] {
  // Split by <br> tags OR real newlines
  const splitRe = /(<br\s*\/?>|\n)/gi;
  const parts = html.split(splitRe);

  const segments: ContentSegment[] = [];
  let currentHtml = '';
  let tabBuffer: string[] = [];
  let tabHtmlBuffer: string[] = [];

  const flushTab = () => {
    if (tabBuffer.length >= 3) {
      if (currentHtml) { segments.push({ type: 'html', content: currentHtml }); currentHtml = ''; }
      segments.push({ type: 'tab', content: tabBuffer.join('\n') });
      tabBuffer = [];
      tabHtmlBuffer = [];
    } else {
      currentHtml += tabHtmlBuffer.join('');
      tabBuffer = [];
      tabHtmlBuffer = [];
    }
  };

  for (const part of parts) {
    if (/^<br/i.test(part) || part === '\n') {
      // It's a line break separator
      if (tabBuffer.length > 0) {
        // might be between tab lines
        tabHtmlBuffer.push(part);
      } else {
        currentHtml += part;
      }
      continue;
    }

    // Strip HTML tags and check if it's a tab line
    const stripped = part.replace(/<[^>]+>/g, '').trim();
    const isTabLn = (/^[A-Ga-g#b]{1,3}\|/.test(stripped) || /^\|[-x0-9]/.test(stripped) || isBareTabLine(stripped)) && stripped.includes('-');
    if (isTabLn) {
      tabBuffer.push(stripped);
      tabHtmlBuffer.push(part);
    } else {
      flushTab();
      currentHtml += part;
    }
  }

  flushTab();
  if (currentHtml) segments.push({ type: 'html', content: currentHtml });

  return segments.length > 0 ? segments : [{ type: 'html', content: html }];
}

// Get target string labels (high to low) for a tuning
// tuning.strings is stored LOW to HIGH, so we reverse for display
export function getTuningLabelsHighToLow(strings: number[]): string[] {
  return [...strings].reverse().map(midi => midiToLabel(midi));
}

// Get target MIDI values high to low for transposition
export function getTuningMidiHighToLow(strings: number[]): number[] {
  return [...strings].reverse();
}
