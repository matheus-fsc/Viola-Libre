import { beforeEach, describe, expect, it, vi } from 'vitest';

// Os dois stores leem o storage na carga do módulo, então cada caso instala o storage que
// quer e importa uma cópia nova. O ambiente é Node puro (ver vitest.config.ts): o
// `localStorage` daqui é um mapa, que é tudo que esses stores usam dele.
function instalarLocalStorage(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v); },
  });
  return dados;
}

function storageBloqueado() {
  vi.stubGlobal('localStorage', {
    getItem: () => { throw new DOMException('bloqueado', 'SecurityError'); },
    setItem: () => { throw new DOMException('bloqueado', 'SecurityError'); },
  });
}

beforeEach(() => { vi.resetModules(); });

const notacao = async () => (await import('./useNotationStore')).useNotationStore;
const visualizacao = async () => (await import('./useVisualizationStore')).useVisualizationStore;

describe('notação', () => {
  // O acervo é de cifra brasileira; o idioma do aparelho não muda o rótulo.
  it('sem nada guardado, começa no padrão brasileiro', async () => {
    instalarLocalStorage();
    expect((await notacao()).getState().standard).toBe('pt-BR');
  });

  it('lembra a escolha', async () => {
    const dados = instalarLocalStorage();
    (await notacao()).getState().setStandard('intl');
    expect(dados.get('viola_libre_notacao')).toBe('intl');

    vi.resetModules();
    expect((await notacao()).getState().standard).toBe('intl');
  });

  it('ignora valor desconhecido no storage', async () => {
    instalarLocalStorage({ viola_libre_notacao: 'americano' });
    expect((await notacao()).getState().standard).toBe('pt-BR');
  });

  it('storage bloqueado não derruba a carga, e a troca vale na sessão', async () => {
    storageBloqueado();
    const store = await notacao();
    expect(store.getState().standard).toBe('pt-BR');
    store.getState().setStandard('intl');
    expect(store.getState().standard).toBe('intl');
  });
});

describe('ordem das cordas', () => {
  // null é o que dispara o onboarding: quem nunca escolheu precisa ser perguntado.
  it('sem nada guardado, fica sem escolha', async () => {
    instalarLocalStorage();
    expect((await visualizacao()).getState().stringOrder).toBeNull();
  });

  it('lembra a escolha', async () => {
    const dados = instalarLocalStorage();
    (await visualizacao()).getState().setStringOrder('inverted');
    expect(dados.get('viola_libre_string_order')).toBe('inverted');
  });

  it('storage bloqueado não derruba a carga', async () => {
    storageBloqueado();
    const store = await visualizacao();
    expect(store.getState().stringOrder).toBeNull();
    store.getState().setStringOrder('standard');
    expect(store.getState().stringOrder).toBe('standard');
  });
});
