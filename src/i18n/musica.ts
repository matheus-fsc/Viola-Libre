/*
 * Ponte entre o motor musical e o dicionário.
 *
 * O motor de `src/engine/` devolve alguns rótulos em português. Eles NÃO são texto de
 * tela: são identificadores de tipo (`'Fácil' | 'Média' | 'Difícil'`), e a suíte de
 * regressão compara com eles. Traduzir na origem quebraria o contrato do motor e os
 * testes junto.
 *
 * Então a tradução acontece aqui, na fronteira: o motor continua falando a língua dele e
 * quem desenha passa o identificador por uma destas tabelas.
 */
import type { Chave } from './dicionario';

/** Dificuldade de execução de uma digitação (`getVoicingDifficulty`). */
export const DIFICULDADE: Record<'Fácil' | 'Média' | 'Difícil', Chave> = {
  'Fácil': 'acordes.facil',
  'Média': 'acordes.media',
  'Difícil': 'acordes.dificil',
};
