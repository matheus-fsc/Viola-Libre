import { beforeEach, describe, expect, it } from 'vitest';
import { useTimingRegionsStore } from './useTimingRegionsStore';
import type { TimingContribution } from '../services/timingApi';
import type { TimingRegion } from '../services/timingRegions';

// O store é um singleton de módulo: sem voltar ao estado inicial, um teste herdaria as
// regiões do anterior. O snapshot inclui as ações, então o `replace` não as apaga.
const inicial = useTimingRegionsStore.getState();
beforeEach(() => { useTimingRegionsStore.setState(inicial, true); });

const store = () => useTimingRegionsStore.getState();

function contribuicao(parcial: Partial<TimingContribution> = {}): TimingContribution {
  return {
    id: 'c1', editorAlias: null, mediaUrl: null, mediaType: null,
    bpm: 90, duration: 180, votes: 0, updatedAt: '2026-01-01',
    loops: [], instrumentalSections: [], phrases: [], sections: [], markers: [],
    ...parcial,
  };
}

const refrao: Omit<TimingRegion, 'id'> = {
  kind: 'section', sectionType: 'chorus', label: 'Refrão',
  startLine: null, endLine: null, startTime: 30, endTime: 45,
};

describe('carregar uma contribuição', () => {
  it('materializa as regiões e dá id aos markers', () => {
    store().loadFromContribution(contribuicao({
      phrases: [{ lineIndex: 2, startTime: 1, endTime: 3 }],
      sections: [{ label: 'Intro', type: 'intro', startTime: 0, endTime: 10 }],
      markers: [{ type: 'segno', time: 12 }],
    }));
    expect(store().regions.map(r => r.kind)).toEqual(['phrase', 'section']);
    expect(store().markers[0].id).toMatch(/^marker-/);
  });

  // O id é o que mantém a seleção estável entre re-fetches: o mesmo dado tem que dar o
  // mesmo id, senão a região selecionada some da tela a cada recarga.
  it('recarregar o mesmo dado reproduz os mesmos ids', () => {
    const c = contribuicao({ sections: [{ label: 'Verso', type: 'verse', startTime: 5, endTime: 20 }] });
    store().loadFromContribution(c);
    const antes = store().regions.map(r => r.id);
    store().loadFromContribution(c);
    expect(store().regions.map(r => r.id)).toEqual(antes);
  });

  it('aceita contribuição sem markers', () => {
    const c = contribuicao();
    delete (c as Partial<TimingContribution>).markers;
    store().loadFromContribution(c);
    expect(store().markers).toEqual([]);
  });
});

describe('regiões', () => {
  it('criar pelo editor dá o mesmo id que o reload daria', () => {
    const id = store().addRegion(refrao);
    store().loadFromContribution(contribuicao({ sections: store().getSerializedPayload().sections }));
    expect(store().regions[0].id).toBe(id);
  });

  // Colisão de id é a mesma região marcada de novo; duplicar quebraria a key do React.
  it('adicionar uma região idêntica substitui em vez de duplicar', () => {
    store().addRegion(refrao);
    store().addRegion({ ...refrao, endTime: 50 });
    expect(store().regions).toHaveLength(1);
    expect(store().regions[0].endTime).toBe(50);
  });

  it('editar preserva o id, mesmo mudando o que o originou', () => {
    const id = store().addRegion(refrao);
    store().updateRegion(id, { startTime: 99, label: 'Outro nome' });
    expect(store().regions[0]).toMatchObject({ id, startTime: 99, label: 'Outro nome' });
  });

  it('remover tira só a região pedida', () => {
    const a = store().addRegion(refrao);
    const b = store().addRegion({ ...refrao, startTime: 60, endTime: 75 });
    store().removeRegion(a);
    expect(store().regions.map(r => r.id)).toEqual([b]);
  });
});

describe('markers', () => {
  // targetMarkerId aponta para o id; se editar o tempo trocasse o id, o D.S. perderia o Segno.
  it('editar o tempo não troca o id', () => {
    const id = store().addMarker({ type: 'segno', time: 10 });
    store().updateMarker(id, { time: 20 });
    expect(store().markers[0]).toMatchObject({ id, time: 20 });
  });

  it('remover tira só o marker pedido', () => {
    const a = store().addMarker({ type: 'segno', time: 10 });
    store().addMarker({ type: 'fine', time: 90 });
    store().removeMarker(a);
    expect(store().markers.map(m => m.type)).toEqual(['fine']);
  });
});

describe('snapshot', () => {
  it('exportar e importar devolve o mesmo estado, com os campos extras', () => {
    store().addRegion(refrao);
    store().addMarker({ type: 'fine', time: 90 });
    const json = store().exportSnapshot({ mediaUrl: 'https://youtu.be/x', bpm: 120 });
    const { regions, markers } = store();

    useTimingRegionsStore.setState(inicial, true);
    const lido = store().importSnapshot(json) as Record<string, unknown>;

    expect(store().regions).toEqual(regions);
    expect(store().markers).toEqual(markers);
    expect(lido).toMatchObject({ mediaUrl: 'https://youtu.be/x', bpm: 120 });
  });

  // Um arquivo errado não pode deixar o editor pela metade: ou aplica tudo, ou nada.
  it.each([
    ['não é JSON', '{'],
    ['não é objeto', '42'],
    ['sem arrays', '{"regions":{},"markers":[]}'],
    ['região sem id', '{"regions":[{"kind":"loop"}],"markers":[]}'],
    ['kind desconhecido', '{"regions":[{"id":"x","kind":"refrao"}],"markers":[]}'],
    ['marker sem tempo', '{"regions":[],"markers":[{"id":"m","type":"fine"}]}'],
  ])('recusa snapshot inválido (%s) sem mexer no estado', (_caso, json) => {
    const id = store().addRegion(refrao);
    expect(() => store().importSnapshot(json)).toThrow(/inválid/);
    expect(store().regions.map(r => r.id)).toEqual([id]);
  });
});
