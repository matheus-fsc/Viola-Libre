/*
 * English dictionary.
 *
 * Shape is checked against `pt-BR.ts` by the `Dicionario` type: a missing or misspelled
 * key fails `tsc -b`, so the interface can never fall back to Portuguese without anyone
 * noticing.
 *
 * Vocabulary notes, so future strings stay consistent:
 * - "cifra" is the Brazilian chord-sheet format (lyrics with chords above them).
 *   It is translated as "chart" / "chord chart", never as "cipher" or "tab".
 * - "viola caipira" keeps its name: it is a specific ten-string Brazilian instrument
 *   with no English equivalent. The tunings (cebolão ré, rio abaixo) keep theirs too.
 * - "casa" on a fretboard is "fret"; "digitação" is "fingering"; "braço" is "neck".
 *
 * Writing rule: no em dashes, matching the Portuguese source.
 */
import type { Dicionario } from '../dicionario';

export const en: Dicionario = {
  comum: {
    fechar: 'Close',
    fecharJanela: 'Close Window',
    carregando: 'Loading...',
    buscando: 'Searching...',
    ok: 'OK',
    remover: 'Remove',
    excluir: 'Delete',
    carregar: 'Load',
    limparTodas: 'Clear All',
    voltar: 'Back',
    voltarAoMenu: 'Back to menu',
    aviso: 'Notice',
    nenhum: 'None',
    ordinal: '{n}.',
  },

  idioma: {
    titulo: 'Language',
    grupo: 'Site language',
    nota: 'Changes the interface text. The chord chart collection stays as it is.',
  },

  notacao: {
    titulo: 'Notation',
    grupo: 'Notation standard',
    nota: 'Only changes how the chord is spelled. The notes stay the same.',
  },

  abas: {
    desktop: 'Viola Libre',
    cifras: 'Explore Charts',
    minhascifras: 'My Charts',
    chords: 'Chord Dictionary',
    train: 'Practice and Theory',
    ear: 'Playing by Ear',
    favorites: 'My Favorites',
    preferencias: 'Preferences',
    termos: 'Terms of Use',
    privacidade: 'Privacy Policy',
    agradecimentos: 'Acknowledgements',
  },

  abasCurtas: {
    cifras: 'Charts',
    minhascifras: 'Mine',
    chords: 'Chords',
    train: 'Practice',
    ear: 'By Ear',
    favorites: 'Favorites',
    preferencias: 'Preferences',
    termos: 'Terms',
    privacidade: 'Privacy',
    agradecimentos: 'Thanks',
  },

  seo: {
    desktop: {
      title: 'Viola Libre',
      description:
        'Chord charts, a chord dictionary and music theory for viola caipira, guitar and cavaquinho. Change tuning and see the chords on the neck. Free, no ads.',
    },
    chords: {
      title: 'Chord Dictionary: Viola Caipira, Guitar and Cavaquinho',
      description:
        'Build any chord and see its shapes on the instrument neck. Inversions, slash chords and instant tuning changes (cebolão ré, cebolão mi, rio abaixo).',
    },
    train: {
      title: 'Music Practice and Theory',
      description:
        'Practice scales on the viola caipira neck, study intervals and duetted scales. A free music theory tool applied to the instrument.',
    },
    ear: {
      title: 'Playing by Ear: Sequencer and Key Detector',
      description:
        'Build the melody note by note and find the key of the song. A free tool for working songs out by ear on viola caipira, guitar and cavaquinho.',
    },
    favorites: {
      title: 'My Favorites',
      description: 'The chord charts and chord shapes you saved on Viola Libre.',
    },
    termos: {
      title: 'Terms of Use',
      description: 'Conditions for using Viola Libre and how to request content removal.',
    },
    privacidade: {
      title: 'Privacy Policy',
      description:
        'What data exists, what stays on your device and what the server receives. No sign-up, no ads and no analytics tracker.',
    },
    agradecimentos: {
      title: 'Acknowledgements',
      description: 'Who helped build Viola Libre and the free software projects behind it.',
    },
    minhascifras: {
      title: 'My Charts',
      description: 'Build and edit your own chord sheet, kept in your own browser.',
    },
    preferencias: {
      title: 'Preferences',
      description: 'Instrument, language, chart display and third-party service permissions. All of it kept in this browser only.',
    },
  },

  app: {
    pularConteudo: 'Skip to content',
    navSecoes: 'Site sections',
    tituloJanela: 'Viola Libre v1.1',
    abrirFavoritos: 'Open Favorites',
    sobre: 'About',
    sobreViolaLibre: 'About Viola Libre',
    minimizarAria: 'Minimize {secao} to the desktop',
    minimizarDica: 'Minimize (stays on the taskbar)',
    fecharAria: 'Close and go back to the start',
    fecharDica: 'Close (back to the start)',
  },

  filtros: {
    titulo: 'Search Filters',
    casaMinima: 'Lowest starting fret:',
    casaMinimaAtiva: 'fret {casa} or higher',
    todasAsCasas: 'All frets (open strings included)',
    casaOuAcima: 'Fret {casa} or higher',
    casaMedia: 'Fret 5 or higher (middle shapes)',
    casaAguda: 'Fret 7 or higher (high register)',
    dificuldade: 'Difficulty and muting:',
    mostrarTodas: 'Show every shape (penalty applied)',
    ocultarDificeis: 'Hide hard shapes (inner muted strings)',
    notaAbafamento: 'Chords with muted strings in the middle are penalized and ranked as harder to play.',
  },

  resultados: {
    cabecalho: 'Instrument: {instrumento} | Tuning: {afinacao}',
    acordeAtual: 'Chord shape: {acorde}',
    semTomTitulo: 'No Root Selected',
    semTomTexto: '<- Pick a root note in the left sidebar to see the chords and their shapes on the neck.',
    incompativelTitulo: 'Shape Not Playable',
    incompativelTexto: 'No anatomically playable shape was found for the chord {acorde} in the current tuning.',
    incompativelDica: 'Try another tuning, or pick a different chord type.',
    semResultadoTitulo: 'No Results (Filter Active)',
    semResultadoTexto: 'No shape for the chord {acorde} matches the selected search filters.',
    semResultadoDica: 'Try lowering the "Lowest starting fret" or changing the muting filter.',
    carregarMais: 'Load More ({quantidade} shapes hidden)',
  },

  favoritas: {
    titulo: 'My Favorite Shapes ({quantidade})',
    vazio: 'No favorite shapes yet. Click the star icon on any diagram above to keep the fingering here.',
    colunaAcorde: 'Chord',
    colunaInstrumento: 'Instrument',
    colunaAfinacao: 'Tuning',
    colunaDigitacao: 'Fingering (Strings)',
    colunaAcoes: 'Actions',
    carregarDica: 'Load into the Chord Finder',
  },

  minhaCifra: {
    titulo: 'My Chart (Chord Sheet for the Song)',
    descricao: 'Below are the chords picked for this song. You can see the diagrams, load them onto the neck or export the fingering.',
    vazio: 'No chords added to the chart yet. Go to the "Chord Dictionary" tab and click the notepad icon to save the shapes of the song here.',
    carregarNoBraco: 'Load onto the Neck',
    contador: 'Chords in the chart: {quantidade}',
    copiar: 'Copy Chart (Text)',
    copiarDica: 'Copy the chords as text',
    copiado: 'Chart copied to the clipboard:',
    limpar: 'Clear Chart',
  },

  sobre: {
    titulo: 'About Viola Libre',
    nome: 'Viola Libre v1.1',
    subtitulo: 'The Mathematical Chord Book of Traditional Music',
    licenca: 'License: GNU AGPL-3.0 (copyleft)',
    calculoForte: 'Unlike rigid systems',
    calculo: ', Viola Libre computes note positions from equations and semitone intervals.',
    afinacao: 'That is what lets you switch tuning instantly (cebolão ré, cebolão mi, rio abaixo) or change a single string and have everything recalculated on the spot.',
    proposito: 'The project is a tribute to the Brazilian caipira sound, and its goal is to give students and masters of the instrument free, minimal access, with no intrusive ads.',
    livreForte: 'Free software, and built to stay free.',
    livreTexto: 'The GNU AGPL-3.0 license grants anyone the right to use, study, modify and redistribute Viola Libre.',
    copyleft: 'In return it asks one thing: whoever publishes a modified version has to publish the source along with it, under the same license, including anyone who merely puts it online as a website without handing out a single file. That clause is what stops a closed platform from taking this work, locking it up and charging for it.',
    irParaPreferencias: 'Open Preferences (language, instrument, display)',
    linkLicenca: 'GNU AGPL-3.0',
    codigoFonte: 'Source code',
    javascript: 'JavaScript on this site',
  },

  barraTarefas: {
    expandir: 'Expand taskbar',
    recolher: 'Collapse taskbar',
    areaDeTrabalho: 'Desktop',
    mostrarAreaDeTrabalho: 'Show the desktop',
    restaurarJanela: 'Restore window',
    restaurarSecao: 'Restore {secao}',
    favoritosContador: 'Favorites ({quantidade})',
    minhaCifraContador: 'My Chart ({quantidade})',
    editor: '🔑 Editor',
    editorDica: 'Editor access',
    horaDica: 'System local time',
  },

  wip: {
    tituloAba: 'This tab is under construction.',
    tituloTiming: 'The timing editor is under construction.',
    textoEar: 'The "Playing by Ear" feature is still being built and does not do much yet. We are working to bring something good here soon.',
    textoMinhasCifras: 'The "My Charts" feature is still being built and does not do much yet. We are working to bring something good here soon.',
    textoTiming: 'The timing editor is still being built and does not do much yet. We are working to bring something good here soon.',
  },

  explorador: {
    h1: 'Chord charts for viola caipira, guitar and cavaquinho',
    titulo: 'Chart Explorer',
    seoTitle: 'Chord Charts: Browse by Artist and Song',
    seoDescription: 'A free collection of chord charts for viola caipira, guitar and cavaquinho. Search by artist or song and see the chords drawn on the instrument neck.',
    modoArtistas: 'Artists',
    modoMusicas: 'Songs (Search)',
    modoPopulares: 'Popular',
    modoGeneros: 'Genres',
    rankingViews: '+ Views',
    rankingLikes: '+ Likes',
    buscarArtistaAria: 'Search by artist name',
    buscarMusicaAria: 'Search by song name',
    buscarArtistaPlaceholder: 'Search by artist name...',
    buscarMusicaPlaceholder: 'Search by song name (2 letters minimum)...',
    erroDeRede: 'The search could not run just now. Check the connection and try again.',
    tentarDeNovo: 'Try again',
    carregandoArtistas: 'Loading artists...',
    carregandoMaisArtistas: 'Loading more artists...',
    carregandoMaisMusicas: 'Loading more songs...',
    carregandoMais: 'Loading more...',
    buscandoMusicas: 'Searching songs...',
    carregandoRanking: 'Loading the ranking...',
    carregandoGeneros: 'Loading genres...',
    carregandoArtistasDe: 'Loading {genero} artists...',
    digiteDoisCaracteres: 'Type at least 2 characters to search songs across the whole collection.',
    nenhumArtista: 'No artist found for "{termo}"',
    nenhumaMusica: 'No song found containing "{termo}"',
    nenhumaNoRanking: 'No song found in the ranking.',
    nenhumGenero: 'No genre catalogued at the moment.',
    top50Views: 'Top 50 Most Viewed',
    top50Likes: 'Top 50 Most Liked',
    topArtistas: 'Top Artists: {genero}',
  },

  lista: {
    anterior: 'Previous',
    proxima: 'Next',
    musicaAnterior: 'Previous song in the list',
    musicaProxima: 'Next song in the list',
    anteriorTitulo: 'Previous: {titulo}',
    proximaTitulo: 'Next: {titulo}',
    voltarPara: 'Back to {nome}',
    navegacaoAria: 'Navigation for the list {nome}',
    posicaoAria: '{nome} · {posicao} of {total}',
    musicasDe: 'Songs by {artista}',
    explorar: 'Browse',
    explorarDica: 'Browse the whole collection',
    voltarDica: 'Back to the previous page',
    carregandoMusicas: 'Loading songs...',
    buscarMusicaAria: 'Search this artist\u2019s songs',
    buscarMusicaPlaceholder: 'Search this artist\u2019s songs...',
    ordemAlfabetica: 'Alphabetical',
    maisVisualizadas: 'Most viewed',
    maisCurtidas: 'Most liked',
    estatisticasIlustrativas: 'Illustrative statistics: a real per-artist ranking does not exist on the server yet',
    top20: 'Top 20 most popular',
  },

  preferencias: {
    titulo: 'Preferences',
    intro: 'Everything this site knows about you is on this page, and it stays in this browser. There is no sign-up, no account, and none of it travels to the server. Clearing the site data resets every choice below.',
    instrumentoTitulo: 'Instrument',
    instrumentoNota: 'The instrument the site opens with. Changing it here applies from now on; inside each screen you can still try another one without changing this choice.',
    idiomaTitulo: 'Language',
    exibicaoTitulo: 'Chart display',
    notacaoTitulo: 'Chord notation',
    cordasTitulo: 'String order',
    cordasPadrao: 'Standard',
    cordasPadraoNota: 'Lowest string on top',
    cordasInvertida: 'Inverted',
    cordasInvertidaNota: 'Highest string on top',
    cordasNota: 'How the instrument neck is drawn in the diagrams. It applies to all of them at once.',
    terceirosTitulo: 'Third-party services',
    terceirosNota: 'This site loads no third-party code on its own initiative. When a feature depends on software that is not free, it stays off until you turn it on, and the switch remains yours afterwards.',
    voltar: '← Back',
    voltarDica: 'Back to the desktop',
  },

  youtube: {
    gateForte: 'Non-free JavaScript.',
    gateCurto: 'The YouTube player depends on a third-party script.',
    gateLongo: 'The YouTube player depends on a third-party script. It is not loaded without your consent, and the rest of the site works normally without it.',
    gateBotao: 'Load the YouTube player',
    gateLembrada: 'The choice is remembered in this browser.',
    gateMudar: 'Change it in Preferences',
    chaveAria: 'Authorize the non-free YouTube JavaScript',
    chaveSim: 'YES',
    chaveNao: 'NO',
    estadoAutorizado: 'YouTube JavaScript: authorized',
    estadoBloqueado: 'YouTube JavaScript: blocked',
    legendaNaoPerguntado: 'Nobody has asked yet, and nothing has been loaded. The switch turns on the first time you ask for a video, or right here, right now.',
    legendaSim: 'The player may load. Turning it off applies from the next video on; reload the page to drop the already downloaded script from memory.',
    legendaNao: 'The YouTube script is not loaded, and the site loses nothing but the player: auto-scroll infers timing from the BPM of the chart.',
  },

  desktop: {
    explorarCifras: 'Explore Charts',
    buscarTitulo: 'Search charts',
    buscarDica: 'Search',
    abaArtistas: 'Artists',
    abaMusicas: 'Songs',
    placeholderArtista: 'Artist name...',
    placeholderMusica: 'Song name...',
    ariaBuscarArtista: 'Search for an artist',
    ariaBuscarMusica: 'Search for a song',
    emAltaTitulo: 'Trending',
    maisVistas: 'Most viewed',
    maisCurtidas: 'Most liked',
  },
};
