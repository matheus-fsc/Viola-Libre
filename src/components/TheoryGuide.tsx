import React, { useState } from 'react';
import { NaturalPiano, ChromaticPiano } from './InteractivePiano';
import { useT } from '../i18n';

/**
 * A escala de Dó maior no Cebolão em Ré, passo a passo.
 *
 * Nota, corda e casa são DADO musical e não texto de interface: valem igual em qualquer
 * idioma, e é o texto em volta que muda. Fora do componente porque a tabela não depende
 * de nada que aconteça num render.
 */
const ESCALA_DO = [
  { ordem: 1, nota: 'Dó (C)', par: 5, cordaNota: 'Lá', casa: 3, tonica: true },
  { ordem: 2, nota: 'Ré (D)', par: 4, cordaNota: 'Ré', casa: 0, tonica: false },
  { ordem: 3, nota: 'Mi (E)', par: 4, cordaNota: 'Ré', casa: 2, tonica: false },
  { ordem: 4, nota: 'Fá (F)', par: 4, cordaNota: 'Ré', casa: 3, tonica: false },
  { ordem: 5, nota: 'Sol (G)', par: 3, cordaNota: 'Fá#', casa: 1, tonica: false },
  { ordem: 6, nota: 'Lá (A)', par: 2, cordaNota: 'Lá', casa: 0, tonica: false },
  { ordem: 7, nota: 'Si (B)', par: 2, cordaNota: 'Lá', casa: 2, tonica: false },
  { ordem: 8, nota: 'Dó (C)', par: 2, cordaNota: 'Lá', casa: 3, tonica: true },
] as const;

interface Lesson {
  id: string;
  title: string;
  category: string;
  content: React.ReactNode;
}

export const TheoryGuide: React.FC = () => {
  const t = useT();
  const [activeLessonId, setActiveLessonId] = useState<string>("basico-1");

  const lessons: Lesson[] = [
    {
      id: "basico-1",
      title: t('teoria.licao1Titulo'),
      category: t('teoria.catBasica'),
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            {t('teoria.licao1H')}
          </h3>
          <p>
            {t('teoria.licao1P1a')} <strong>{t('teoria.licao1P1forte')}</strong>{t('teoria.licao1P1b')}
          </p>
          {/* Os nomes das notas NÃO passam pelo dicionário: «Dó (C)» é a grafia da cifra
              brasileira, que é o que este site ensina a ler. A versão em inglês do texto
              em volta explica isso em vez de apagar. */}
          <div className="bg-[#ece9d8] p-2 border border-[#808080] font-bold text-center flex flex-wrap justify-around gap-2 text-gray-800">
            <span>Dó (C)</span> <span>Ré (D)</span> <span>Mi (E)</span> <span>Fá (F)</span>
            <span>Sol (G)</span> <span>Lá (A)</span> <span>Si (B)</span>
          </div>

          <div className="my-1 overflow-x-auto no-scrollbar w-full flex justify-center">
            <div className="w-max shrink-0">
              <NaturalPiano />
            </div>
          </div>

          <p>
            {t('teoria.licao1P2a')} <strong>{t('teoria.licao1P2forte')}</strong> {t('teoria.licao1P2b')}
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>{t('teoria.licao1Sustenido')}</strong> {t('teoria.licao1SustenidoTexto')}</li>
            <li><strong>{t('teoria.licao1Bemol')}</strong> {t('teoria.licao1BemolTexto')}</li>
          </ul>
          <p>
            {t('teoria.licao1P3a')} <strong>{t('teoria.licao1P3forte')}</strong>:
          </p>
          <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-2 font-bold text-center text-[#228b22] text-[11px] overflow-x-auto whitespace-nowrap">
            {t('teoria.licao1Cromatica')}
          </div>

          <div className="my-1 overflow-x-auto no-scrollbar w-full flex justify-center">
            <div className="w-max shrink-0">
              <ChromaticPiano />
            </div>
          </div>

          <div className="bg-[#ff9d00]/10 border border-[#ff9d00] p-2 text-red-600 rounded-sm">
            <strong>{t('teoria.aviso')}</strong> {t('teoria.licao1Aviso')}
          </div>
        </div>
      )
    },
    {
      id: "basico-2",
      title: t('teoria.licao2Titulo'),
      category: t('teoria.catBasica'),
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            {t('teoria.licao2H')}
          </h3>
          <p>
            {t('teoria.licao2P1a')} <strong>{t('teoria.licao2P1forte')}</strong> {t('teoria.licao2P1b')}
          </p>
          <div className="bg-[#ece9d8] p-2 border border-[#808080] font-bold text-center grid grid-cols-7 text-gray-800 text-[10px]">
            <div>A = Lá</div> <div>B = Si</div> <div>C = Dó</div> <div>D = Ré</div>
            <div>E = Mi</div> <div>F = Fá</div> <div>G = Sol</div>
          </div>
          <p>
            <strong>{t('teoria.licao2Simbolos')}</strong>
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>{t('teoria.licao2Sozinha')}</strong> {t('teoria.licao2SozinhaTexto')}</li>
            <li><strong>{t('teoria.licao2Menor')}</strong> {t('teoria.licao2MenorTexto')}</li>
            <li><strong>{t('teoria.licao2Setima')}</strong> {t('teoria.licao2SetimaTexto')}</li>
            <li><strong>{t('teoria.licao2Acidentes')}</strong> {t('teoria.licao2AcidentesTexto')}</li>
          </ul>
          <p>
            <strong>{t('teoria.licao2Diagramas')}</strong>
          </p>
          <p>{t('teoria.licao2DiagramasP')}</p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>{t('teoria.licao2Verticais')}</strong> {t('teoria.licao2VerticaisTexto')}</li>
            <li><strong>{t('teoria.licao2Horizontais')}</strong> {t('teoria.licao2HorizontaisTexto')}</li>
            <li><strong>{t('teoria.licao2Circulos')}</strong> {t('teoria.licao2CirculosTexto')}</li>
            <li><strong>{t('teoria.licao2X')}</strong> {t('teoria.licao2XTexto')}</li>
            <li><strong>{t('teoria.licao2Zero')}</strong> {t('teoria.licao2ZeroTexto')}</li>
          </ul>
        </div>
      )
    },
    {
      id: "basico-3",
      title: t('teoria.licao3Titulo'),
      category: t('teoria.catHarmonia'),
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            {t('teoria.licao3H')}
          </h3>
          <p>
            {t('teoria.licao3P1a')} <strong>{t('teoria.licao3P1forte')}</strong>{t('teoria.licao3P1b')}
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>{t('teoria.licao3Tonica')}</strong> {t('teoria.licao3TonicaTexto')}</li>
            <li><strong>{t('teoria.licao3Terca')}</strong> {t('teoria.licao3TercaTexto')}</li>
            <li><strong>{t('teoria.licao3Quinta')}</strong> {t('teoria.licao3QuintaTexto')}</li>
          </ul>
          <p>
            {t('teoria.licao3Exemploa')} <strong>{t('teoria.licao3ExemploAcorde')}</strong> {t('teoria.licao3Exemplob')}{' '}
            <strong>{t('teoria.licao3ExemploNotas')}</strong>.
          </p>
          <p>
            <strong>{t('teoria.licao3Tetrades')}</strong> {t('teoria.licao3TetradesTexto')}
          </p>
          <div className="bg-[#0058e6]/10 border border-[#0058e6] p-2 text-gray-800 rounded-sm">
            <strong>{t('teoria.dica')}</strong> {t('teoria.licao3Dica')}
          </div>
        </div>
      )
    },
    {
      id: "basico-4",
      title: t('teoria.licao4Titulo'),
      category: t('teoria.catViola'),
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            {t('teoria.licao4H')}
          </h3>
          <p>
            {t('teoria.licao4P1a')} <strong>{t('teoria.licao4P1forte')}</strong>{t('teoria.licao4P1b')}
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-2">
            <li><strong>{t('teoria.licao4CebolaoRe')}</strong> {t('teoria.licao4CebolaoReTexto')}</li>
            <li><strong>{t('teoria.licao4CebolaoMi')}</strong> {t('teoria.licao4CebolaoMiTexto')}</li>
            <li><strong>{t('teoria.licao4RioAbaixo')}</strong> {t('teoria.licao4RioAbaixoTexto')}</li>
          </ul>
          <p>
            <strong>{t('teoria.licao4Transposicao')}</strong> {t('teoria.licao4TransposicaoTexto')}
          </p>
        </div>
      )
    },
    {
      id: "pratico-5",
      title: t('teoria.licao5Titulo'),
      category: t('teoria.catPratica'),
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            {t('teoria.licao5H')}
          </h3>
          <p>{t('teoria.licao5P1')}</p>
          <p>
            {t('teoria.licao5P2a')} <strong>{t('teoria.licao5P2forte')}</strong> {t('teoria.licao5P2b')}
          </p>

          {/* A tabela vira dado: a mesma linha escrita seis vezes à mão é a receita para
              uma delas divergir das outras no primeiro ajuste. */}
          <table className="w-full text-left border-collapse border border-[#808080] text-[11px]">
            <thead>
              <tr className="bg-[#d4d0c8] font-bold border-b border-[#808080]">
                <th className="p-2 border-r border-[#808080]">{t('teoria.licao5ColOrdem')}</th>
                <th className="p-2 border-r border-[#808080]">{t('teoria.licao5ColNota')}</th>
                <th className="p-2 border-r border-[#808080]">{t('teoria.licao5ColCorda')}</th>
                <th className="p-2">{t('teoria.licao5ColCasa')}</th>
              </tr>
            </thead>
            <tbody>
              {ESCALA_DO.map((passo, i) => (
                <tr key={passo.ordem} className={`border-b border-[#d4d0c8] ${i % 2 ? 'bg-gray-50' : ''} last:border-b-0`}>
                  <td className="p-2 border-r border-[#d4d0c8] font-bold">{passo.ordem}</td>
                  <td className={`p-2 border-r border-[#d4d0c8] font-bold ${passo.tonica ? 'text-[#cc3300]' : ''}`}>{passo.nota}</td>
                  <td className="p-2 border-r border-[#d4d0c8]">{t('teoria.licao5Par', { n: passo.par, nota: passo.cordaNota })}</td>
                  <td className="p-2 font-bold">
                    {passo.casa === 0 ? t('teoria.licao5Solta') : t('teoria.licao5Casa', { n: passo.casa })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-gray-600">{t('teoria.licao5Rodape')}</p>
        </div>
      )
    },
    {
      id: "teoria-6",
      title: t('teoria.licao6Titulo'),
      category: t('teoria.catHarmonia'),
      content: (
        <div className="flex flex-col gap-3 font-mono text-xs text-black leading-relaxed">
          <h3 className="text-sm font-bold text-[#002fa7] border-b border-[#808080]/30 pb-1">
            {t('teoria.licao6H')}
          </h3>
          <p>{t('teoria.licao6P1')}</p>
          <p><strong>{t('teoria.licao6P2')}</strong></p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>{t('teoria.licao6Graus')}</strong> {t('teoria.licao6GrausTexto')}</li>
            <li><strong>{t('teoria.licao6Campos')}</strong> {t('teoria.licao6CamposTexto')}</li>
            <li><strong>{t('teoria.licao6Autonomia')}</strong> {t('teoria.licao6AutonomiaTexto')}</li>
          </ul>
          <div className="bg-[#cc3300]/10 border border-[#cc3300] p-2 text-red-600 rounded-sm">
            <strong>{t('teoria.foco')}</strong> {t('teoria.licao6Foco')}
          </div>
        </div>
      )
    }
  ];

  const activeLesson = lessons.find(l => l.id === activeLessonId) || lessons[0];

  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-2 sm:p-4 flex flex-col md:flex-row gap-4 w-full shadow-md">
      
      {/* Lessons Sidebar index */}
      <div className="w-full md:w-[220px] bg-white border-2 border-[#808080] border-r-white border-bottom-white p-2 flex flex-col gap-1.5 shrink-0 select-none">
        <span className="text-[10px] font-bold font-mono text-gray-500 block border-b border-gray-300 pb-1 mb-1">
          {t('teoria.topicos')}
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
      <div className="flex-1 bg-white border-2 border-[#808080] border-r-white border-bottom-white p-2 sm:p-4 min-h-[250px] flex flex-col justify-between">
        <div>
          {/* Lesson Header path */}
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1 select-none">
            <span>{t('teoria.trilha')}</span>
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
            {t('teoria.anterior')}
          </button>
          
          <button
            onClick={() => {
              const idx = lessons.findIndex(l => l.id === activeLessonId);
              if (idx < lessons.length - 1) setActiveLessonId(lessons[idx + 1].id);
            }}
            disabled={lessons.findIndex(l => l.id === activeLessonId) === lessons.length - 1}
            className="px-2.5 py-1 text-[10px] font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] cursor-pointer"
          >
            {t('teoria.proximo')}
          </button>
        </div>

      </div>

    </div>
  );
};
