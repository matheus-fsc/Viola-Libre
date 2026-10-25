import { useEffect, useState } from 'react';
import { getMaisBuscadas, type GlobalSearchResult } from '../services/api';

/**
 * A lista de mais buscadas, ou vazia enquanto carrega, se falhar ou se ainda não houver
 * dados (o servidor só lista música com pelo menos duas escolhas).
 *
 * Vazia é sempre "não mostre": quem usa esconde a aba ou a sugestão em vez de exibir
 * um painel sem nada, que é o caso nas primeiras semanas do contador.
 */
export function useMaisBuscadas(): GlobalSearchResult[] {
  const [lista, setLista] = useState<GlobalSearchResult[]>([]);
  useEffect(() => {
    getMaisBuscadas().then(setLista).catch(() => { /* enfeite: sem lista, nada aparece */ });
  }, []);
  return lista;
}
