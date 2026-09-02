/*
 * O estado do cache do aparelho, num só lugar.
 *
 * Mora fora do `PainelOffline.tsx` porque aquele arquivo só exporta componentes — misturar
 * um hook ali quebra o Fast Refresh do Vite, que precisa saber que um módulo é
 * inteiramente de componentes para trocá-lo a quente sem recarregar a página.
 *
 * O convite da primeira visita e o painel precisam do MESMO número e da mesma capacidade
 * de baixar; duplicar isso deixaria os dois mostrando contas diferentes da mesma coisa.
 */
import { useEffect, useRef, useState } from 'react';
import {
  BYTES_POR_CIFRA_ESTIMADO,
  espacoDoNavegador,
  formatarBytes,
  resumoDoCache,
  type ResumoDoCache,
} from '../../services/cifraCache';
import { baixarLista, type ProgressoDownload, type ResultadoDownload } from '../../services/baixarLista';

/** Quanto ~N cifras devem ocupar. Aproximado por natureza — ver `BYTES_POR_CIFRA_ESTIMADO`. */
export const estimarTamanho = (n: number): string => formatarBytes(n * BYTES_POR_CIFRA_ESTIMADO);

export interface CacheDeCifras {
  resumo: ResumoDoCache | null;
  espaco: { usado: number; total: number } | null;
  progresso: ProgressoDownload | null;
  guardadas: ReadonlySet<string>;
  /** Quantas da estante ainda não estão no aparelho. */
  faltam: number;
  medir: () => void;
  baixarTudo: () => Promise<ResultadoDownload | null>;
  parar: () => void;
}

export function useCacheDeCifras(todas: readonly string[]): CacheDeCifras {
  const [resumo, setResumo] = useState<ResumoDoCache | null>(null);
  const [espaco, setEspaco] = useState<{ usado: number; total: number } | null>(null);
  const [progresso, setProgresso] = useState<ProgressoDownload | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const todasRef = useRef(todas);
  todasRef.current = todas;

  const medir = () => {
    void resumoDoCache().then(setResumo);
    void espacoDoNavegador().then(setEspaco);
  };

  useEffect(() => {
    void resumoDoCache().then(setResumo);
    void espacoDoNavegador().then(setEspaco);
    // Sair da página no meio de um download não deve deixar requisições em voo.
    return () => abortRef.current?.abort();
  }, []);

  const guardadas = resumo?.chaves ?? new Set<string>();
  const faltam = todas.filter(c => !guardadas.has(c)).length;

  const baixarTudo = async (): Promise<ResultadoDownload | null> => {
    const alvo = todasRef.current;
    if (alvo.length === 0) return null;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgresso({ feitas: 0, total: alvo.length, falhas: 0 });
    const r = await baixarLista(alvo, setProgresso, ctrl.signal);
    setProgresso(null);
    abortRef.current = null;
    medir();
    return r;
  };

  return {
    resumo, espaco, progresso, guardadas, faltam, medir, baixarTudo,
    parar: () => abortRef.current?.abort(),
  };
}
