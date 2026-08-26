/*
 * O que a tela tem a dizer sobre o tom guardado na estante.
 *
 * Mora fora do `SeletorDeTom.tsx` porque aquele arquivo só exporta componentes — misturar
 * uma função comum ali quebra o Fast Refresh do Vite, que precisa saber que um módulo é
 * inteiramente de componentes para trocá-lo a quente sem recarregar a página.
 */
import { shortestTranspose } from '../../engine/transposeKey';

/**
 *   `'salvar'`   — a música está nos favoritos e o tom da tela não é o que está guardado.
 *   `'guardado'` — o tom da tela É o guardado, e não é o original: vale avisar por que a
 *                  cifra abriu transposta, senão parece defeito.
 *   `null`       — não há nada a dizer (fora dos favoritos, ou tudo no original).
 */
export type EstadoTomSalvo = 'salvar' | 'guardado' | null;

export function estadoTomSalvo(favoritado: boolean, offsetAtual: number, offsetSalvo: number): EstadoTomSalvo {
  if (!favoritado) return null;
  // Pela volta curta: chegar em +7 clicando e escolher −5 na lista dão o mesmo tom, e
  // oferecer "salvar" por causa dessa diferença seria oferecer nada.
  if (shortestTranspose(offsetAtual) !== shortestTranspose(offsetSalvo)) return 'salvar';
  return offsetSalvo === 0 ? null : 'guardado';
}
