import type { Instrument, ChordFormula, ScaleFormula } from './types';

export const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_NAMES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Default display names mapped to pitch classes
export const PITCH_CLASS_TO_DISPLAY: { [key: number]: { sharp: string, flat: string } } = {
  0: { sharp: "C", flat: "C" },
  1: { sharp: "C#", flat: "Db" },
  2: { sharp: "D", flat: "D" },
  3: { sharp: "D#", flat: "Eb" },
  4: { sharp: "E", flat: "E" },
  5: { sharp: "F", flat: "F" },
  6: { sharp: "F#", flat: "Gb" },
  7: { sharp: "G", flat: "G" },
  8: { sharp: "G#", flat: "Ab" },
  9: { sharp: "A", flat: "A" },
  10: { sharp: "A#", flat: "Bb" },
  11: { sharp: "B", flat: "B" }
};

export const PRESET_INSTRUMENTS: Instrument[] = [
  {
    id: "viola",
    name: "Viola Caipira",
    defaultTuningId: "cebolao-re",
    tunings: [
      {
        id: "cebolao-re",
        name: "Cebolão em Ré (A D F# A D)",
        strings: [45, 50, 54, 57, 62] // A2, D3, F#3, A3, D4
      },
      {
        id: "cebolao-mi",
        name: "Cebolão em Mi (B E G# B E)",
        strings: [47, 52, 56, 59, 64] // B2, E3, G#3, B3, E4
      },
      {
        id: "rio-abaixo",
        name: "Rio Abaixo (G D G B D)",
        strings: [43, 50, 55, 59, 62] // G2, D3, G3, B3, D4
      },
      {
        id: "rio-acima",
        name: "Rio Acima (C E G C E)",
        strings: [48, 52, 55, 60, 64] // C3, E3, G3, C4, E4
      },
      {
        id: "boiadeira",
        name: "Boiadeira (A E G# B E)",
        strings: [45, 52, 56, 59, 64] // A2, E3, G#3, B3, E4
      }
    ]
  },
  {
    id: "violao",
    name: "Violão",
    defaultTuningId: "violao-padrao",
    tunings: [
      {
        id: "violao-padrao",
        name: "Padrão (E A D G B E)",
        strings: [40, 45, 50, 55, 59, 64] // E2, A2, D3, G3, B3, E4
      },
      {
        id: "drop-d",
        name: "Drop D (D A D G B E)",
        strings: [38, 45, 50, 55, 59, 64] // D2, A2, D3, G3, B3, E4
      },
      {
        id: "dadgad",
        name: "DADGAD (D A D G A D)",
        strings: [38, 45, 50, 55, 57, 62]
      }
    ]
  },
  {
    id: "cavaquinho",
    name: "Cavaquinho",
    defaultTuningId: "cavaquinho-padrao",
    tunings: [
      {
        id: "cavaquinho-padrao",
        name: "Padrão (D G B D)",
        strings: [50, 55, 59, 62] // D3, G3, B3, D4
      },
      {
        id: "cavaquinho-mi",
        name: "Afinação em Mi (D G B E)",
        strings: [50, 55, 59, 64] // D3, G3, B3, E4
      }
    ]
  },
  {
    id: "ukulele",
    name: "Ukulele",
    defaultTuningId: "ukulele-padrao",
    tunings: [
      {
        id: "ukulele-padrao",
        name: "Padrão Reentrante (g C E A)",
        strings: [67, 60, 64, 69] // G4, C4, E4, A4
      }
    ]
  },
  {
    id: "bandolim",
    name: "Bandolim",
    defaultTuningId: "bandolim-padrao",
    tunings: [
      {
        id: "bandolim-padrao",
        name: "Padrão (G D A E)",
        strings: [55, 62, 69, 76] // G3, D4, A4, E5
      }
    ]
  },
  {
    id: "violino",
    name: "Violino",
    defaultTuningId: "violino-padrao",
    tunings: [
      {
        id: "violino-padrao",
        name: "Padrão (G D A E)",
        strings: [55, 62, 69, 76] // G3, D4, A4, E5
      }
    ]
  },
  {
    id: "violoncelo",
    name: "Violoncelo",
    defaultTuningId: "violoncelo-padrao",
    tunings: [
      {
        id: "violoncelo-padrao",
        name: "Padrão (C G D A)",
        strings: [36, 43, 50, 57] // C2, G2, D3, A3
      }
    ]
  },
  {
    id: "guitarra-portuguesa",
    name: "Guitarra Portuguesa",
    defaultTuningId: "gp-lisboa",
    tunings: [
      {
        id: "gp-lisboa",
        name: "Afinação de Lisboa (D A B E A B)",
        strings: [50, 57, 59, 64, 69, 71] // D3, A3, B3, E4, A4, B4
      },
      {
        id: "gp-coimbra",
        name: "Afinação de Coimbra (C G A D G E)",
        strings: [48, 55, 57, 62, 67, 64] // C3, G3, A3, D4, G4, E4
      }
    ]
  },
  {
    id: "violao-7",
    name: "Violão de 7 cordas",
    defaultTuningId: "v7-padrao",
    tunings: [
      {
        id: "v7-padrao",
        name: "Padrão com C (C E A D G B E)",
        strings: [36, 40, 45, 50, 55, 59, 64] // C2, E2, A2, D3, G3, B3, E4
      },
      {
        id: "v7-baixaria",
        name: "Baixaria com B (B E A D G B E)",
        strings: [35, 40, 45, 50, 55, 59, 64] // B1, E2, A2, D3, G3, B3, E4
      }
    ]
  },
  {
    id: "guitarra-baiana",
    name: "Guitarra Baiana",
    defaultTuningId: "gb-padrao",
    tunings: [
      {
        id: "gb-padrao",
        name: "Padrão (C G D A E)",
        strings: [48, 55, 62, 69, 76] // C3, G3, D4, A4, E5
      }
    ]
  },
  {
    id: "charango",
    name: "Charango",
    defaultTuningId: "charango-padrao",
    tunings: [
      {
        id: "charango-padrao",
        name: "Padrão (G C E A E)",
        strings: [67, 72, 76, 69, 76] // G4, C5, E5, A4, E5
      }
    ]
  },
  {
    id: "banjo-4",
    name: "Banjo (4 cordas)",
    defaultTuningId: "banjo4-padrao",
    tunings: [
      {
        id: "banjo4-padrao",
        name: "Padrão (D G B D)",
        strings: [50, 55, 59, 62] // D3, G3, B3, D4
      },
      {
        id: "banjo4-tenor",
        name: "Tenor (C G D A)",
        strings: [48, 55, 62, 69] // C3, G3, D4, A4
      }
    ]
  },
  {
    id: "banjo",
    name: "Banjo (5 cordas)",
    defaultTuningId: "banjo-padrao",
    tunings: [
      {
        id: "banjo-padrao",
        name: "Open G (g D G B D)",
        strings: [67, 50, 55, 59, 62] // G4, D3, G3, B3, D4
      },
      {
        id: "banjo-tenor",
        name: "Tenor Padrão (C G D A)",
        strings: [48, 55, 62, 69] // C3, G3, D4, A4
      }
    ]
  },
  {
    id: "contrabaixo",
    name: "Contrabaixo",
    defaultTuningId: "baixo-padrao",
    tunings: [
      {
        id: "baixo-padrao",
        name: "Padrão 4 cordas (E A D G)",
        strings: [28, 33, 38, 43] // E1, A1, D2, G2
      },
      {
        id: "baixo-5",
        name: "Padrão 5 cordas (B E A D G)",
        strings: [23, 28, 33, 38, 43] // B0, E1, A1, D2, G2
      }
    ]
  }
];

export const CHORD_FORMULAS: ChordFormula[] = [
  {
    name: "Maior",
    suffix: "",
    intervals: [0, 4, 7],
    requiredIntervals: [0, 4]
  },
  {
    name: "Menor",
    suffix: "m",
    intervals: [0, 3, 7],
    requiredIntervals: [0, 3]
  },
  {
    name: "Maior com Sétima (Dominante)",
    suffix: "7",
    intervals: [0, 4, 7, 10],
    requiredIntervals: [0, 4, 10]
  },
  {
    name: "Maior com Sétima Maior",
    suffix: "Maj7",
    intervals: [0, 4, 7, 11],
    requiredIntervals: [0, 4, 11]
  },
  {
    name: "Menor com Sétima",
    suffix: "m7",
    intervals: [0, 3, 7, 10],
    requiredIntervals: [0, 3, 10]
  },
  {
    name: "Meio Diminuto (Menor 7 com Quinta Bemol)",
    suffix: "m7(b5)",
    intervals: [0, 3, 6, 10],
    requiredIntervals: [0, 3, 6, 10] // Para samba/MPB, todos os 4 graus são fundamentais
  },
  {
    name: "Dominante com Quinta Bemol",
    suffix: "7(b5)",
    intervals: [0, 4, 6, 10],
    requiredIntervals: [0, 4, 6, 10] // flat 5 é crítico
  },
  {
    name: "Diminuto",
    suffix: "dim",
    intervals: [0, 3, 6],
    requiredIntervals: [0, 3, 6]
  },
  {
    name: "Diminuto com Sétima",
    suffix: "dim7",
    intervals: [0, 3, 6, 9],
    requiredIntervals: [0, 3, 6, 9]
  },
  {
    name: "Aumentado",
    suffix: "aug",
    intervals: [0, 4, 8],
    requiredIntervals: [0, 4, 8]
  },
  {
    name: "Menor Aumentado",
    suffix: "m(#5)",
    intervals: [0, 3, 8],
    requiredIntervals: [0, 3, 8]
  },
  {
    name: "Suspenso 4",
    suffix: "sus4",
    intervals: [0, 5, 7],
    requiredIntervals: [0, 5]
  },
  {
    name: "Suspenso 2",
    suffix: "sus2",
    intervals: [0, 2, 7],
    requiredIntervals: [0, 2]
  },
  {
    name: "Sexta",
    suffix: "6",
    intervals: [0, 4, 7, 9],
    requiredIntervals: [0, 4, 9]
  },
  {
    name: "Menor com Sexta",
    suffix: "m6",
    intervals: [0, 3, 7, 9],
    requiredIntervals: [0, 3, 9]
  },
  {
    name: "Menor com Sexta Menor",
    suffix: "m6-",
    intervals: [0, 3, 7, 8],
    requiredIntervals: [0, 3, 8]
  },
  {
    name: "Nona",
    suffix: "7(9)",
    intervals: [0, 4, 7, 10, 14],
    requiredIntervals: [0, 4, 10, 14] // 5th can be omitted
  },
  {
    name: "Menor com Nona",
    suffix: "m7(9)",
    intervals: [0, 3, 7, 10, 14],
    requiredIntervals: [0, 3, 10, 14]
  },
  {
    name: "Sétima com Nona Bemol",
    suffix: "7(b9)",
    intervals: [0, 4, 7, 10, 13],
    requiredIntervals: [0, 4, 10, 13]
  },
  {
    name: "Sétima com Nona Aumentada",
    suffix: "7(#9)",
    intervals: [0, 4, 7, 10, 15],
    requiredIntervals: [0, 4, 10, 15]
  },
  {
    name: "Nona Adicionada",
    suffix: "add9",
    intervals: [0, 4, 7, 14],
    requiredIntervals: [0, 4, 14]
  },
  {
    name: "Menor com Nona Adicionada",
    suffix: "m(add9)",
    intervals: [0, 3, 7, 14],
    requiredIntervals: [0, 3, 14]
  },
  {
    name: "Sétima Maior e Nona",
    suffix: "Maj7(9)",
    intervals: [0, 4, 7, 11, 14],
    requiredIntervals: [0, 4, 11, 14]
  },
  {
    name: "Menor com Sétima Maior",
    suffix: "m(Maj7)",
    intervals: [0, 3, 7, 11],
    requiredIntervals: [0, 3, 11]
  },
  {
    name: "Menor com Sétima Maior e Nona",
    suffix: "m(Maj7)(9)",
    intervals: [0, 3, 7, 11, 14],
    requiredIntervals: [0, 3, 11, 14]
  },
  {
    name: "Suspenso 4 com Sétima",
    suffix: "7sus4",
    intervals: [0, 5, 7, 10],
    requiredIntervals: [0, 5, 10]
  },
  {
    name: "Aumentado com Sétima",
    suffix: "7(#5)",
    intervals: [0, 4, 8, 10],
    requiredIntervals: [0, 4, 8, 10]
  },
  {
    name: "Menor com Sétima, Quinta Bemol e Nona",
    suffix: "m7(b5)(9)",
    intervals: [0, 3, 6, 10, 14],
    requiredIntervals: [0, 3, 6, 10, 14]
  },
  {
    name: "Sétima com Quinta Bemol e Nona",
    suffix: "7(b5)(9)",
    intervals: [0, 4, 6, 10, 14],
    requiredIntervals: [0, 4, 6, 10, 14]
  },
  {
    name: "Nona com Quarta Aumentada",
    suffix: "9(4+)",
    intervals: [0, 4, 6, 7, 10, 14],
    requiredIntervals: [0, 4, 6, 10, 14]
  },
  {
    name: "Sétima com Quarta Aumentada",
    suffix: "7(4+)",
    intervals: [0, 4, 6, 7, 10],
    requiredIntervals: [0, 4, 6, 10]
  },
  {
    name: "Sexta com Nona",
    suffix: "6(9)",
    intervals: [0, 4, 7, 9, 14],
    requiredIntervals: [0, 4, 9, 14]
  },
  {
    name: "Menor com Sexta e Nona",
    suffix: "m6(9)",
    intervals: [0, 3, 7, 9, 14],
    requiredIntervals: [0, 3, 9, 14]
  },
  {
    name: "Sexta com Nona Bemol",
    suffix: "6(9-)",
    intervals: [0, 4, 7, 9, 13],
    requiredIntervals: [0, 4, 9, 13]
  },
  {
    name: "Menor com Sétima e Décima Primeira",
    suffix: "m7(11)",
    intervals: [0, 3, 7, 10, 17],
    requiredIntervals: [0, 3, 10, 17]
  },
  {
    name: "Sétima com Décima Primeira",
    suffix: "7(11)",
    intervals: [0, 4, 7, 10, 17],
    requiredIntervals: [0, 4, 10, 17]
  },
  {
    name: "Sétima Maior com Décima Primeira Aumentada",
    suffix: "Maj7(#11)",
    intervals: [0, 4, 7, 11, 18],
    requiredIntervals: [0, 4, 11, 18]
  },
  {
    name: "Power Chord (Quinta)",
    suffix: "5",
    intervals: [0, 7],
    requiredIntervals: [0, 7]
  },
  {
    name: "Sétima Maior",
    suffix: "7M",
    intervals: [0, 4, 7, 11],
    requiredIntervals: [0, 4, 11]
  },
  {
    name: "Power Chord com Sétima Maior",
    suffix: "5(7M)",
    intervals: [0, 7, 11],
    requiredIntervals: [0, 7, 11]
  },
  {
    name: "Suspenso 4",
    suffix: "4",
    intervals: [0, 5, 7],
    requiredIntervals: [0, 5]
  },
  {
    name: "Suspenso",
    suffix: "sus",
    intervals: [0, 5, 7],
    requiredIntervals: [0, 5]
  },
  {
    name: "Nona",
    suffix: "9",
    intervals: [0, 4, 7, 10, 14],
    requiredIntervals: [0, 4, 10, 14]
  },
  {
    name: "Sétima Maior com Nona",
    suffix: "7M(9)",
    intervals: [0, 4, 7, 11, 14],
    requiredIntervals: [0, 4, 11, 14]
  },
  {
    name: "Sétima Maior com Nona",
    suffix: "Maj9",
    intervals: [0, 4, 7, 11, 14],
    requiredIntervals: [0, 4, 11, 14]
  },
  {
    name: "Menor com Nona",
    suffix: "m9",
    intervals: [0, 3, 7, 10, 14],
    requiredIntervals: [0, 3, 10, 14]
  },
  {
    name: "Décima Primeira",
    suffix: "11",
    intervals: [0, 4, 7, 10, 14, 17],
    requiredIntervals: [0, 4, 10, 17]
  },
  {
    name: "Menor com Décima Primeira",
    suffix: "m11",
    intervals: [0, 3, 7, 10, 14, 17],
    requiredIntervals: [0, 3, 10, 17]
  },
  {
    name: "Décima Terceira",
    suffix: "13",
    intervals: [0, 4, 7, 10, 14, 21],
    requiredIntervals: [0, 4, 10, 21]
  },
  {
    name: "Menor com Décima Terceira",
    suffix: "m13",
    intervals: [0, 3, 7, 10, 14, 21],
    requiredIntervals: [0, 3, 10, 21]
  },
  {
    name: "Sétima com Quarta",
    suffix: "7(4)",
    intervals: [0, 5, 7, 10],
    requiredIntervals: [0, 5, 10]
  },
  {
    name: "Sétima com Quarta e Nona",
    suffix: "7(4/9)",
    intervals: [0, 5, 7, 10, 14],
    requiredIntervals: [0, 5, 10, 14]
  },
  {
    name: "Menor com Sétima e Quarta",
    suffix: "m7(4)",
    intervals: [0, 3, 7, 10, 17],
    requiredIntervals: [0, 3, 10, 17]
  },
  {
    name: "Sétima com Décima Terceira",
    suffix: "7(13)",
    intervals: [0, 4, 7, 10, 21],
    requiredIntervals: [0, 4, 10, 21]
  },
  {
    name: "Nona Adicionada",
    suffix: "(add9)",
    intervals: [0, 4, 7, 14],
    requiredIntervals: [0, 4, 14]
  },
  {
    name: "Menor com Nona Adicionada",
    suffix: "madd9",
    intervals: [0, 3, 7, 14],
    requiredIntervals: [0, 3, 14]
  },
  {
    name: "Diminuto",
    suffix: "°",
    intervals: [0, 3, 6],
    requiredIntervals: [0, 3, 6]
  },
  {
    name: "Diminuto com Sétima",
    suffix: "°7",
    intervals: [0, 3, 6, 9],
    requiredIntervals: [0, 3, 6, 9]
  },
  {
    name: "Meio Diminuto (Menor 7 com Quinta Bemol)",
    suffix: "m7(5-)",
    intervals: [0, 3, 6, 10],
    requiredIntervals: [0, 3, 6, 10]
  },
  {
    name: "Dominante com Quinta Bemol",
    suffix: "7(5-)",
    intervals: [0, 4, 6, 10],
    requiredIntervals: [0, 4, 6, 10]
  },
  {
    name: "Sétima com Nona Bemol",
    suffix: "7(9-)",
    intervals: [0, 4, 7, 10, 13],
    requiredIntervals: [0, 4, 10, 13]
  },
  {
    name: "Sétima com Nona Aumentada",
    suffix: "7(9+)",
    intervals: [0, 4, 7, 10, 15],
    requiredIntervals: [0, 4, 10, 15]
  },
  {
    name: "Aumentado com Sétima",
    suffix: "7(5+)",
    intervals: [0, 4, 8, 10],
    requiredIntervals: [0, 4, 8, 10]
  },
  {
    name: "Sétima com Nona (Formato de Barra)",
    suffix: "7/9",
    intervals: [0, 4, 7, 10, 14],
    requiredIntervals: [0, 4, 10, 14]
  },
  {
    name: "Menor com Sétima e Nona (Formato de Barra)",
    suffix: "m7/9",
    intervals: [0, 3, 7, 10, 14],
    requiredIntervals: [0, 3, 10, 14]
  },
  {
    name: "Sétima com Nona Bemol (Formato de Barra)",
    suffix: "7/9-",
    intervals: [0, 4, 7, 10, 13],
    requiredIntervals: [0, 4, 10, 13]
  },
  {
    name: "Sétima com Nona Aumentada (Formato de Barra)",
    suffix: "7/9+",
    intervals: [0, 4, 7, 10, 15],
    requiredIntervals: [0, 4, 10, 15]
  },
  {
    name: "Segunda Adicionada",
    suffix: "2",
    intervals: [0, 4, 7, 14],
    requiredIntervals: [0, 4, 14]
  },
  {
    name: "Menor com Segunda Adicionada",
    suffix: "m2",
    intervals: [0, 3, 7, 14],
    requiredIntervals: [0, 3, 14]
  },
  {
    name: "Segunda Aumentada Adicionada",
    suffix: "2+",
    intervals: [0, 4, 7, 15],
    requiredIntervals: [0, 4, 15]
  },
  {
    name: "Menor com Segunda Aumentada Adicionada",
    suffix: "m2+",
    intervals: [0, 3, 7, 15],
    requiredIntervals: [0, 3, 15]
  },
  {
    name: "Sétima com Décima Terceira Bemol",
    suffix: "7(13-)",
    intervals: [0, 4, 7, 10, 20],
    requiredIntervals: [0, 4, 10, 20]
  },
  {
    name: "Menor com Sétima e Décima Primeira Aumentada",
    suffix: "m7(11+)",
    intervals: [0, 3, 7, 10, 18],
    requiredIntervals: [0, 3, 10, 18]
  },
  {
    name: "Sétima com Nona e Décima Primeira",
    suffix: "7(9/11)",
    intervals: [0, 4, 7, 10, 14, 17],
    requiredIntervals: [0, 4, 10, 14, 17]
  }
];

export const SCALE_FORMULAS: ScaleFormula[] = [
  {
    name: "Maior (Jônio)",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ["I", "II", "III", "IV", "V", "VI", "VII"]
  },
  {
    name: "Menor Natural (Eólio)",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ["I", "II", "bIII", "IV", "V", "bVI", "bVII"]
  },
  {
    name: "Menor Harmônica",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    degrees: ["I", "II", "bIII", "IV", "V", "bVI", "VII"]
  },
  {
    name: "Menor Melódica",
    intervals: [0, 2, 3, 5, 7, 9, 11],
    degrees: ["I", "II", "bIII", "IV", "V", "VI", "VII"]
  },
  {
    name: "Pentatônica Maior",
    intervals: [0, 2, 4, 7, 9],
    degrees: ["I", "II", "III", "V", "VI"]
  },
  {
    name: "Pentatônica Menor",
    intervals: [0, 3, 5, 7, 10],
    degrees: ["I", "bIII", "IV", "V", "bVII"]
  },
  {
    name: "Escala de Blues (Blues)",
    intervals: [0, 3, 5, 6, 7, 10],
    degrees: ["I", "bIII", "IV", "bV", "V", "bVII"]
  },
  {
    name: "Dórico",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ["I", "II", "bIII", "IV", "V", "VI", "bVII"]
  },
  {
    name: "Frígio",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ["I", "bII", "bIII", "IV", "V", "bVI", "bVII"]
  },
  {
    name: "Lídio",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ["I", "II", "III", "#IV", "V", "VI", "VII"]
  },
  {
    name: "Mixolídio",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ["I", "II", "III", "IV", "V", "VI", "bVII"]
  },
  {
    name: "Lócrio",
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ["I", "bII", "bIII", "IV", "bV", "bVI", "bVII"]
  }
];

