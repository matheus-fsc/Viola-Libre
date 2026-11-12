/**
 * Integridade das tabelas do motor: instrumentos, fórmulas de acorde e de escala, e os
 * grupos de sinônimos da notação.
 *
 * São dados escritos à mão e consumidos por todo o resto (voicings, detecção de acorde e de
 * tom, rótulos). Um erro de digitação aqui não quebra a compilação, só faz um acorde soar
 * errado, e ninguém nota até alguém tocar.
 */
import { describe, expect, it } from 'vitest';
import { CHORD_FORMULAS, PRESET_INSTRUMENTS, SCALE_FORMULAS, NOTE_NAMES_SHARP, NOTE_NAMES_FLAT, PITCH_CLASS_TO_DISPLAY } from './tunings';
import { notationRank, NOTATION_STANDARDS, DEFAULT_NOTATION, GRUPOS } from './notation';
import { formatIntervalsAsDegrees } from './intervals';

describe('instrumentos', () => {
  it('ids únicos, de instrumento e de afinação', () => {
    const inst = PRESET_INSTRUMENTS.map(i => i.id);
    expect(new Set(inst).size).toBe(inst.length);
    // O id da afinação entra no chord_id da curadoria ({instrumento}-{afinação}-{acorde}).
    const afin = PRESET_INSTRUMENTS.flatMap(i => i.tunings.map(t => t.id));
    expect(new Set(afin).size).toBe(afin.length);
  });

  it.each(PRESET_INSTRUMENTS.map(i => [i.id, i] as const))('%s: a afinação padrão existe', (_id, inst) => {
    expect(inst.tunings.map(t => t.id)).toContain(inst.defaultTuningId);
  });

  // MIDI 21..108 é a extensão do piano; corda fora disso é nota digitada errada.
  it.each(PRESET_INSTRUMENTS.flatMap(i => i.tunings.map(t => [`${i.id}/${t.id}`, t.strings] as const)))(
    '%s: cordas em MIDI plausível',
    (_id, strings) => {
      expect(strings.length).toBeGreaterThanOrEqual(4);
      for (const s of strings) {
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(21);
        expect(s).toBeLessThanOrEqual(108);
      }
    },
  );
});

describe('fórmulas de acorde', () => {
  it('sufixos únicos', () => {
    const sufixos = CHORD_FORMULAS.map(f => f.suffix);
    const repetidos = sufixos.filter((s, i) => sufixos.indexOf(s) !== i);
    expect(repetidos).toEqual([]);
  });

  it.each(CHORD_FORMULAS.map(f => [f.suffix || '(maior)', f] as const))('%s: bem formada', (_s, f) => {
    expect(f.intervals[0]).toBe(0);
    // Crescente e sem repetição: o voicing percorre os intervalos em ordem.
    for (let i = 1; i < f.intervals.length; i++) expect(f.intervals[i]).toBeGreaterThan(f.intervals[i - 1]);
    // Uma nota obrigatória que não está na fórmula nunca seria satisfeita.
    // Opcional no tipo; hoje toda fórmula declara, e quem declara tem que incluir a tônica.
    if (f.requiredIntervals) {
      for (const r of f.requiredIntervals) expect(f.intervals).toContain(r);
      expect(f.requiredIntervals).toContain(0);
    }
  });
});

describe('fórmulas de escala', () => {
  it.each(SCALE_FORMULAS.map(f => [f.name, f] as const))('%s: um grau por intervalo, dentro da oitava', (_n, f) => {
    expect(f.degrees).toHaveLength(f.intervals.length);
    expect(f.intervals[0]).toBe(0);
    for (let i = 1; i < f.intervals.length; i++) expect(f.intervals[i]).toBeGreaterThan(f.intervals[i - 1]);
    expect(f.intervals.at(-1)!).toBeLessThan(12);
  });
});

describe('nomes de nota', () => {
  it('as três tabelas concordam', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(PITCH_CLASS_TO_DISPLAY[pc]).toEqual({ sharp: NOTE_NAMES_SHARP[pc], flat: NOTE_NAMES_FLAT[pc] });
    }
  });
});

describe('notação', () => {
  const porSufixo = new Map(CHORD_FORMULAS.map(f => [f.suffix, f]));

  it('o padrão existe na lista oferecida', () => {
    expect(NOTATION_STANDARDS.map(n => n.id)).toContain(DEFAULT_NOTATION);
  });

  it('grafias preferidas no Brasil e fora', () => {
    expect(notationRank('7M', 'pt-BR')).toBe(0);
    expect(notationRank('Maj7', 'pt-BR')).toBe(1);
    expect(notationRank('Maj7', 'intl')).toBe(0);
    expect(notationRank('9', 'pt-BR')).toBe(0);
    expect(notationRank('add9', 'intl')).toBe(0);
  });

  it('sufixo sem sinônimo nunca perde o desempate', () => {
    expect(notationRank('m', 'pt-BR')).toBe(0);
    expect(notationRank('sufixo-que-nao-existe', 'intl')).toBe(0);
  });

  // A tabela de sinônimos só decide o RÓTULO. Se dois "sinônimos" tiverem notas diferentes,
  // trocar o padrão de notação passaria a mudar o som do acorde, que é justamente o que o
  // cabeçalho de notation.ts promete que nunca acontece.
  it.each(GRUPOS.map(g => [g.ptBR.join(' | '), g] as const))(
    '%s: todo sinônimo é fórmula, com as mesmas notas',
    (_nome, g) => {
      // Os dois padrões ordenam o mesmo grupo; um sufixo só de um lado seria rótulo órfão.
      expect([...g.intl].sort()).toEqual([...g.ptBR].sort());
      const notas = (s: string) => {
        const f = porSufixo.get(s);
        expect(f, `sufixo sem fórmula: ${s}`).toBeDefined();
        return [...f!.intervals].sort((a, b) => a - b);
      };
      const referencia = notas(g.ptBR[0]);
      for (const s of g.ptBR.slice(1)) expect(notas(s), s).toEqual(referencia);
    },
  );
});

describe('graus de intervalo', () => {
  it.each([
    [[0, 4, 7], ['1', '3', '5']],
    [[0, 3, 7], ['1', 'b3', '5']],
    [[0, 4, 7, 10, 14], ['1', '3', '5', 'b7', '9']],
    [[0, 3, 6, 9], ['1', 'b3', 'b5', '6']],
    [[0, 4, 7, 11, 18], ['1', '3', '5', '7', '#11']],
  ])('%j → %j', (intervalos, graus) => {
    expect(formatIntervalsAsDegrees(intervalos)).toEqual(graus);
  });

  it('acima de duas oitavas, cai no grau composto equivalente', () => {
    expect(formatIntervalsAsDegrees([26, 29, 33])).toEqual(['9', '11', '13']);
  });

  // Mostrar o número é melhor que esconder uma nota que não tem nome na tabela.
  it('o que não tem nome aparece como número de semitons', () => {
    expect(formatIntervalsAsDegrees([12, 16, 19])).toEqual(['12', '16', '19']);
  });

  it('entrada que não é lista devolve vazio', () => {
    expect(formatIntervalsAsDegrees(null as unknown as number[])).toEqual([]);
  });
});
