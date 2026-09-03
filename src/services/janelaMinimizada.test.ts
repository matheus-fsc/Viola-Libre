import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lerJanelaMinimizada, limparJanelaMinimizada, minimizarJanela } from './janelaMinimizada';

// Mesmo apoio do `listaAberta.test`: o ambiente é Node puro (ver vitest.config.ts), então o
// `sessionStorage` do navegador não existe — aqui ele é um mapa, que é tudo que este módulo
// usa dele.
function instalarSessionStorage() {
  const dados = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v); },
    removeItem: (k: string) => { dados.delete(k); },
  });
  return dados;
}

let dados: Map<string, string>;
beforeEach(() => { dados = instalarSessionStorage(); });

describe('minimizar e restaurar', () => {
  it('guarda a rota inteira, com busca', () => {
    minimizarJanela('/cifras?letra=E');
    expect(lerJanelaMinimizada()).toBe('/cifras?letra=E');
  });

  it('limpar apaga o registro', () => {
    minimizarJanela('/favoritos');
    limparJanelaMinimizada();
    expect(lerJanelaMinimizada()).toBeNull();
  });

  it('sem nada guardado, não há janela minimizada', () => {
    expect(lerJanelaMinimizada()).toBeNull();
  });
});

describe('desconfiança do que está no storage', () => {
  // O `sessionStorage` é do usuário e editável à mão. Uma rota absoluta guardada aqui
  // viraria redirecionamento para fora do site disparado por um clique na barra de tarefas.
  it.each([
    ['https://exemplo.com/phishing', 'endereço absoluto'],
    ['//exemplo.com/phishing', 'protocolo-relativo — o navegador trata como outro host'],
    ['cifras/algo', 'caminho sem a barra inicial'],
    ['', 'vazio'],
  ])('recusa %j (%s)', (rota) => {
    dados.set('vl_janela_minimizada', rota);
    expect(lerJanelaMinimizada()).toBeNull();
  });

  it('recusa uma rota absurdamente longa', () => {
    dados.set('vl_janela_minimizada', '/' + 'a'.repeat(5000));
    expect(lerJanelaMinimizada()).toBeNull();
  });

  it('não chega a gravar uma rota inválida', () => {
    minimizarJanela('https://exemplo.com');
    expect(dados.has('vl_janela_minimizada')).toBe(false);
  });
});

describe('storage indisponível', () => {
  // Modo privado, cota estourada, política do navegador. Perder o "restaurar" é aceitável;
  // deixar uma exceção subir até o clique no botão não é.
  it('minimizar não estoura quando o storage recusa a escrita', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('QuotaExceededError'); },
      removeItem: () => { throw new DOMException('bloqueado'); },
    });
    expect(() => minimizarJanela('/favoritos')).not.toThrow();
    expect(() => limparJanelaMinimizada()).not.toThrow();
    expect(lerJanelaMinimizada()).toBeNull();
  });

  it('ler não estoura quando o storage recusa a leitura', () => {
    vi.stubGlobal('sessionStorage', {
      get getItem() { throw new DOMException('bloqueado'); },
    });
    expect(lerJanelaMinimizada()).toBeNull();
  });
});
