import React, { useState } from 'react';
import { NaturalPiano, ChromaticPiano } from './InteractivePiano';

interface Lesson {
  id: string;
  title: string;
  category: string;
  content: React.ReactNode;
}

export const TheoryGuide: React.FC = () => {
  const [activeLessonId, setActiveLessonId] = useState<string>("basico-1");

  const lessons: Lesson[] = [
    {
      id: "basico-1",
      title: "1. Notas Musicais e Escala Cromática",
      category: "Teoria Básica",
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            A base de tudo: O que são as Notas?
          </h3>
          <p>
            Na música ocidental, existem apenas <strong>12 notas possíveis</strong>. Sete delas são as notas naturais que você provavelmente já conhece:
          </p>
          <div className="bg-[#ece9d8] p-2 border border-[#808080] font-bold text-center flex justify-around text-gray-800">
            <span>Dó (C)</span> <span>Ré (D)</span> <span>Mi (E)</span> <span>Fá (F)</span> 
            <span>Sol (G)</span> <span>Lá (A)</span> <span>Si (B)</span>
          </div>
          
          <div className="my-1">
            <NaturalPiano />
          </div>

          <p>
            As outras 5 notas são os <strong>acidentes</strong> (sustenidos ou bemóis), que ficam nos intervalos entre as notas naturais:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>Sustenido (#):</strong> Eleva a nota em meio tom (1 casa para cima no braço).</li>
            <li><strong>Bemol (b):</strong> Reduz a nota em meio tom (1 casa para baixo no braço).</li>
          </ul>
          <p>
            A sequência circular destas 12 notas é chamada de <strong>Escala Cromática</strong>:
          </p>
          <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-2 font-bold text-center text-[#228b22] text-[11px] overflow-x-auto whitespace-nowrap">
            C - C#/Db - D - D#/Eb - E - F - F#/Gb - G - G#/Ab - A - A#/Bb - B - C (oitava)
          </div>

          <div className="my-1">
            <ChromaticPiano />
          </div>

          <div className="bg-[#ff9d00]/10 border border-[#ff9d00] p-2 text-red-600 rounded-sm">
            <strong>AVISO:</strong> Entre as notas <strong>Mi (E) e Fá (F)</strong> e entre <strong>Si (B) e Dó (C)</strong> NÃO existem notas intermediárias (não há E# ou B# na escala padrão)!
          </div>
        </div>
      )
    },
    {
      id: "basico-2",
      title: "2. Como Ler Cifras",
      category: "Teoria Básica",
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            Cifras: A Linguagem dos Acordes
          </h3>
          <p>
            As <strong>cifras</strong> são um sistema de letras usado para representar os acordes de forma rápida e universal. Cada uma das 7 notas tem uma letra correspondente:
          </p>
          <div className="bg-[#ece9d8] p-2 border border-[#808080] font-bold text-center grid grid-cols-7 text-gray-800 text-[10px]">
            <div>A = Lá</div> <div>B = Si</div> <div>C = Dó</div> <div>D = Ré</div> 
            <div>E = Mi</div> <div>F = Fá</div> <div>G = Sol</div>
          </div>
          <p>
            <strong>Símbolos Comuns de Extensões:</strong>
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>Letra sozinha (ex: C):</strong> Acorde Maior (Dó Maior).</li>
            <li><strong>Letra com "m" (ex: Cm):</strong> Acorde Menor (Dó Menor).</li>
            <li><strong>Número 7 (ex: C7):</strong> Acorde com Sétima (Dó com Sétima Dominante).</li>
            <li><strong>Sustenidos/Bemóis (ex: C#, Bb):</strong> Notas alteradas (Dó Sustenido, Si Bemol).</li>
          </ul>
          <p>
            <strong>Como Ler os Diagramas de Acordes:</strong>
          </p>
          <p>
            Neste site, as posições dos acordes são exibidas em diagramas gráficos. Veja como lê-los:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>Linhas Verticais:</strong> Representam as cordas do instrumento (a corda mais grave fica na esquerda ou acima, dependendo da orientação).</li>
            <li><strong>Linhas Horizontais:</strong> Representam os trastes (casas) no braço do instrumento.</li>
            <li><strong>Círculos no Braço:</strong> Indicam onde você deve apertar com a ponta dos dedos. Os números dentro do círculo (1 a 4) indicam qual dedo da mão esquerda usar (1: Indicador, 2: Médio, 3: Anelar, 4: Mínimo).</li>
            <li><strong>Indicador "X":</strong> Posicionado no topo de uma corda, indica que aquela corda não deve ser tocada (deve ser abafada).</li>
            <li><strong>Indicador "0" (ou círculo aberto):</strong> Indica que a corda deve ser tocada aberta (solta).</li>
          </ul>
        </div>
      )
    },
    {
      id: "basico-3",
      title: "3. O que são Acordes e sua Estrutura",
      category: "Harmonia",
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            Como os acordes são formados
          </h3>
          <p>
            Um acorde é formado por 3 ou mais notas tocadas simultaneamente. A estrutura básica de um acorde é a <strong>Tríade</strong>, composta por:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>Tônica (I):</strong> Dá o nome ao acorde (a nota fundamental/root).</li>
            <li><strong>Terça (III):</strong> Define se o acorde é alegre (Terça Maior - 4 semitons) ou triste (Terça Menor - 3 semitons).</li>
            <li><strong>Quinta (V):</strong> Dá sustentação e estabilidade (Quinta Justa - 7 semitons).</li>
          </ul>
          <p>
            Por exemplo, a tríade de <strong>Ré Maior (D)</strong> contém as notas: <strong>D (Tônica) - F# (Terça Maior) - A (Quinta)</strong>.
          </p>
          <p>
            <strong>Tétrades e Tensões:</strong> Para criar acordes de MPB/Samba, adicionamos uma quarta nota chamada <strong>Sétima</strong> (7 ou Maj7), ou alteramos graus como a quinta (ex: quinta menor bemol b5, como em Bb7(b5) / Bbm7(b5)).
          </p>
          <div className="bg-[#0058e6]/10 border border-[#0058e6] p-2 text-gray-800 rounded-sm">
            <strong>DICA:</strong> O motor de acordes usa essa matemática exata (graus e semitons) para calcular as posições na viola caipira. Por isso ela funciona para qualquer afinação!
          </div>
        </div>
      )
    },
    {
      id: "basico-4",
      title: "4. A Magia das Afinações da Viola",
      category: "Viola Caipira",
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            Cebolão e Afinações Abertas
          </h3>
          <p>
            A viola caipira se destaca pelas <strong>afinações abertas</strong>. Ao contrário do violão padrão, quando você rasqueia todas as cordas soltas da viola, você já ouve um acorde completo!
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-2">
            <li>
              <strong>Cebolão em Ré (A D F# A D):</strong> Ao rasquear solto, forma o acorde de <strong>Ré Maior (D)</strong>. Tem um som aveludado e relaxado. Muito comum nas modas de Tião Carreiro.
            </li>
            <li>
              <strong>Cebolão em Mi (B E G# B E):</strong> Exatamente 1 tom acima do Cebolão Ré. Forma o acorde de <strong>Mi Maior (E)</strong>. É brilhante e estridente. Exige mais tensão no braço do instrumento.
            </li>
            <li>
              <strong>Rio Abaixo (G D G B D):</strong> Forma o acorde de <strong>Sol Maior (G)</strong> solto. Uma afinação mágica e extremamente folclórica, famosa nos solos de Almir Sater.
            </li>
          </ul>
          <p>
            <strong>A transposição lógica:</strong> Como o Cebolão em Mi é apenas 2 semitons acima do Cebolão Ré, todas as fôrmas físicas de acordes feitas no Cebolão Ré servem idênticas para o Cebolão Mi, porém soando 1 tom acima!
          </p>
        </div>
      )
    },
    {
      id: "pratico-5",
      title: "5. Prática: Escala de Dó Maior Passo a Passo",
      category: "Prática",
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            Escala de Dó Maior no Cebolão em Ré (A D F# A D)
          </h3>
          <p>
            A escala maior de Dó (C) possui 8 notas (uma oitava completa): <strong>Dó, Ré, Mi, Fá, Sol, Lá, Si, Dó</strong>.
            Não possui acidentes (sustenidos ou bemóis).
          </p>
          <p>
            Siga a ordem numérica abaixo de <strong>1 a 8</strong> para tocar a escala de Dó Maior no braço da sua viola caipira:
          </p>
          
          <table className="w-full text-left border-collapse border border-[#808080] text-[11px]">
            <thead>
              <tr className="bg-[#d4d0c8] font-bold border-b border-[#808080]">
                <th className="p-2 border-r border-[#808080]">Ordem</th>
                <th className="p-2 border-r border-[#808080]">Nota</th>
                <th className="p-2 border-r border-[#808080]">Corda (Par)</th>
                <th className="p-2">Casa no Braço</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#d4d0c8]">
                <td className="p-2 border-r border-[#d4d0c8] font-bold">1</td>
                <td className="p-2 border-r border-[#d4d0c8] text-[#cc3300] font-bold">Dó (C)</td>
                <td className="p-2 border-r border-[#d4d0c8]">5º Par (Lá)</td>
                <td className="p-2 font-bold">Casa 3</td>
              </tr>
              <tr className="border-b border-[#d4d0c8] bg-gray-50">
                <td className="p-2 border-r border-[#d4d0c8] font-bold">2</td>
                <td className="p-2 border-r border-[#d4d0c8] font-bold">Ré (D)</td>
                <td className="p-2 border-r border-[#d4d0c8]">4º Par (Ré)</td>
                <td className="p-2 font-bold">Solta (Casa 0)</td>
              </tr>
              <tr className="border-b border-[#d4d0c8]">
                <td className="p-2 border-r border-[#d4d0c8] font-bold">3</td>
                <td className="p-2 border-r border-[#d4d0c8] font-bold">Mi (E)</td>
                <td className="p-2 border-r border-[#d4d0c8]">4º Par (Ré)</td>
                <td className="p-2 font-bold">Casa 2</td>
              </tr>
              <tr className="border-b border-[#d4d0c8] bg-gray-50">
                <td className="p-2 border-r border-[#d4d0c8] font-bold">4</td>
                <td className="p-2 border-r border-[#d4d0c8] font-bold">Fá (F)</td>
                <td className="p-2 border-r border-[#d4d0c8]">4º Par (Ré)</td>
                <td className="p-2 font-bold">Casa 3</td>
              </tr>
              <tr className="border-b border-[#d4d0c8]">
                <td className="p-2 border-r border-[#d4d0c8] font-bold">5</td>
                <td className="p-2 border-r border-[#d4d0c8] font-bold">Sol (G)</td>
                <td className="p-2 border-r border-[#d4d0c8]">3º Par (Fá#)</td>
                <td className="p-2 font-bold">Casa 1</td>
              </tr>
              <tr className="border-b border-[#d4d0c8] bg-gray-50">
                <td className="p-2 border-r border-[#d4d0c8] font-bold">6</td>
                <td className="p-2 border-r border-[#d4d0c8] font-bold">Lá (A)</td>
                <td className="p-2 border-r border-[#d4d0c8]">2º Par (Lá)</td>
                <td className="p-2 font-bold">Solta (Casa 0)</td>
              </tr>
              <tr className="border-b border-[#d4d0c8]">
                <td className="p-2 border-r border-[#d4d0c8] font-bold">7</td>
                <td className="p-2 border-r border-[#d4d0c8] font-bold">Si (B)</td>
                <td className="p-2 border-r border-[#d4d0c8]">2º Par (Lá)</td>
                <td className="p-2 font-bold">Casa 2</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="p-2 border-r border-[#d4d0c8] font-bold">8</td>
                <td className="p-2 border-r border-[#d4d0c8] text-[#cc3300] font-bold">Dó (C)</td>
                <td className="p-2 border-r border-[#d4d0c8]">2º Par (Lá)</td>
                <td className="p-2 font-bold">Casa 3</td>
              </tr>
            </tbody>
          </table>
          
          <p className="text-gray-600">
            Toque as notas na sequência acima para escutar e fixar a estrutura da escala de Dó Maior no braço.
          </p>
        </div>
      )
    },
    {
      id: "teoria-6",
      title: "6. Teoria: Graus, Nomes e Campos Harmônicos",
      category: "Harmonia",
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            Por que decorar os nomes e graus?
          </h3>
          <p>
            Muitos músicos cometem o erro de decorar apenas a forma física dos acordes (o desenho dos dedos) sem se importar com a teoria musical por trás.
          </p>
          <p>
            <strong>A importância de entender a teoria:</strong>
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong>Entendimento de Graus (I, II, III...):</strong> Saber se um acorde é o primeiro grau (Tônica), segundo (Supertônica) ou quinto (Dominante) permite entender a função harmônica de cada acorde na composição.
            </li>
            <li>
              <strong>Preparação para Campos Harmônicos:</strong> Em breve, estudaremos os campos harmônicos. Saber de cabeça a estrutura dos graus nos permite transpor músicas para qualquer tom sem precisar de consultas.
            </li>
            <li>
              <strong>Autonomia no Instrumento:</strong> Memorizar a relação entre notas, graus e nomes é o que diferencia quem apenas copia cifras de quem realmente compreende e consegue improvisar e criar novos arranjos.
            </li>
          </ul>
          <div className="bg-[#cc3300]/10 border border-[#cc3300] p-2 text-red-600 rounded-sm">
            <strong>FOCO:</strong> Dedique tempo para decorar onde está cada grau e qual nota representa. Essa base será fundamental para os próximos passos de harmonia avançada.
          </div>
        </div>
      )
    }
  ];

  const activeLesson = lessons.find(l => l.id === activeLessonId) || lessons[0];

  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-4 flex flex-col md:flex-row gap-4 w-full shadow-md">
      
      {/* Lessons Sidebar index */}
      <div className="w-full md:w-[220px] bg-white border-2 border-[#808080] border-r-white border-bottom-white p-2 flex flex-col gap-1.5 shrink-0 select-none">
        <span className="text-[10px] font-bold font-mono text-gray-500 block border-b border-gray-300 pb-1 mb-1">
          Topicos de Teoria
        </span>
        
        {lessons.map(lesson => {
          const active = lesson.id === activeLessonId;
          return (
            <button
              key={lesson.id}
              onClick={() => setActiveLessonId(lesson.id)}
              className={`text-left text-xs font-mono px-2 py-1.5 border rounded-sm cursor-pointer select-none truncate ${
                active
                  ? 'bg-[#0058e6] text-white border-[#002fa7]'
                  : 'bg-[#ece9d8] text-black border-[#d4d0c8] hover:bg-gray-100'
              }`}
            >
              {lesson.title.slice(3)}
            </button>
          );
        })}
      </div>

      {/* Active Lesson Display Area */}
      <div className="flex-1 bg-white border-2 border-[#808080] border-r-white border-bottom-white p-4 min-h-[250px] flex flex-col justify-between">
        <div>
          {/* Lesson Header path */}
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1 select-none">
            <span>Teoria Musical</span>
            <span>&gt;</span>
            <span>{activeLesson.category}</span>
          </div>
          
          {/* Lesson Title */}
          <h2 className="text-base font-bold text-[#cc3300] font-sans mb-3 select-none">
            {activeLesson.title}
          </h2>

          {/* Lesson Rendered Content */}
          <div className="mt-2">
            {activeLesson.content}
          </div>
        </div>

        {/* Navigation buttons inside lesson */}
        <div className="border-t border-[#d4d0c8] pt-3 mt-4 flex justify-between select-none">
          <button
            onClick={() => {
              const idx = lessons.findIndex(l => l.id === activeLessonId);
              if (idx > 0) setActiveLessonId(lessons[idx - 1].id);
            }}
            disabled={lessons.findIndex(l => l.id === activeLessonId) === 0}
            className="px-2.5 py-1 text-[10px] font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] cursor-pointer"
          >
            &lt;- Anterior
          </button>
          
          <button
            onClick={() => {
              const idx = lessons.findIndex(l => l.id === activeLessonId);
              if (idx < lessons.length - 1) setActiveLessonId(lessons[idx + 1].id);
            }}
            disabled={lessons.findIndex(l => l.id === activeLessonId) === lessons.length - 1}
            className="px-2.5 py-1 text-[10px] font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] cursor-pointer"
          >
            Proximo -&gt;
          </button>
        </div>

      </div>

    </div>
  );
};
