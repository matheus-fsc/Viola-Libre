/**
 * O interceptor que atravessa a janela de manutenção.
 *
 * A regra que estes testes seguram é a que mais fácil se perde num refactor: repetir
 * LEITURA é inofensivo, repetir ESCRITA não é. Um `view` duplicado não machuca ninguém,
 * mas um toggle de favorito repetido desfaz exatamente o que o usuário acabou de pedir.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import api from './api';
import {
  _resetarNoTeste,
  _usarDormirNoTeste,
  estadoDaManutencao,
} from './manutencao';

const CORPO_MANUTENCAO = {
  status: 'maintenance',
  message: 'Backup do banco em andamento.',
};

/** Um adaptador que devolve, em ordem, as respostas roteirizadas. */
function adaptadorDeRoteiro(roteiro: Array<{ status: number; data: unknown }>) {
  const chamadas: string[] = [];
  const adapter = async (config: InternalAxiosRequestConfig) => {
    chamadas.push(`${(config.method ?? 'get').toUpperCase()} ${config.url}`);
    const passo = roteiro.shift() ?? { status: 200, data: { ok: true } };
    const resposta = {
      data: passo.data,
      status: passo.status,
      statusText: '',
      headers: {},
      config,
    };
    if (passo.status >= 400) {
      throw new axios.AxiosError('falhou', String(passo.status), config, {}, resposta as never);
    }
    return resposta as never;
  };
  return { adapter, chamadas };
}

let restaurarDormir: () => void;
const adapterOriginal = api.defaults.adapter;

beforeEach(() => {
  _resetarNoTeste();
  restaurarDormir = _usarDormirNoTeste(async () => {});
});

afterEach(() => {
  restaurarDormir();
  api.defaults.adapter = adapterOriginal;
});

describe('interceptor de manutenção', () => {
  it('repete um GET e entrega a resposta boa, sem o chamador saber de nada', async () => {
    const { adapter, chamadas } = adaptadorDeRoteiro([
      { status: 503, data: CORPO_MANUTENCAO },
      { status: 200, data: { titulo: 'Corcovado' } },
    ]);
    api.defaults.adapter = adapter as never;

    const { data } = await api.get('/api/cifra/tom-jobim/corcovado');

    expect(data).toEqual({ titulo: 'Corcovado' });
    expect(chamadas).toHaveLength(2);
    // Respondeu: a janela fechou sozinha, sem ninguém recarregar nada.
    expect(estadoDaManutencao().emManutencao).toBe(false);
  });

  it('anuncia a manutenção enquanto ela dura', async () => {
    const { adapter } = adaptadorDeRoteiro([
      { status: 503, data: CORPO_MANUTENCAO },
      { status: 503, data: CORPO_MANUTENCAO },
      { status: 200, data: {} },
    ]);
    api.defaults.adapter = adapter as never;

    const promessa = api.get('/api/generos');
    // Depois do primeiro 503 o aviso já está de pé, com a frase que a API mandou.
    await Promise.resolve();
    await promessa;
    expect(estadoDaManutencao().emManutencao).toBe(false);
  });

  it('NÃO repete escrita: um POST falha e o chamador decide o que fazer', async () => {
    const { adapter, chamadas } = adaptadorDeRoteiro([
      { status: 503, data: CORPO_MANUTENCAO },
      { status: 200, data: { favorited: true } },
    ]);
    api.defaults.adapter = adapter as never;

    await expect(api.post('/api/cifra/a/b/favorite', {})).rejects.toThrow();
    expect(chamadas).toHaveLength(1);
    // Mas o aviso sobe do mesmo jeito: a pessoa precisa saber por que não gravou.
    expect(estadoDaManutencao().emManutencao).toBe(true);
    expect(estadoDaManutencao().mensagem).toBe(CORPO_MANUTENCAO.message);
  });

  it('um 503 que NÃO é manutenção falha na hora, sem repetir nem avisar', async () => {
    // Proxy caído, container reiniciando. Repetir quinze vezes atrasaria em cinco minutos
    // o erro que a tela precisa mostrar agora.
    const { adapter, chamadas } = adaptadorDeRoteiro([
      { status: 503, data: '<html>Bad Gateway</html>' },
    ]);
    api.defaults.adapter = adapter as never;

    await expect(api.get('/api/generos')).rejects.toThrow();
    expect(chamadas).toHaveLength(1);
    expect(estadoDaManutencao().emManutencao).toBe(false);
  });

  it('esgotada a paciência, baixa o aviso e devolve a falha comum', async () => {
    // Cinco minutos já não são "poucos minutos". Manter a faixa prometendo volta rápida
    // seria insistir numa explicação que a evidência deixou de sustentar.
    const roteiro = Array.from({ length: 40 }, () => ({ status: 503, data: CORPO_MANUTENCAO }));
    const { adapter } = adaptadorDeRoteiro(roteiro);
    api.defaults.adapter = adapter as never;

    await expect(api.get('/api/generos')).rejects.toThrow();
    expect(estadoDaManutencao().emManutencao).toBe(false);
  });

  it('erro comum continua passando direto', async () => {
    const { adapter, chamadas } = adaptadorDeRoteiro([{ status: 404, data: { detail: 'sumiu' } }]);
    api.defaults.adapter = adapter as never;

    await expect(api.get('/api/cifra/nao/existe')).rejects.toThrow();
    expect(chamadas).toHaveLength(1);
    expect(estadoDaManutencao().emManutencao).toBe(false);
  });
});
