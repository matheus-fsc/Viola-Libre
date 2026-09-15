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

// ── O que o motor de tom devolve ────────────────────────────────────────────
//
// `src/engine/detectKey.ts` não escreve frase: devolve descritor (um `id` mais os valores
// que entram na frase). É aqui que o descritor vira texto, no idioma da tela.

import type {
  DeteccaoTom,
  DetalheDeAcorde,
  DistanciaDeTonica,
  ComoNoTrecho,
  SinalDeRepouso,
} from '../engine/detectKey';
import type { Traduzir } from './index';

/** Nome do modo. O motor usa o nome em português como IDENTIFICADOR do modo. */
const MODO: Record<string, Chave> = {
  'jônio': 'musica.modoJonio',
  'dórico': 'musica.modoDorico',
  'frígio': 'musica.modoFrigio',
  'lídio': 'musica.modoLidio',
  'mixolídio': 'musica.modoMixolidio',
  'eólio': 'musica.modoEolio',
  'lócrio': 'musica.modoLocrio',
};

/**
 * O rótulo de exibição de um tom: «G», «Em», «G mixolydian».
 *
 * O `nome` que vem do motor já é o rótulo pronto em português. Quando ele é IGUAL ao
 * `key`, o modo é o maior ou o menor de sempre e não há nada a traduzir: «Em» é «Em» em
 * qualquer idioma. Quando difere, o modo entrou no rótulo, e é só ele que muda.
 */
export function nomeDoTom(
  c: { key: string; nome: string; modo: { nome: string } },
  t: Traduzir,
): string {
  if (c.nome === c.key) return c.nome;
  const chave = MODO[c.modo.nome];
  if (!chave) return c.nome;
  // A tônica sai do rótulo de tríade sem a qualidade: «Gm» → «G», «Bm(b5)» → «B».
  return `${c.key.replace(/m(\(b5\))?$/, '')} ${t(chave)}`;
}

/** Um sinal de repouso, por extenso. */
export function sinalDeRepouso(s: SinalDeRepouso, t: Traduzir): string {
  const [a = '', b = ''] = s.acordes ?? [];
  switch (s.id) {
    case 'cadencia': return t('musica.sinalCadencia', { a, b });
    case 'terminaEm': return t('musica.sinalTerminaEm', { acorde: a });
    case 'dominanteAparece': return t('musica.sinalDominanteAparece', { acorde: a });
    case 'comecaEm': return t('musica.sinalComecaEm', { acorde: a });
    case 'tonicaAparece':
      return t('musica.sinalTonicaAparece', { vezes: s.vezes ?? 0, total: s.total ?? 0 });
  }
}

const DISTANCIA: Record<string, Chave> = {
  'mesma': 'musica.distMesma',
  'meioTom:acima': 'musica.distMeioTomAcima', 'meioTom:abaixo': 'musica.distMeioTomAbaixo',
  'umTom:acima': 'musica.distUmTomAcima', 'umTom:abaixo': 'musica.distUmTomAbaixo',
  'tercaMenor:acima': 'musica.distTercaMenorAcima', 'tercaMenor:abaixo': 'musica.distTercaMenorAbaixo',
  'tercaMaior:acima': 'musica.distTercaMaiorAcima', 'tercaMaior:abaixo': 'musica.distTercaMaiorAbaixo',
  'quarta:acima': 'musica.distQuartaAcima', 'quarta:abaixo': 'musica.distQuartaAbaixo',
  'tritono:acima': 'musica.distTritonoAcima', 'tritono:abaixo': 'musica.distTritonoAbaixo',
};

function distancia(d: DistanciaDeTonica, t: Traduzir): string {
  const chave = d.intervalo === 'mesma'
    ? DISTANCIA['mesma']
    : DISTANCIA[`${d.intervalo}:${d.direcao ?? 'acima'}`];
  return t(chave);
}

function comoNoTrecho(c: ComoNoTrecho, t: Traduzir): string {
  switch (c.id) {
    // Algarismo romano é o mesmo em qualquer idioma: sai cru.
    case 'grau': return c.grau;
    case 'vDe': return t('musica.comoVDe', { grau: c.grau });
    case 'dominante': return t('musica.comoDominante');
    case 'iv7': return t('musica.comoIv7');
    case 'emprestado': return t('musica.comoEmprestado');
  }
}

/** O papel de um acorde dentro do tom, por extenso. */
export function detalheDoAcorde(d: DetalheDeAcorde, t: Traduzir): string {
  switch (d.id) {
    case 'grau': return d.grau;
    case 'subV': return t('musica.detSubV', { alvo: d.alvo });
    case 'toniciza': return t('musica.detToniciza', { grau: d.grau });
    case 'dominanteDoDominante': return t('musica.detDominanteDoDominante', { alvo: d.alvo });
    case 'dominanteSeguinte': return t('musica.detDominanteSeguinte');
    // Sem grau no tom o acorde não tem para onde apontar, e a frase muda em vez de sair
    // com um buraco: «diminuto, sobe meio tom para ␣» é pior que não dizer o destino.
    case 'dimNotaComum':
      return d.grau ? t('musica.detDimNotaComum', { grau: d.grau }) : t('musica.detDimNotaComumSemGrau');
    case 'dimMeioTom':
      return d.grau ? t('musica.detDimMeioTom', { grau: d.grau }) : t('musica.detDimMeioTomSemGrau');
    case 'iiDeIIV':
      return d.grau ? t('musica.detIiDeIIV', { grau: d.grau }) : t('musica.detIiDeIIVSemGrau');
    case 'iv7Blues': return t('musica.detIv7Blues');
    case 'emprestimo':
      return t(
        d.fonte === 'paraleloMaior' ? 'musica.detParaleloMaior'
          : d.fonte === 'paraleloMenor' ? 'musica.detParaleloMenor'
            : 'musica.detMenorSextaMaior',
      );
    case 'tonicizacao':
      return t('musica.detTonicizacao', {
        como: comoNoTrecho(d.como, t),
        tom: d.tom,
        distancia: distancia(d.distancia, t),
      });
  }
}

/**
 * Como o painel conta o tom detectado e, quando é o caso, que não tem certeza.
 *
 * O tom sai de uma análise da cifra inteira, não de um dado que alguém digitou. Em boa
 * parte do acervo existem DOIS tons defensáveis para a mesma música: maior e seu relativo
 * menor têm as mesmas sete notas, e só a cadência separa os dois, quando a música tem
 * cadência clara. Afirmar um deles nesses casos é apostar com a cara do músico, que vai
 * ler «Original: G» e confiar.
 *
 * Então a frase acompanha a confiança: afirma quando dá, oferece as alternativas quando
 * não dá, e avisa quando a música simplesmente não fica no mesmo tom do começo ao fim.
 */
export function descricaoDoTom(deteccao: DeteccaoTom | null, t: Traduzir): string | undefined {
  if (!deteccao) return undefined;

  const tom = nomeDoTom(deteccao, t);
  const alternativas = deteccao.candidates
    .slice(1, 3)
    .map(c => nomeDoTom(c, t))
    .filter(k => k !== tom);

  if (deteccao.confidence === 'alta' && !deteccao.modulates) {
    return t('musica.descOriginal', { tom });
  }

  const ou = alternativas.length ? t('musica.descOu', { alternativas: alternativas.join(', ') }) : '';
  // Numa música que modula, nenhum rótulo único está certo, e o que o músico precisa saber
  // é que o tom vai mudar. Por isso o aviso vem junto, e não no lugar da alternativa.
  if (deteccao.modulates) return t('musica.descProvavelmente', { tom, ou });
  return t('musica.descTalvez', { tom, ou });
}
