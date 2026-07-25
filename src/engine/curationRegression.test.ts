/**
 * Regressão contra a curadoria humana.
 *
 * As linhas de `ranked_chords` são voicings que Editores escolheram à mão para o dicionário
 * e para músicas específicas. Elas são a única referência que temos do que soa "certo" para
 * um violeiro — então servem de âncora: qualquer mexida no scoring ou na ordenação de
 * `calculateVoicings` é medida por quão perto do topo essas escolhas continuam aparecendo.
 *
 * O dump vive na raiz do repo (`curadoria_dump.json`, gerado do banco de produção). Se ele
 * não estiver presente o teste é pulado, para não quebrar clone limpo / CI sem o fixture.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PRESET_INSTRUMENTS } from './tunings';
import { buildChord, parseChordString, calculateVoicings } from './chordCalculator';
import type { Tuning } from './types';

type CuratedRow = {
  chord_id: string;
  frets_array: string;
  score_boost: number;
  song_slug: string | null;
  editor_name: string | null;
};

/**
 * Editores cujas linhas NÃO servem de referência.
 *
 * `wilson_simonal` registrou 39 curadorias em 22 minutos (2026-07-15 04:22→04:44) sem nunca
 * definir um `score_boost`. Em 31% delas há uma corda solta no meio de uma forma em casa
 * alta — `[9,11,9,9,9,0]`, `[5,7,7,5,5,0]`, `[7,0,0,7,6,7]` — contra 5-6% dos demais
 * editores. Isso é o campo que ficou no 0 default do editor, não escolha musical: o rank
 * mediano das escolhas dele é 16, contra 2 do resto do corpus. Manter essas linhas aqui
 * mediria o motor contra ruído.
 */
const IGNORED_EDITORS = new Set(['wilson_simonal']);

const DUMP = path.resolve(__dirname, '../../curadoria_dump.json');
const allRows: CuratedRow[] = fs.existsSync(DUMP) ? JSON.parse(fs.readFileSync(DUMP, 'utf8')) : [];
const rows = allRows.filter(r => !IGNORED_EDITORS.has(r.editor_name ?? ''));

// chord_id é `{instrumento}-{afinação}-{acorde}` (buildChordId em services/authApi.ts), com
// '/' trocado por '_'. Casa o prefixo mais longo primeiro para não confundir ids que
// compartilham começo (ex.: 'violao-' e 'violao-7-').
const combos: { inst: string; tuning: Tuning; prefix: string }[] = [];
for (const inst of PRESET_INSTRUMENTS) {
  for (const t of inst.tunings) combos.push({ inst: inst.id, tuning: t, prefix: `${inst.id}-${t.id}-` });
}
combos.sort((a, b) => b.prefix.length - a.prefix.length);

// Curadorias antigas (anteriores ao buildChordId) têm id sem prefixo — ex.: 'Am', 'D'.
// Nesses casos o instrumento é inferido pelo número de cordas do próprio voicing.
const LEGACY_BY_STRING_COUNT: Record<number, string> = {
  5: 'cebolao-re',
  6: 'violao-padrao',
  4: 'ukulele-padrao',
};

function resolveCuration(chordId: string, stringCount: number) {
  for (const c of combos) {
    if (chordId.startsWith(c.prefix)) {
      return { inst: c.inst, tuning: c.tuning, chordName: chordId.slice(c.prefix.length).replace(/_/g, '/') };
    }
  }
  const tuningId = LEGACY_BY_STRING_COUNT[stringCount];
  const legacy = combos.find(c => c.tuning.id === tuningId);
  return legacy
    ? { inst: legacy.inst, tuning: legacy.tuning, chordName: chordId.replace(/_/g, '/') }
    : null;
}

const sameShape = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

function rankOfCuratedShapes() {
  const ranks: number[] = [];
  let missing = 0;
  for (const row of rows) {
    const frets: number[] = JSON.parse(row.frets_array);
    const resolved = resolveCuration(row.chord_id, frets.length);
    if (!resolved) continue;
    const { inst, tuning, chordName } = resolved;
    const { root, suffix, bass } = parseChordString(chordName);
    const chord = buildChord(root, suffix, bass || undefined);
    const voicings = calculateVoicings(tuning, chord, 12, { violaCebolao: inst === 'viola' });
    const rank = voicings.findIndex(v => sameShape(v.frets, frets));
    if (rank < 0) missing++;
    else ranks.push(rank);
  }
  return { ranks, missing };
}

describe.skipIf(rows.length === 0)('curadoria humana', () => {
  it('o motor gera TODAS as formas que os curadores escolheram', () => {
    const { missing } = rankOfCuratedShapes();
    // Um voicing curado que o motor nem produz é um bug de geração (filtro ou requisito
    // obrigatório rígido demais), não de ordenação — falha bem mais grave que rank ruim.
    expect(missing).toBe(0);
  });

  it('as escolhas humanas aparecem perto do topo', () => {
    const { ranks } = rankOfCuratedShapes();
    const sorted = [...ranks].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const top5 = ranks.filter(r => r < 5).length;

    // Corpus de 101 curadorias (140 menos as ignoradas acima).
    //   antes da camada de vocabulário: mediana 20, p90 123, top-5 32/101 (32%)
    //   depois:                         mediana  2, p90  20, top-5 70/101 (69%)
    // Os limites ficam um pouco acima do medido, para travar o ganho sem quebrar a cada
    // acorde novo que os curadores adicionarem.
    expect(median).toBeLessThanOrEqual(4);
    expect(p90).toBeLessThanOrEqual(35);
    expect(top5 / ranks.length).toBeGreaterThanOrEqual(0.62);
  });
});
