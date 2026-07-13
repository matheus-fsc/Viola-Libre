import { describe, it, expect } from 'vitest';
import {
  buildChord,
  calculateVoicings,
  getVoicingDifficulty,
  chooseVoicingsForProgression,
  reduceExtendedChord,
} from './chordCalculator';
import { PRESET_INSTRUMENTS } from './tunings';
import type { Tuning, Voicing } from './types';

// ---------------------------------------------------------------------------
// Fixtures. String convention (confirmed in the survey): strings[0] is the
// LOWEST (most grave) string, ascending to the highest.
// ---------------------------------------------------------------------------
const viola = PRESET_INSTRUMENTS.find(i => i.id === 'viola')!
  .tunings.find(t => t.id === 'cebolao-re')! as Tuning; // A2 D3 F#3 A3 D4 = [45,50,54,57,62]
const violao = PRESET_INSTRUMENTS.find(i => i.id === 'violao')!
  .tunings.find(t => t.id === 'violao-padrao')! as Tuning; // E A D G B E = [40,45,50,55,59,64]

// Pitch class of the lowest SOUNDING (non-muted) string of a voicing.
const bassPc = (v: Voicing, tuning: Tuning): number => {
  for (let s = 0; s < v.frets.length; s++) {
    if (v.frets[s] >= 0) return (tuning.strings[s] + v.frets[s]) % 12;
  }
  return -1;
};

// The triad-tone pitch classes (root/3rd/5th) that MAY sit in the bass. Anything else is
// a tension (6th, 7th, upper extension) and must never be the bass note (item 4).
const allowedBassPcs = (rootName: string, suffix: string): Set<number> => {
  const c = buildChord(rootName, suffix);
  return new Set(c.formula.intervals.filter(iv => iv < 9).map(iv => (c.root + iv) % 12));
};

// ---------------------------------------------------------------------------
// Item 1 — interior mute must not inflate the SHAPE difficulty.
// ---------------------------------------------------------------------------
describe('item 1: interior mute is technique, not shape difficulty', () => {
  // Same fretted positions on the sounding strings; the only difference is string index 2,
  // which is open (played) in shapeOpen and muted (interior mute) in shapeMuted.
  const shapeOpen = [0, 2, 0, 2, 0];
  const shapeMuted = [0, 2, -1, 2, 0]; // interior mute between played strings 1 and 3

  it('shape difficulty is identical whether the interior string rings or is muted', () => {
    const open = getVoicingDifficulty(shapeOpen);
    const muted = getVoicingDifficulty(shapeMuted);
    expect(muted.shapeScore).toBe(open.shapeScore);
    // Acceptance: the muted shape is NOT scored harder than the un-muted shape.
    expect(muted.score).toBeLessThanOrEqual(open.score);
  });

  it('the muting cost lands on the technique axis instead', () => {
    const open = getVoicingDifficulty(shapeOpen);
    const muted = getVoicingDifficulty(shapeMuted);
    expect(open.techniqueScore).toBe(0);
    expect(muted.techniqueScore).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Item 2 — the fundamental is preferred in the bass (lowest string).
// ---------------------------------------------------------------------------
describe('item 2: root preferred in the bass', () => {
  it('default C major voicing on the violão has the root in the bass', () => {
    const chord = buildChord('C', '');
    const voicings = calculateVoicings(violao, chord, 12);
    expect(voicings.length).toBeGreaterThan(0);
    expect(bassPc(voicings[0], violao)).toBe(chord.root); // C = 0
    expect(voicings[0].bassIsRoot).toBe(true);
  });

  it('default G major voicing on the violão has the root in the bass', () => {
    const chord = buildChord('G', '');
    const voicings = calculateVoicings(violao, chord, 12);
    expect(voicings.length).toBeGreaterThan(0);
    expect(bassPc(voicings[0], violao)).toBe(chord.root); // G = 7
  });
});

// ---------------------------------------------------------------------------
// Item 4 — a tension (6th/7th) must never fall in the bass (unintended inversion).
// Chord list drawn from common 6th/7th chords that reproduced the bug.
// ---------------------------------------------------------------------------
describe('item 4: no tension in the bass for 6th/7th chords', () => {
  const cases: Array<[string, string]> = [
    ['C', '7'], ['G', '7'], ['D', '7'], ['A', '7'], ['E', '7'],
    ['C', 'Maj7'], ['F', 'Maj7'], ['G', '6'], ['C', '6'], ['D', '6'],
    ['A', 'm7'], ['D', 'm7'], ['E', 'm7'], ['B', 'm7(b5)'], ['G', '7(9)'],
  ];

  for (const tuning of [viola, violao] as Tuning[]) {
    for (const [root, suffix] of cases) {
      it(`${root}${suffix} on ${tuning.name}: every voicing has a triad tone in the bass`, () => {
        const chord = buildChord(root, suffix);
        const voicings = calculateVoicings(tuning, chord, 12, {
          violaCebolao: tuning.id.startsWith('cebolao'),
        });
        const allowed = allowedBassPcs(root, suffix);
        for (const v of voicings) {
          expect(allowed.has(bassPc(v, tuning))).toBe(true);
        }
      });
    }
  }

  it('an explicit slash chord (C7/Bb) still allows the requested tension in the bass', () => {
    const chord = buildChord('C', '7', 'Bb');
    const voicings = calculateVoicings(violao, chord, 12);
    expect(voicings.length).toBeGreaterThan(0);
    const bbPc = 10; // Bb
    // Every generated voicing must honor the requested bass...
    for (const v of voicings) expect(bassPc(v, violao)).toBe(bbPc);
  });
});

// ---------------------------------------------------------------------------
// Item 3 — greedy voice leading maximizes common notes with the next chord.
// ---------------------------------------------------------------------------
describe('item 3: greedy voice leading', () => {
  // Same connection metric the engine uses: same note / same string weighs most.
  const connection = (a: Voicing, b: Voicing, tuning: Tuning): number => {
    let strength = 0;
    const setA = new Set<number>();
    for (let s = 0; s < tuning.strings.length; s++) {
      if (a.frets[s] >= 0 && b.frets[s] >= 0 && a.frets[s] === b.frets[s]) strength += 10;
      if (a.frets[s] >= 0) setA.add((tuning.strings[s] + a.frets[s]) % 12);
    }
    for (let s = 0; s < tuning.strings.length; s++) {
      if (b.frets[s] >= 0 && setA.has((tuning.strings[s] + b.frets[s]) % 12)) strength += 1;
    }
    return strength;
  };

  const progression = ['G', 'C', 'D'].map(n => buildChord(n, ''));

  it('every chord in the progression gets a voicing', () => {
    const chosen = chooseVoicingsForProgression(viola, progression, 12, { violaCebolao: true });
    expect(chosen).toHaveLength(3);
    for (const v of chosen) expect(v).not.toBeNull();
  });

  it('the middle chord connects to the next at least as well as its isolated best', () => {
    const chosen = chooseVoicingsForProgression(viola, progression, 12, { violaCebolao: true });
    const midCands = calculateVoicings(viola, progression[1], 12, { violaCebolao: true });
    const next = chosen[2]!;
    const chosenConn = connection(chosen[1]!, next, viola);
    const isolatedBestConn = connection(midCands[0], next, viola);
    // Acceptance: choosing with voice leading is never worse than the "easiest in isolation".
    expect(chosenConn).toBeGreaterThanOrEqual(isolatedBestConn);
  });

  it('the last chord keeps its own best-ranked voicing (nothing after it to connect to)', () => {
    const chosen = chooseVoicingsForProgression(viola, progression, 12, { violaCebolao: true });
    const lastCands = calculateVoicings(viola, progression[2], 12, { violaCebolao: true });
    expect(chosen[2]!.frets).toEqual(lastCands[0].frets);
  });
});

// ---------------------------------------------------------------------------
// Item 5 — next-chord-guided note reduction of extended chords.
// Fixture: D#7(9,11) has 6 theoretical notes; the viola has 5 courses (capacity 5), so
// exactly one note from the disposable pool {5th, 9th, 11th} must be cut.
//   root D# = 3 | intervals [0,4,7,10,14,17]
//   protected pcs: 3 (root), 7 (3rd/G), 1 (b7/C#)
//   disposable pcs: 10 (5th/A#), 5 (9th/F), 8 (11th/G#)
// ---------------------------------------------------------------------------
describe('item 5: reduction protects root/3rd/7th and cuts by proximity', () => {
  const capacity = viola.strings.length; // 5
  const ROOT = 3, THIRD = 7, SEVENTH = 1;      // protected pitch classes
  const FIFTH = 10, NINTH = 5, ELEVENTH = 8;   // disposable pitch classes

  it('protected core (root, 3rd, definer 7th) always survives the cut', () => {
    const chord = buildChord('D#', '7(9/11)');
    const next = buildChord('A#', 'm7(b5)');
    const reduced = reduceExtendedChord(chord, next, capacity);
    for (const pc of [ROOT, THIRD, SEVENTH]) expect(reduced.notes).toContain(pc);
  });

  it('with a next chord, keeps the pool notes shared with it and drops the non-shared one', () => {
    const chord = buildChord('D#', '7(9/11)');
    // A#m7(b5) = {A#(10), C#(1), E(4), G#(8)} — shares the 5th (A#) and 11th (G#), NOT the 9th (F).
    const next = buildChord('A#', 'm7(b5)');
    const reduced = reduceExtendedChord(chord, next, capacity);

    expect(reduced.notes).toHaveLength(capacity);
    expect(reduced.notes).toContain(FIFTH);      // shared → kept
    expect(reduced.notes).toContain(ELEVENTH);   // shared → kept
    expect(reduced.notes).not.toContain(NINTH);  // absent from next → dropped, even though
                                                 // by BASE priority the 5th would go first
  });

  it('without a next chord (last of the progression), cuts by base priority (5th first)', () => {
    const chord = buildChord('D#', '7(9/11)');
    const reduced = reduceExtendedChord(chord, null, capacity);

    expect(reduced.notes).toHaveLength(capacity);
    expect(reduced.notes).not.toContain(FIFTH);  // perfect 5th is the most disposable
    expect(reduced.notes).toContain(NINTH);      // extensions protected over the 5th
    expect(reduced.notes).toContain(ELEVENTH);
    for (const pc of [ROOT, THIRD, SEVENTH]) expect(reduced.notes).toContain(pc);
  });

  it('a chord that already fits the instrument is returned unchanged', () => {
    const triad = buildChord('C', ''); // 3 notes ≤ 5 courses
    expect(reduceExtendedChord(triad, buildChord('G', ''), capacity)).toBe(triad);
  });

  it('reduction flows through the progression: the dropped 9th never gets voiced', () => {
    const chords = ['D#7(9/11)', 'A#m7(b5)', 'G#'].map(s => {
      // parse the display string into root/suffix as the app does
      const m = /^([A-G][#b]?)(.*)$/.exec(s)!;
      return buildChord(m[1], m[2]);
    });
    const chosen = chooseVoicingsForProgression(viola, chords, 12, { violaCebolao: true });
    expect(chosen[0]).not.toBeNull();
    // The 9th (F, pc 5) was cut, so no string of the first chord's voicing may sound it.
    const voicedPcs = chosen[0]!.frets
      .map((f, s) => (f >= 0 ? (viola.strings[s] + f) % 12 : -1))
      .filter(pc => pc >= 0);
    expect(voicedPcs).not.toContain(NINTH);
  });
});
