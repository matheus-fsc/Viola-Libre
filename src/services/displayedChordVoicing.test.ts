import { describe, expect, it } from 'vitest';
import { displayedChordVoicing, type ChordVoicingContext } from './displayedChordVoicing';
import { buildVoicingFromFrets } from '../engine/chordCalculator';
import { buildChordId } from './authApi';

const tuning = { id: 'standard', name: 'Teste', strings: [40, 45, 50, 55, 59, 64] };
const first = buildVoicingFromFrets([0, 2, 2, 1, 0, 0], tuning);
const second = buildVoicingFromFrets([0, 2, 0, 1, 0, 2], tuning);
function context(name = 'E7(9+)'): ChordVoicingContext {
  return { chordNames: [name], displayedVoicings: [[first, second]], instrumentId: 'guitar', tuning,
    rankings: {}, favorites: {}, orderMode: 'favoritos', variations: { [name]: 1 }, locked: {}, custom: {} };
}

describe('voicing compartilhado pela grade e pelo painel', () => {
  it.each([
    ['E7(9+)', '( E7(#9)'], ['F#m', '(Gbm)'], ['G7', '( G7'], ['C/G', '(C/G)'], ['Bb7m', 'A#m7'],
  ])('resolve %s e %s para a mesma escolha da grade', (name, alias) => {
    const state = context(name);
    expect(displayedChordVoicing(alias, state).bestVoicing).toBe(displayedChordVoicing(name, state).bestVoicing);
    expect(displayedChordVoicing(alias, state).bestVoicing).toBe(second);
  });

  it('respeita a escolha exata quando dois aliases têm preferências distintas na grade', () => {
    const state = context('F#m');
    state.chordNames = ['F#m', 'Gbm'];
    state.displayedVoicings = [[first, second], [first, second]];
    expect(displayedChordVoicing('Gbm', state).bestVoicing).toBe(first);
    expect(displayedChordVoicing('F#m', state).bestVoicing).toBe(second);
  });

  it('respeita cadeado, forma manual e mudança de afinação', () => {
    const state = context();
    state.locked['E7(9+)'] = 0;
    expect(displayedChordVoicing('(E7(9+))', state).bestVoicing).toBe(first);
    const custom = [5, 7, 5, 6, 5, 7];
    state.custom['E7(9+)'] = custom;
    expect(displayedChordVoicing('E7(#9)', state).bestVoicing?.frets).toEqual(custom);
    state.tuning = { ...tuning, strings: tuning.strings.map(midi => midi + 2) };
    expect(displayedChordVoicing('E7(#9)', state).bestVoicing?.notes).toEqual(buildVoicingFromFrets(custom, state.tuning).notes);
    state.tuning = { ...tuning, strings: [45, 50, 54, 57, 62] };
    expect(displayedChordVoicing('E7(#9)', state).bestVoicing).toBeNull();
  });

  it('reinsere formas de curadoria e favoritos usando o id e as escolhas da grade', () => {
    const state = context('G7');
    const chordId = buildChordId('guitar', tuning.id, 'G7');
    state.variations = {};
    state.favorites[chordId] = [{ fretsArray: second.frets, count: 4, songSlug: null }];
    state.rankings[chordId] = [{ fretsArray: first.frets, scoreBoost: 10, editorId: 'editor', songSlug: null, createdAt: '2026-01-01' }];
    expect(displayedChordVoicing('( G7', state).bestVoicing).toBe(second);
    state.orderMode = 'curados';
    expect(displayedChordVoicing('( G7', state).bestVoicing).toBe(first);
    state.displayedVoicings = [[]];
    expect(displayedChordVoicing('G7', state).bestVoicing?.frets).toEqual(first.frets);
  });

  it('não inventa formas nem confunde baixo, modo e tensões', () => {
    for (const name of ['C', 'C/E', 'Em', 'E7(b9)', 'desconhecido']) {
      expect(displayedChordVoicing(name, context()).bestVoicing).toBeNull();
    }
    const state = context();
    state.displayedVoicings = [[]];
    expect(displayedChordVoicing('E7(#9)', state).bestVoicing).toBeNull();
  });
});
