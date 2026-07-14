// =============================================================================
// timingRegions.ts — Schema unificado TimingRegion
//
// PONTE TEMPORÁRIA: regionsToLegacyPayload() existe apenas enquanto o backend
// fala o payload legado (phrases/loops/instrumentalSections/sections separados).
// Quando o backend expuser TimingRegion nativamente (com id estável), remova
// regionsToLegacyPayload() e a função inversa abaixo, e envie TimingRegion[]
// diretamente no POST/PUT. O ponto exato de troca é submitTiming() em timingApi.ts.
//
// Único ponto de entrada de rede que alimenta legacyToRegions():
//   fetchTimings(slug)    → TimingContribution[]  (todas as contribuições)
//   fetchBestTiming(slug) → TimingContribution | null (melhor contribuição)
// Ambas estão em services/timingApi.ts. Não duplique chamadas de rede aqui.
// =============================================================================

import type {
  TimingContribution,
  TimingPhrase,
  TimingLoop,
  TimingInstrumental,
  TimingSection,
  MarkerType,
  SectionType,
  TimingSubmitPayload,
} from './timingApi';

// -----------------------------------------------------------------------------
// Tipo unificado
// -----------------------------------------------------------------------------

export interface TimingRegion {
  /** ID determinístico e estável — derivado do conteúdo, nunca aleatório.
   *  Veja stableId() abaixo para a estratégia de geração. */
  id: string;
  kind: 'phrase' | 'loop' | 'instrumental' | 'section';
  // Posição no texto da cifra
  startLine: number | null;
  endLine: number | null;
  // Posição no tempo da mídia (segundos)
  startTime: number | null;
  endTime: number | null;
  // Metadados
  label: string;
  repeatCount?: number;      // loop apenas — informativo (não precisa === repeats.length)
  sectionType?: SectionType; // section apenas
  // Ocorrências adicionais de um loop no áudio. A 1ª ocorrência (canônica) é
  // startTime/endTime da própria region. repeats[] guarda as demais — cada entrada
  // tem timestamps independentes porque o músico pode variar o andamento por repetição.
  // Campo local-only por ora: regionsToLegacyPayload não o envia ao backend ainda.
  // Quando o backend migrar para TimingRegion nativo, remova esse comentário.
  repeats?: { startTime: number; endTime: number }[];  // loop apenas
}

// -----------------------------------------------------------------------------
// Geração de ID determinístico
//
// Estratégia: djb2 (32-bit) sobre a string "kind:campo1:campo2:..."
//
// Por quê djb2 e não crypto.randomUUID() / nanoid()?
//   • Precisa ser reproduzível entre re-fetches do mesmo dado do backend.
//   • O backend ainda não devolve id — esse id é só local para manter
//     selectedRegionId estável enquanto o usuário edita.
//   • djb2 sobre ~100 regiões por cifra tem probabilidade de colisão
//     desprezível (~2,3e-7 para 100 itens num espaço de 2^32).
//
// Campos usados por kind:
//   phrase       → lineIndex + startTime
//   loop         → startLine + endLine + label + startTime
//   instrumental → startLine + endLine + label
//   section      → sectionType + startTime + label
//
// 'loop' inclui startTime pelo mesmo motivo que 'phrase' e 'section' já incluíam: sem ele,
// duas ocorrências do MESMO intervalo de linhas (ex: o mesmo Refrão repetido, marcado em
// timestamps diferentes via o Wizard de Loop) colidiriam no mesmo id — já que o label do
// Wizard de Loop é sempre o genérico "Loop" — e addRegion() faz upsert em colisão de id,
// então a segunda marcação silenciosamente sobrescrevia a primeira em vez de criar uma
// region distinta.
//
// Se o usuário mudar o label de um loop ou mover uma seção de tempo, o ID muda.
// Isso é intencional: o ID é "estável entre re-fetches do mesmo dado", não
// "estável entre edições do usuário".
// -----------------------------------------------------------------------------

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) & 0xffffffff;
  }
  return h >>> 0; // unsigned
}

function stableId(kind: string, ...parts: (string | number | null | undefined)[]): string {
  const raw = `${kind}:${parts.map(p => p ?? '').join(':')}`;
  return `${kind}-${djb2(raw).toString(36)}`;
}

// -----------------------------------------------------------------------------
// Tipo de patch — id explicitamente excluído
//
// updateRegion(id, patch: TimingRegionPatch) nunca pode receber { id: ... }.
// O TypeScript rejeita isso em tempo de compilação, tornando impossível
// recalcular ou trocar o id como efeito colateral de uma edição local.
// O id só muda quando o store é repopulado via um novo legacyToRegions()
// (novo fetch completo — reload de página ou troca de cifra).
// -----------------------------------------------------------------------------

/** Patch permitido para updateRegion. O campo `id` é omitido intencionalmente:
 *  o id é calculado uma vez na materialização (legacyToRegions) e depois congelado. */
export type TimingRegionPatch = Partial<Omit<TimingRegion, 'id'>>;

// -----------------------------------------------------------------------------
// Conversões
// -----------------------------------------------------------------------------

/** Converte uma TimingContribution do backend (payload legado) em TimingRegion[].
 *  Ordem: phrases → loops → instrumentals → sections. */
export function legacyToRegions(c: TimingContribution): TimingRegion[] {
  const regions: TimingRegion[] = [];

  for (const p of c.phrases) {
    regions.push({
      id: stableId('phrase', p.lineIndex, p.startTime),
      kind: 'phrase',
      startLine: p.lineIndex,
      endLine: p.lineIndex,
      startTime: p.startTime,
      endTime: p.endTime,
      label: '',
    });
  }

  for (const l of c.loops) {
    regions.push({
      id: stableId('loop', l.startLine, l.endLine, l.label, l.mediaTimestampStart),
      kind: 'loop',
      startLine: l.startLine,
      endLine: l.endLine,
      startTime: l.mediaTimestampStart,
      endTime: l.mediaTimestampEnd,
      label: l.label,
      repeatCount: l.repeatCount,
    });
  }

  for (const i of c.instrumentalSections) {
    regions.push({
      id: stableId('instrumental', i.startLine, i.endLine, i.label),
      kind: 'instrumental',
      startLine: i.startLine,
      endLine: i.endLine,
      startTime: i.mediaTimestampStart,
      endTime: i.mediaTimestampEnd,
      label: i.label,
    });
  }

  for (const s of c.sections) {
    regions.push({
      id: stableId('section', s.type, s.startTime, s.label),
      kind: 'section',
      startLine: s.startLine ?? null,
      endLine: s.endLine ?? null,
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.label,
      sectionType: s.type,
    });
  }

  return regions;
}

// -----------------------------------------------------------------------------
// Geração de ID para regiões criadas pelo usuário (fora de legacyToRegions)
//
// Usa as mesmas regras de stableId que legacyToRegions() — mesmos campos por kind —
// para que addRegion() produza o mesmo ID que legacyToRegions() produziria para a
// mesma região depois de um reload. É o único ponto de criação de IDs fora do fetch.
// -----------------------------------------------------------------------------

/** Calcula o id determinístico de uma região ainda sem id.
 *  Deve ser chamado só por useTimingRegionsStore.addRegion — não use direto nos componentes. */
export function makeRegionId(r: Omit<TimingRegion, 'id'>): string {
  switch (r.kind) {
    case 'phrase':       return stableId('phrase', r.startLine, r.startTime);
    case 'loop':         return stableId('loop', r.startLine, r.endLine, r.label, r.startTime);
    case 'instrumental': return stableId('instrumental', r.startLine, r.endLine, r.label);
    case 'section':      return stableId('section', r.sectionType, r.startTime, r.label);
  }
}

// -----------------------------------------------------------------------------
// Geração de ID determinístico para markers
//
// Mesmo mecanismo de stableId. O ID é estável entre re-fetches (mesmos dados →
// mesmo id) e é usado por targetMarkerId para referência cruzada entre markers.
// Se o usuário editar o tempo de um marker via updateMarker(), o ID NÃO muda
// (o store preserva o id via spread). O ID só seria diferente num reload completo
// com o dado alterado — aceitável, pois targetMarkerId é campo local-only por ora.
//
// Dois markers do mesmo tipo no mesmo tempo produziriam o mesmo ID (colisão).
// Isso é um caso degenerado (posicionalmente inválido musicalmente) que não vale
// tratar — djb2 sobre ~20 markers tem probabilidade de colisão desprezível.
// -----------------------------------------------------------------------------

/** Calcula o id determinístico de um marker.
 *  Deve ser chamado só por useTimingRegionsStore — não use direto nos componentes. */
export function makeMarkerId(type: MarkerType, time: number): string {
  return stableId('marker', type, time);
}

// PONTE TEMPORÁRIA — ver cabeçalho do arquivo.
/** Converte TimingRegion[] de volta para o payload que submitTiming() espera.
 *  Remover quando o backend aceitar TimingRegion[] diretamente. */
export function regionsToLegacyPayload(
  regions: TimingRegion[],
): Pick<TimingSubmitPayload, 'phrases' | 'loops' | 'instrumentalSections' | 'sections'> {
  const phrases: TimingPhrase[] = [];
  const loops: TimingLoop[] = [];
  const instrumentalSections: TimingInstrumental[] = [];
  const sections: TimingSection[] = [];

  for (const r of regions) {
    switch (r.kind) {
      case 'phrase':
        phrases.push({
          lineIndex: r.startLine!,
          startTime: r.startTime!,
          endTime: r.endTime!,
        });
        break;
      case 'loop':
        loops.push({
          label: r.label,
          startLine: r.startLine!,
          endLine: r.endLine!,
          repeatCount: r.repeatCount ?? 2,
          mediaTimestampStart: r.startTime,
          mediaTimestampEnd: r.endTime,
        });
        break;
      case 'instrumental':
        instrumentalSections.push({
          label: r.label,
          startLine: r.startLine,
          endLine: r.endLine,
          mediaTimestampStart: r.startTime,
          mediaTimestampEnd: r.endTime,
        });
        break;
      case 'section':
        sections.push({
          label: r.label,
          type: r.sectionType!,
          startTime: r.startTime!,
          endTime: r.endTime,
          ...(r.startLine != null && { startLine: r.startLine }),
          ...(r.endLine != null   && { endLine:   r.endLine   }),
        });
        break;
    }
  }

  return { phrases, loops, instrumentalSections, sections };
}
