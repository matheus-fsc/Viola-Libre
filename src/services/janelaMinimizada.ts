/*
 * A janela minimizada.
 *
 * A barra de título do desktop tinha três botões com a aparência dos do Windows e o
 * comportamento de nenhum deles: o `_` levava pra área de trabalho sem guardar nada — o
 * mesmo que fechar — e o `✕`, o botão mais vermelho e mais familiar da tela, abria o
 * "Sobre". Quem clica num ✕ está pedindo pra sair de onde está.
 *
 * Aqui os dois passam a se distinguir pela única coisa que os distingue no XP: minimizar
 * GUARDA a janela, fechar a descarta. O que se guarda é a rota inteira — `/cifras/almir-
 * sater/tocando-em-frente`, e não só "estava em Cifras" —, porque voltar pra aba certa na
 * música errada não é restaurar coisa nenhuma.
 *
 * `sessionStorage` pelo mesmo motivo da memória de abas (ver `useTabNavigation`) e da
 * lista aberta: minimizar é coisa de agora. Sobreviver a um F5 é útil; ressuscitar a
 * janela de ontem seria assombração.
 *
 * A rota vem do próprio navegador, mas passa pela mesma desconfiança que a lista aberta:
 * `sessionStorage` é do usuário, editável à mão, e uma rota absoluta guardada aqui viraria
 * um redirecionamento pra fora do site disparado por um clique na barra de tarefas.
 */

const CHAVE = 'vl_janela_minimizada';

/** Teto folgado: uma rota do site não chega perto disso, e barra lixo colado à mão. */
const MAX_ROTA = 2048;

const rotaValida = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= MAX_ROTA &&
  v.startsWith('/') &&
  !v.startsWith('//');

export function minimizarJanela(rota: string): void {
  if (!rotaValida(rota)) return;
  try {
    sessionStorage.setItem(CHAVE, rota);
  } catch {
    // Modo privado ou storage cheio: perder o "restaurar" é aceitável; a janela minimiza
    // do mesmo jeito e o botão da aba continua sendo o caminho de volta.
  }
}

export function lerJanelaMinimizada(): string | null {
  try {
    const rota = sessionStorage.getItem(CHAVE);
    return rotaValida(rota) ? rota : null;
  } catch {
    return null;
  }
}

export function limparJanelaMinimizada(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch { /* idem */ }
}
