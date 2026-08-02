import type { SeoData } from '../hooks/useSeo';
import type { TabId } from '../hooks/useTabNavigation';

/**
 * Título e descrição de cada seção fixa do site.
 *
 * Escritos para a busca, não para a UI: o `TAB_LABEL` diz "Treinos e Teoria" porque
 * é o que cabe na aba, mas ninguém digita isso no Google — digita "treino de escalas
 * viola caipira". Por isso os dois textos existem separados em vez de um derivar do
 * outro.
 *
 * As descrições ficam na faixa de 120–160 caracteres, que é o que o Google mostra
 * antes de cortar.
 *
 * As rotas de cifra NÃO estão aqui: título e descrição delas dependem da música
 * carregada, e cada página daquela subárvore monta o seu (ver CifraViewer, SongList
 * e ArtistList).
 */
export const TAB_SEO: Record<Exclude<TabId, 'cifras'>, SeoData> = {
  desktop: {
    title: 'Viola Libre',
    description:
      'Cifras, dicionário de acordes e teoria musical para viola caipira, violão e cavaquinho. Troque de afinação e veja os acordes no braço. Livre, sem anúncios.',
    path: '/',
  },
  chords: {
    title: 'Dicionário de Acordes — Viola Caipira, Violão e Cavaquinho',
    description:
      'Monte qualquer acorde e veja as posições no braço do instrumento. Inversões, acordes com baixo invertido e troca de afinação (cebolão ré, cebolão mi, rio abaixo).',
    path: '/chords',
  },
  train: {
    title: 'Treinos e Teoria Musical',
    description:
      'Treine escalas no braço da viola caipira, estude intervalos e escalas duetadas. Ferramenta livre de teoria musical aplicada ao instrumento.',
    path: '/treinos',
  },
  ear: {
    title: 'Tirando de Ouvido — Sequenciador e Detector de Tom',
    description:
      'Monte a melodia nota a nota e descubra o tom da música. Ferramenta livre para tirar música de ouvido na viola caipira, violão e cavaquinho.',
    path: '/ouvido',
  },
  favorites: {
    title: 'Meus Favoritos',
    description: 'As cifras e as posições de acorde que você guardou no Viola Libre.',
    path: '/favoritos',
  },
  termos: {
    title: 'Termos de Uso',
    description: 'Condições de uso do Viola Libre e como solicitar remoção de conteúdo.',
    path: '/termos',
  },
  privacidade: {
    title: 'Política de Privacidade',
    description:
      'Que dados existem, o que fica no seu aparelho e o que o servidor recebe. Sem cadastro, sem anúncios e sem rastreador de audiência.',
    path: '/privacidade',
  },
  agradecimentos: {
    title: 'Agradecimentos',
    description: 'Quem ajudou a construir o Viola Libre e os projetos livres que o sustentam.',
    path: '/agradecimentos',
  },
  // Rascunho que vive no navegador de quem escreve: não existe no servidor, não tem
  // versão pública e não deve ser indexado. O robots.txt já bloqueia; o noindex cobre
  // o caso de a URL ser descoberta por um link de fora.
  minhascifras: {
    title: 'Minhas Cifras',
    description: 'Monte e edite o seu próprio roteiro de acordes, guardado no seu navegador.',
    path: '/minhascifras',
    noindex: true,
  },
};
