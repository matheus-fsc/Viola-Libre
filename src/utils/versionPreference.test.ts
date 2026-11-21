import { describe, expect, it } from 'vitest';
import { sortVersionsForInstrument } from './versionPreference';

const alternativa = { version_name: 'Acústica' };
const principal = { version_name: 'Versão Principal' };
const viola = { version_name: 'Viola' };
const versions = [alternativa, principal, viola];
const lista = { preferPrincipal: true };

describe('sortVersionsForInstrument', () => {
  it('escolhe a versão Viola para viola caipira', () => {
    expect(sortVersionsForInstrument(versions, 'viola', lista)[0]).toBe(viola);
  });

  it('escolhe a versão Principal para violão', () => {
    expect(sortVersionsForInstrument(versions, 'violao', lista)[0]).toBe(principal);
  });

  it('escolhe a versão Principal quando não há versão Viola', () => {
    expect(sortVersionsForInstrument([alternativa, principal], 'viola', lista)[0]).toBe(principal);
  });

  it('reconhece Viola independentemente de maiúsculas e minúsculas', () => {
    const violaMista = { version_name: 'vIoLa' };
    expect(sortVersionsForInstrument([principal, violaMista], 'viola', lista)[0]).toBe(violaMista);
  });

  it('move as versões Viola para o início do seletor e preserva a ordem das demais', () => {
    const outraViola = { version_name: 'VIOLA' };
    const opcoes = [alternativa, viola, principal, outraViola];
    expect(sortVersionsForInstrument(opcoes, 'viola')).toEqual([viola, outraViola, alternativa, principal]);
    expect(opcoes).toEqual([alternativa, viola, principal, outraViola]);
  });

  it('preserva a ordem do seletor para violão', () => {
    expect(sortVersionsForInstrument(versions, 'violao')).toEqual(versions);
  });
});
