/**
 * A janela de manutenção da API.
 *
 * O que estes testes protegem, antes de tudo, é a DISTINÇÃO: um 503 de manutenção recebe
 * uma tela tranquila de "já voltamos", e um 503 qualquer não pode receber a mesma coisa.
 * Confundir os dois esconderia infraestrutura caída atrás de uma mensagem que promete
 * volta em poucos minutos.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_TENTATIVAS,
  _resetarNoTeste,
  _usarDormirNoTeste,
  aguardarParaRepetir,
  assinarManutencao,
  ehManutencao,
  entrouEmManutencao,
  estadoDaManutencao,
  mensagemDaApi,
  saiuDaManutencao,
} from './manutencao';

const CORPO = {
  status: 'maintenance',
  message: 'Backup do banco em andamento — a API volta em poucos minutos.',
};

beforeEach(() => {
  _resetarNoTeste();
});

describe('manutenção — reconhecer a janela', () => {
  it('reconhece o 503 com o corpo da manutenção', () => {
    expect(ehManutencao(503, CORPO)).toBe(true);
  });

  it('NÃO trata um 503 qualquer como manutenção', () => {
    // Balanceador sem backend, container reiniciando, proxy mal configurado: todos dão
    // 503 e todos são problema de verdade. Prometer "volta em poucos minutos" para eles
    // seria mentir para quem está na tela — daí exigir o corpo, e não só o status.
    expect(ehManutencao(503, undefined)).toBe(false);
    expect(ehManutencao(503, null)).toBe(false);
    expect(ehManutencao(503, '<html>502 Bad Gateway</html>')).toBe(false);
    expect(ehManutencao(503, { status: 'error' })).toBe(false);
    expect(ehManutencao(503, {})).toBe(false);
  });

  it('não confunde outros status, nem com o corpo certo', () => {
    expect(ehManutencao(500, CORPO)).toBe(false);
    expect(ehManutencao(403, CORPO)).toBe(false);
    expect(ehManutencao(200, CORPO)).toBe(false);
    expect(ehManutencao(undefined, CORPO)).toBe(false);
  });

  it('aproveita a mensagem da API, e só quando ela é utilizável', () => {
    expect(mensagemDaApi(CORPO)).toBe(CORPO.message);
    expect(mensagemDaApi({ status: 'maintenance' })).toBeNull();
    expect(mensagemDaApi({ message: '   ' })).toBeNull();
    expect(mensagemDaApi({ message: 42 })).toBeNull();
    expect(mensagemDaApi(null)).toBeNull();
  });
});

describe('manutenção — estado publicado', () => {
  it('avisa quem assinou ao entrar e ao sair', () => {
    let avisos = 0;
    assinarManutencao(() => avisos++);

    entrouEmManutencao(CORPO.message);
    expect(estadoDaManutencao().emManutencao).toBe(true);
    expect(estadoDaManutencao().mensagem).toBe(CORPO.message);
    expect(avisos).toBe(1);

    saiuDaManutencao();
    expect(estadoDaManutencao().emManutencao).toBe(false);
    expect(estadoDaManutencao().mensagem).toBeNull();
    expect(avisos).toBe(2);
  });

  it('não re-publica quando nada mudou', () => {
    // Durante a janela TODA requisição que falha passa por aqui. Sem este corte, uma
    // página com trinta acordes re-renderizaria o app trinta vezes para dizer a mesma
    // coisa.
    let avisos = 0;
    assinarManutencao(() => avisos++);
    entrouEmManutencao(CORPO.message);
    entrouEmManutencao(CORPO.message);
    entrouEmManutencao(CORPO.message);
    expect(avisos).toBe(1);
  });

  it('sair da manutenção sem nunca ter entrado não custa nada', () => {
    let avisos = 0;
    assinarManutencao(() => avisos++);
    saiuDaManutencao();
    expect(avisos).toBe(0);
  });

  it('cancelar a assinatura para de avisar', () => {
    let avisos = 0;
    const cancelar = assinarManutencao(() => avisos++);
    entrouEmManutencao(null);
    cancelar();
    saiuDaManutencao();
    expect(avisos).toBe(1);
  });
});

describe('manutenção — política de repetição', () => {
  it('espera antes de cada tentativa e conta quantas foram', async () => {
    const esperas: number[] = [];
    const restaurar = _usarDormirNoTeste(async ms => {
      esperas.push(ms);
    });
    try {
      expect(await aguardarParaRepetir(0)).toBe(true);
      expect(await aguardarParaRepetir(1)).toBe(true);
      expect(esperas).toHaveLength(2);
      expect(esperas[0]).toBeGreaterThan(0);
      expect(estadoDaManutencao().tentativas).toBe(2);
    } finally {
      restaurar();
    }
  });

  it('desiste depois do teto, para a falha voltar a ser uma falha', async () => {
    // Passado o limite já não é a janela de sempre, e continuar mostrando "volta em
    // poucos minutos" seria insistir numa promessa que a evidência não sustenta.
    const restaurar = _usarDormirNoTeste(async () => {});
    try {
      expect(await aguardarParaRepetir(MAX_TENTATIVAS)).toBe(false);
      expect(await aguardarParaRepetir(MAX_TENTATIVAS + 1)).toBe(false);
    } finally {
      restaurar();
    }
  });

  it('uma resposta boa zera o contador da janela', async () => {
    const restaurar = _usarDormirNoTeste(async () => {});
    try {
      entrouEmManutencao(null);
      await aguardarParaRepetir(0);
      expect(estadoDaManutencao().tentativas).toBe(1);
      saiuDaManutencao();
      expect(estadoDaManutencao().tentativas).toBe(0);
    } finally {
      restaurar();
    }
  });
});
