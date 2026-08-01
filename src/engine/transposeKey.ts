/**
 * Traz um deslocamento de transposição para a volta mais curta, em [-5, +6].
 *
 * +7 e −5 chegam no mesmo tom, mas não são a mesma coisa para quem lê o painel: um diz
 * "subi sete", o outro "desci cinco". Escolher a volta curta é o que faz o mostrador de
 * semitons bater com o que os botões de −½/+½ mostrariam se o músico tivesse chegado ali
 * clicando, em vez de ter escolhido o tom na lista.
 *
 * O empate em 6 vai para cima (+6, o trítono), por ser o valor que a soma repetida de +½
 * alcança primeiro saindo do zero.
 */
export function shortestTranspose(semitones: number): number {
  const wrapped = ((semitones % 12) + 12) % 12;
  return wrapped > 6 ? wrapped - 12 : wrapped;
}
