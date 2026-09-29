/**
 * Janela de manutenção da API — o backup diário do banco.
 *
 * Uma vez por dia (por volta das 3h17 UTC, e eventualmente à mão) a API sai do ar por
 * alguns minutos para o backup. Durante a janela TODA rota `/api/*` responde 503 com
 * `{"status": "maintenance", ...}` e cabeçalhos de CORS corretos — ou seja, a chamada
 * chega até nós como uma resposta normal, não como falha de rede.
 *
 * Sem tratamento isso aparecia como erro cru: a cifra não carregava e o console cuspia
 * axios. É uma parada planejada e curta, e merece a cara de parada planejada e curta.
 *
 * Duas coisas moram aqui, e só elas:
 *
 *   • o ESTADO (estamos em manutenção? com que mensagem?), publicado para quem quiser
 *     desenhar um aviso — o padrão de assinatura é o mesmo de `cifraFavorites` e
 *     `youtubeApi`, para não inventar um terceiro jeito de escutar mudança no projeto;
 *   • a POLÍTICA de repetição, que o interceptor do axios aplica.
 *
 * O que NÃO mora aqui é a decisão de recarregar a página. A recuperação é por repetição
 * da requisição que falhou (ver `api.ts`), e não por reload: numa tela como o editor de
 * timing um reload custaria trabalho não salvo, e o preço não se justifica quando a
 * própria requisição pode simplesmente ser refeita.
 */

/** Corpo que a API manda durante a janela. */
interface CorpoDeManutencao {
  status?: unknown;
  message?: unknown;
}

/**
 * É a manutenção, e não um 503 qualquer?
 *
 * O status sozinho não basta: 503 também sai de balanceador sem backend, de container
 * reiniciando, de proxy mal configurado. Esses são problemas de verdade e não podem
 * receber a mesma tela tranquila de "já voltamos" — por isso se exige o corpo.
 */
export function ehManutencao(status: number | undefined, corpo: unknown): boolean {
  if (status !== 503) return false;
  if (typeof corpo !== 'object' || corpo === null) return false;
  return (corpo as CorpoDeManutencao).status === 'maintenance';
}

/** A mensagem que a API mandou, quando vier utilizável. */
export function mensagemDaApi(corpo: unknown): string | null {
  if (typeof corpo !== 'object' || corpo === null) return null;
  const msg = (corpo as CorpoDeManutencao).message;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
}

export interface EstadoDeManutencao {
  emManutencao: boolean;
  /** A frase vinda da API, quando houver. A UI tem a própria como reserva. */
  mensagem: string | null;
  /** Quantas vezes já se tentou de novo nesta janela. Alimenta o texto do aviso. */
  tentativas: number;
}

let estado: EstadoDeManutencao = { emManutencao: false, mensagem: null, tentativas: 0 };
const ouvintes = new Set<() => void>();

function publicar(novo: EstadoDeManutencao): void {
  // Sem mudança real não se avisa ninguém: durante a janela cada requisição que falha
  // passaria por aqui, e re-renderizar o app inteiro a cada uma seria desperdício puro.
  if (
    novo.emManutencao === estado.emManutencao &&
    novo.mensagem === estado.mensagem &&
    novo.tentativas === estado.tentativas
  ) {
    return;
  }
  estado = novo;
  for (const fn of ouvintes) fn();
}

export function estadoDaManutencao(): EstadoDeManutencao {
  return estado;
}

export function assinarManutencao(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

export function entrouEmManutencao(mensagem: string | null): void {
  publicar({ emManutencao: true, mensagem, tentativas: estado.tentativas });
}

/**
 * Qualquer resposta bem-sucedida encerra a janela.
 *
 * É o sinal mais barato e mais confiável que existe: se o servidor respondeu, ele voltou.
 * Uma rota de sondagem dedicada não traria nada — só mais uma requisição para manter.
 */
export function saiuDaManutencao(): void {
  if (!estado.emManutencao && estado.tentativas === 0) return;
  publicar({ emManutencao: false, mensagem: null, tentativas: 0 });
}

function contarTentativa(): void {
  publicar({ ...estado, tentativas: estado.tentativas + 1 });
}

/**
 * Espaçamento entre tentativas, e quanto tempo se insiste no total.
 *
 * A janela "dura poucos minutos", então 20s erra pouco nos dois sentidos: não martela o
 * servidor que está fazendo backup, e não deixa o usuário olhando um aviso por meio minuto
 * depois de a API já ter voltado. Quinze tentativas dão cinco minutos de paciência; passado
 * isso a falha volta a ser uma falha comum, porque aí já não é a janela de sempre e fingir
 * que é seria mentir para quem está na tela.
 */
export const INTERVALO_MS = 20_000;
export const MAX_TENTATIVAS = 15;

/** Injetável para o teste não esperar vinte segundos de verdade. */
let dormir = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export function _usarDormirNoTeste(fn: (ms: number) => Promise<void>): () => void {
  const anterior = dormir;
  dormir = fn;
  return () => {
    dormir = anterior;
  };
}

/**
 * Aguarda o próximo intervalo. Devolve `false` quando a paciência acabou.
 *
 * Quem chama é o interceptor, uma vez por requisição em espera. Todas as requisições
 * paradas acordam juntas e repetem em bloco — que é exatamente o volume de um
 * carregamento de página, o mesmo que teria acontecido se a API estivesse de pé.
 */
export async function aguardarParaRepetir(tentativaAtual: number): Promise<boolean> {
  if (tentativaAtual >= MAX_TENTATIVAS) return false;
  contarTentativa();
  await dormir(INTERVALO_MS);
  return true;
}

/** Zera o estado. Só para teste. */
export function _resetarNoTeste(): void {
  estado = { emManutencao: false, mensagem: null, tentativas: 0 };
  ouvintes.clear();
}
