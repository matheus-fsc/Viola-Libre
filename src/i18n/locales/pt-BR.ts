/*
 * Dicionário de referência: pt-BR.
 *
 * Este arquivo é a FONTE DA VERDADE do formato. O tipo `Dicionario` nasce dele, então
 * toda chave nova aparece aqui primeiro e o TypeScript passa a cobrar a tradução
 * correspondente em `en.ts`. Não existe fallback silencioso: um idioma incompleto é
 * erro de compilação, não um buraco que só aparece na tela de quem usa.
 *
 * Regra de escrita: SEM travessão. O texto de interface é lido em telas estreitas e
 * por leitor de tela, onde o travessão vira pausa longa sem função. Quando um texto
 * antigo tinha travessão, ele foi reescrito com vírgula, dois-pontos ou ponto final.
 *
 * Interpolação: `{nome}` é substituído pelas variáveis passadas ao `t()`.
 */
export const ptBR = {
  comum: {
    fechar: 'Fechar',
    fecharJanela: 'Fechar Janela',
    carregando: 'Carregando...',
    buscando: 'Buscando...',
    ok: 'OK',
    remover: 'Remover',
    excluir: 'Excluir',
    carregar: 'Carregar',
    limparTodas: 'Limpar Todas',
    voltar: 'Voltar',
    voltarAoMenu: 'Voltar ao menu',
    aviso: 'Aviso',
    nenhum: 'Nenhum',
    ordinal: '{n}º',
  },

  idioma: {
    titulo: 'Idioma',
    grupo: 'Idioma do site',
    nota: 'Muda os textos da interface. O acervo de cifras continua como está.',
  },

  notacao: {
    titulo: 'Notação',
    grupo: 'Padrão de notação',
    nota: 'Muda só como o acorde é escrito. As notas continuam as mesmas.',
  },

  /** Nome de cada seção por extenso, para a app bar do celular e para os rótulos longos. */
  abas: {
    desktop: 'Viola Libre',
    cifras: 'Explore Cifras',
    minhascifras: 'Minhas Cifras',
    chords: 'Dicionário de Acordes',
    train: 'Treinos e Teoria',
    ear: 'Tirando de Ouvido',
    favorites: 'Meus Favoritos',
    preferencias: 'Preferências',
    termos: 'Termos de Uso',
    privacidade: 'Política de Privacidade',
    agradecimentos: 'Agradecimentos',
  },

  /** Abreviação da faixa de abas e dos tiles do celular, onde falta largura. */
  abasCurtas: {
    cifras: 'Cifras',
    minhascifras: 'Minhas',
    chords: 'Acordes',
    train: 'Treinos',
    ear: 'Ouvido',
    favorites: 'Favoritos',
    preferencias: 'Preferências',
    termos: 'Termos',
    privacidade: 'Privacidade',
    agradecimentos: 'Agradecimentos',
  },

  /*
   * Metadados de busca. Escritos para o buscador, não para a UI: o rótulo da aba diz
   * "Treinos e Teoria" porque é o que cabe na aba, mas ninguém digita isso no Google.
   * As descrições ficam na faixa de 120 a 160 caracteres, que é o que o Google mostra.
   */
  seo: {
    desktop: {
      title: 'Viola Libre',
      description:
        'Cifras, dicionário de acordes e teoria musical para viola caipira, violão e cavaquinho. Troque de afinação e veja os acordes no braço. Livre, sem anúncios.',
    },
    chords: {
      title: 'Dicionário de Acordes: Viola Caipira, Violão e Cavaquinho',
      description:
        'Monte qualquer acorde e veja as posições no braço do instrumento. Inversões, acordes com baixo invertido e troca de afinação (cebolão ré, cebolão mi, rio abaixo).',
    },
    train: {
      title: 'Treinos e Teoria Musical',
      description:
        'Treine escalas no braço da viola caipira, estude intervalos e escalas duetadas. Ferramenta livre de teoria musical aplicada ao instrumento.',
    },
    ear: {
      title: 'Tirando de Ouvido: Sequenciador e Detector de Tom',
      description:
        'Monte a melodia nota a nota e descubra o tom da música. Ferramenta livre para tirar música de ouvido na viola caipira, violão e cavaquinho.',
    },
    favorites: {
      title: 'Meus Favoritos',
      description: 'As cifras e as posições de acorde que você guardou no Viola Libre.',
    },
    termos: {
      title: 'Termos de Uso',
      description: 'Condições de uso do Viola Libre e como solicitar remoção de conteúdo.',
    },
    privacidade: {
      title: 'Política de Privacidade',
      description:
        'Que dados existem, o que fica no seu aparelho e o que o servidor recebe. Sem cadastro, sem anúncios e sem rastreador de audiência.',
    },
    agradecimentos: {
      title: 'Agradecimentos',
      description: 'Quem ajudou a construir o Viola Libre e os projetos livres que o sustentam.',
    },
    minhascifras: {
      title: 'Minhas Cifras',
      description: 'Monte e edite o seu próprio roteiro de acordes, guardado no seu navegador.',
    },
    preferencias: {
      title: 'Preferências',
      description: 'Instrumento, idioma, exibição das cifras e autorização de serviços de terceiros. Tudo guardado só neste navegador.',
    },
  },

  app: {
    pularConteudo: 'Pular para o conteúdo',
    navSecoes: 'Seções do site',
    tituloJanela: 'Viola Libre v1.1',
    abrirFavoritos: 'Abrir Favoritos',
    sobre: 'Sobre',
    sobreViolaLibre: 'Sobre o Viola Libre',
    minimizarAria: 'Minimizar {secao} para a área de trabalho',
    minimizarDica: 'Minimizar (fica na barra de tarefas)',
    fecharAria: 'Fechar e voltar ao início',
    fecharDica: 'Fechar (voltar ao início)',
  },

  filtros: {
    titulo: 'Filtros de Busca',
    casaMinima: 'Casa inicial mínima:',
    casaMinimaAtiva: '≥ {casa}ª casa',
    todasAsCasas: 'Todas as casas (Canto/Nut)',
    casaOuAcima: '{casa}ª Casa ou acima',
    casaMedia: '5ª Casa ou acima (Posições médias)',
    casaAguda: '7ª Casa ou acima (Agudos)',
    dificuldade: 'Dificuldade e Abafamento:',
    mostrarTodas: 'Mostrar todas as posições (com penalidade)',
    ocultarDificeis: 'Ocultar posições difíceis (abafamento interno)',
    notaAbafamento: 'Acordes com cordas abafadas no meio são penalizados e classificados como mais difíceis.',
  },

  resultados: {
    cabecalho: 'Instrumento: {instrumento} | Afinação: {afinacao}',
    acordeAtual: 'Cordelete de Acorde: {acorde}',
    semTomTitulo: 'Nenhum Tom Selecionado',
    semTomTexto: '<- Escolha um tom na barra lateral esquerda para exibir os acordes e as formas no braço.',
    incompativelTitulo: 'Forma Incompatível',
    incompativelTexto: 'Nenhuma posição anatômica válida foi encontrada para o acorde {acorde} com a afinação atual.',
    incompativelDica: 'Tente alterar a afinação ou escolha outro tipo de acorde.',
    semResultadoTitulo: 'Sem Resultados (Filtro Ativo)',
    semResultadoTexto: 'Nenhuma posição para o acorde {acorde} corresponde aos filtros de busca selecionados.',
    semResultadoDica: 'Tente diminuir a "Casa Mínima" ou alterar o filtro de "Abafamento Interno".',
    carregarMais: 'Carregar Mais ({quantidade} posições ocultas)',
  },

  favoritas: {
    titulo: 'Minhas Posições Favoritadas ({quantidade})',
    vazio: 'Nenhuma posição favoritada. Clique no ícone da estrela em qualquer diagrama acima para guardar a digitação aqui.',
    colunaAcorde: 'Acorde',
    colunaInstrumento: 'Instrumento',
    colunaAfinacao: 'Afinação',
    colunaDigitacao: 'Digitação (Cordas)',
    colunaAcoes: 'Ações',
    carregarDica: 'Carregar no Localizador de Acordes',
  },

  minhaCifra: {
    titulo: 'Minha Cifra (Roteiro de Acordes da Música)',
    descricao: 'Abaixo estão os acordes selecionados para a cifra desta música. Você pode ver os diagramas, carregar no braço ou exportar a digitação.',
    vazio: 'Nenhum acorde adicionado à cifra. Vá na aba "Dicionário de Acordes" e clique no ícone do bloco de notas para salvar as posições da música aqui!',
    carregarNoBraco: 'Carregar no Braço',
    contador: 'Acordes na Cifra: {quantidade}',
    copiar: 'Copiar Cifragem (Texto)',
    copiarDica: 'Copiar acordes como texto',
    copiado: 'Cifragem copiada para a área de transferência:',
    limpar: 'Limpar Cifra',
  },

  sobre: {
    titulo: 'Sobre o Viola Libre',
    nome: 'Viola Libre v1.1',
    subtitulo: 'O Cifrário Matemático da Música Tradicional',
    licenca: 'Licença: GNU AGPL-3.0 (copyleft)',
    calculoForte: 'Diferente de sistemas engessados',
    calculo: ', o Viola Libre calcula as posições das notas baseando-se em equações e intervalos de semitons.',
    afinacao: 'Isso permite trocar de afinação instantaneamente (ex: Cebolão Ré, Cebolão Mi, Rio Abaixo) ou alterar a nota individual de qualquer corda e recalcular tudo instantaneamente.',
    proposito: 'O projeto homenageia a sonoridade caipira brasileira, e tem como objetivo dar acesso livre, sem anúncios intrusivos e de maneira minimalista a estudantes e mestres do instrumento.',
    livreForte: 'Software livre, e feito pra continuar livre.',
    livreTexto: 'A licença GNU AGPL-3.0 garante a qualquer pessoa o direito de usar, estudar, modificar e redistribuir o Viola Libre.',
    copyleft: 'Em troca, ela cobra uma coisa: quem publicar uma versão modificada tem que publicar o código junto, sob a mesma licença, inclusive quem só a colocar no ar como site, sem distribuir arquivo nenhum. É essa cláusula que impede uma plataforma fechada de pegar este trabalho, trancá-lo e cobrar por ele.',
    irParaPreferencias: 'Abrir as Preferências (idioma, instrumento, exibição)',
    linkLicenca: 'GNU AGPL-3.0',
    codigoFonte: 'Código-fonte',
    javascript: 'JavaScript deste site',
  },

  barraTarefas: {
    expandir: 'Expandir barra de tarefas',
    recolher: 'Recolher barra de tarefas',
    areaDeTrabalho: 'Área de Trabalho',
    mostrarAreaDeTrabalho: 'Mostrar área de trabalho',
    restaurarJanela: 'Restaurar janela',
    restaurarSecao: 'Restaurar {secao}',
    favoritosContador: 'Favoritos ({quantidade})',
    minhaCifraContador: 'Minha Cifra ({quantidade})',
    editor: '🔑 Editor',
    editorDica: 'Acesso de Editor',
    horaDica: 'Hora local do sistema',
  },

  wip: {
    tituloAba: 'Esta aba está em construção!',
    tituloTiming: 'O editor de timing está em construção!',
    textoEar: 'A funcionalidade de "Tirando de Ouvido" ainda está sendo desenvolvida e por enquanto não faz muito sentido. Estamos trabalhando para trazer algo legal aqui em breve.',
    textoMinhasCifras: 'A funcionalidade de "Minhas Cifras" ainda está sendo desenvolvida e por enquanto não faz muito sentido. Estamos trabalhando para trazer algo legal aqui em breve.',
    textoTiming: 'O editor de timing ainda está sendo desenvolvido e por enquanto não faz muito sentido. Estamos trabalhando para trazer algo legal aqui em breve.',
  },

  /*
   * Navegação do acervo: a barra de posição dentro de uma lista, a lista de músicas de um
   * artista e o destaque dos mais tocados.
   */
  /* O explorador de cifras: modos de busca, filtro por letra, gêneros e rankings. */
  explorador: {
    h1: 'Cifras para viola caipira, violão e cavaquinho',
    titulo: 'Explorador de Cifras',
    seoTitle: 'Cifras: Explore por Artista e Música',
    seoDescription: 'Acervo livre de cifras para viola caipira, violão e cavaquinho. Busque por artista ou música e veja os acordes desenhados no braço do instrumento.',
    modoArtistas: 'Artistas',
    modoMusicas: 'Músicas (Busca)',
    modoPopulares: 'Populares',
    modoGeneros: 'Gêneros',
    rankingViews: '+ Views',
    rankingLikes: '+ Likes',
    buscarArtistaAria: 'Buscar pelo nome do artista',
    buscarMusicaAria: 'Buscar pelo nome da música',
    buscarArtistaPlaceholder: 'Buscar pelo nome do artista...',
    buscarMusicaPlaceholder: 'Buscar nome da música (mín. 2 letras)...',
    erroDeRede: 'Não foi possível buscar agora. Verifique a conexão e tente de novo.',
    tentarDeNovo: 'Tentar de novo',
    carregandoArtistas: 'Carregando artistas...',
    carregandoMaisArtistas: 'Carregando mais artistas...',
    carregandoMaisMusicas: 'Carregando mais músicas...',
    carregandoMais: 'Carregando mais...',
    buscandoMusicas: 'Buscando músicas...',
    carregandoRanking: 'Carregando ranking...',
    carregandoGeneros: 'Carregando gêneros...',
    carregandoArtistasDe: 'Carregando artistas de {genero}...',
    digiteDoisCaracteres: 'Digite pelo menos 2 caracteres para buscar músicas em todo o banco.',
    nenhumArtista: 'Nenhum artista encontrado com "{termo}"',
    nenhumaMusica: 'Nenhuma música encontrada contendo "{termo}"',
    nenhumaNoRanking: 'Nenhuma música encontrada no ranking.',
    nenhumGenero: 'Nenhum gênero catalogado no momento.',
    top50Views: 'Top 50 Mais Visualizadas',
    top50Likes: 'Top 50 Mais Curtidas',
    topArtistas: 'Top Artistas: {genero}',
  },

  lista: {
    anterior: 'Anterior',
    proxima: 'Próxima',
    musicaAnterior: 'Música anterior da lista',
    musicaProxima: 'Próxima música da lista',
    anteriorTitulo: 'Anterior: {titulo}',
    proximaTitulo: 'Próxima: {titulo}',
    voltarPara: 'Voltar para {nome}',
    navegacaoAria: 'Navegação da lista {nome}',
    posicaoAria: '{nome} · {posicao} de {total}',
    musicasDe: 'Músicas de {artista}',
    explorar: 'Explorar',
    explorarDica: 'Explorar todo o acervo',
    voltarDica: 'Voltar para a página anterior',
    carregandoMusicas: 'Carregando músicas...',
    buscarMusicaAria: 'Buscar música deste artista',
    buscarMusicaPlaceholder: 'Buscar música deste artista...',
    ordemAlfabetica: 'Ordem alfabética',
    maisVisualizadas: 'Mais visualizadas',
    maisCurtidas: 'Mais curtidas',
    estatisticasIlustrativas: 'Estatísticas ilustrativas: o ranking oficial por artista ainda não existe no servidor',
    top20: 'Top 20 mais populares',
  },

  preferencias: {
    titulo: 'Preferências',
    intro: 'Tudo o que este site guarda sobre você fica nesta página, e fica só neste navegador. Não há cadastro, não há conta e nada disso viaja para o servidor. Limpar os dados do site zera todas as escolhas abaixo.',
    instrumentoTitulo: 'Instrumento',
    instrumentoNota: 'O instrumento com que o site abre. Trocar aqui vale a partir de agora; dentro de cada tela você continua podendo experimentar outro sem mudar esta escolha.',
    idiomaTitulo: 'Idioma',
    exibicaoTitulo: 'Exibição das cifras',
    notacaoTitulo: 'Notação dos acordes',
    cordasTitulo: 'Ordem das cordas',
    cordasPadrao: 'Padrão',
    cordasPadraoNota: 'Corda grave no topo',
    cordasInvertida: 'Invertida',
    cordasInvertidaNota: 'Corda aguda no topo',
    cordasNota: 'Como o braço do instrumento é desenhado nos diagramas. Vale para todos eles de uma vez.',
    terceirosTitulo: 'Serviços de terceiros',
    terceirosNota: 'Este site não carrega código de terceiros por conta própria. Quando um recurso depende de software que não é livre, ele fica desligado até você ligar, e a chave continua sua depois disso.',
    voltar: '← Voltar',
    voltarDica: 'Voltar à área de trabalho',
  },

  youtube: {
    gateForte: 'JavaScript não-livre.',
    gateCurto: 'O player do YouTube depende de um script de terceiros.',
    gateLongo: 'O player do YouTube depende de um script de terceiros. Ele não é carregado sem o seu consentimento, e o resto do site funciona normalmente sem ele.',
    gateBotao: 'Carregar o player do YouTube',
    gateLembrada: 'A escolha fica lembrada neste navegador.',
    gateMudar: 'Mudar nas Preferências',
    chaveAria: 'Autorizar o JavaScript não-livre do YouTube',
    chaveSim: 'SIM',
    chaveNao: 'NÃO',
    estadoAutorizado: 'JavaScript do YouTube: autorizado',
    estadoBloqueado: 'JavaScript do YouTube: bloqueado',
    legendaNaoPerguntado: 'Ninguém perguntou ainda, e nada foi carregado. A chave liga na primeira vez que você pedir um vídeo, ou aqui mesmo, agora.',
    legendaSim: 'O player pode carregar. Desligar vale a partir do próximo vídeo; recarregue a página para tirar da memória o script já baixado.',
    legendaNao: 'O script do YouTube não é carregado, e o site não perde nada além do player: a rolagem automática deduz o tempo pelo BPM da cifra.',
  },

  desktop: {
    explorarCifras: 'Explorar Cifras',
    buscarTitulo: 'Buscar cifras',
    buscarDica: 'Buscar',
    abaArtistas: 'Artistas',
    abaMusicas: 'Músicas',
    placeholderArtista: 'Nome do artista...',
    placeholderMusica: 'Nome da música...',
    ariaBuscarArtista: 'Buscar artista',
    ariaBuscarMusica: 'Buscar música',
    emAltaTitulo: 'Em alta',
    maisVistas: 'Mais vistas',
    maisCurtidas: 'Mais curtidas',
  },
} as const;
