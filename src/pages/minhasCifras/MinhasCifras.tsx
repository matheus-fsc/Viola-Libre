import React, { useState, useEffect, useRef } from 'react';
import { buildChord, calculateVoicings, parseChordString } from '../../engine/chordCalculator';
import { AudioEngine } from '../../engine/AudioEngine';
import { PRESET_INSTRUMENTS } from '../../engine/tunings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomCifra {
  id: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  content: string;
  chordsUsed: string[];
  createdAt: number;
  updatedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'viola_libre_custom_cifras_v2';

const GENRES = ['MPB', 'Sertanejo & Viola', 'Rock', 'Forró', 'Pagode', 'Bossa Nova', 'Gospel', 'Outro'];

const NOTE_KEYS = [
  'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractChords(content: string): string[] {
  const regex = /\[([^\]]+)\]/g;
  const seen = new Set<string>();
  const result: string[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    const c = m[1].trim();
    if (c && !seen.has(c)) { seen.add(c); result.push(c); }
  }
  return result;
}

function loadCifras(): CustomCifra[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveCifras(cifras: CustomCifra[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cifras));
}

function playChordByName(chordStr: string) {
  const { root, suffix, bass } = parseChordString(chordStr);
  if (!root) return;
  try {
    const inst = PRESET_INSTRUMENTS.find(i => i.id === 'violao') ?? PRESET_INSTRUMENTS[0];
    const tuning = inst.tunings[0];
    const chord = buildChord(root, suffix, bass || undefined);
    const voicings = calculateVoicings(tuning, chord);
    if (!voicings.length) return;
    const ae = AudioEngine.getInstance();
    let delay = 0;
    voicings[0].frets.forEach((fret, idx) => {
      if (fret === -1) return;
      const midi = tuning.strings[idx] + fret;
      setTimeout(() => ae.playMidi(midi, 1.0), delay);
      delay += 45;
    });
  } catch { /* unsupported chord shape, ignore */ }
}

// ─── CifraLine ────────────────────────────────────────────────────────────────
// Renders one line of cifra content with chord buttons floating above their syllables.
// Correctly tracks lastIdx to avoid rendering the same text segment twice.

function CifraLine({ line, onChordClick }: { line: string; onChordClick: (c: string) => void }) {
  if (!line.includes('[')) {
    return (
      <div className="min-h-[1.5rem] font-mono text-xs sm:text-sm text-gray-800 whitespace-pre">
        {line || ' '}
      </div>
    );
  }

  const regex = /\[([^\]]+)\]/g;
  const elements: React.ReactNode[] = [];
  let lastIdx = 0;
  let m;

  while ((m = regex.exec(line)) !== null) {
    // Text before this chord (not yet consumed)
    if (m.index > lastIdx) {
      elements.push(
        <span key={`t${lastIdx}`} className="font-mono text-xs sm:text-sm text-gray-800 whitespace-pre">
          {line.slice(lastIdx, m.index)}
        </span>
      );
    }

    const chord = m[1];
    const afterStart = regex.lastIndex;
    const afterText = line.slice(afterStart);
    const nextBracket = afterText.indexOf('[');
    const segment = nextBracket === -1 ? afterText : afterText.slice(0, nextBracket);

    elements.push(
      <span key={`c${m.index}`} className="inline-block relative pt-5 mt-1 mr-0.5 select-none">
        <button
          onClick={() => onChordClick(chord)}
          className="absolute top-0 left-0 font-bold text-[#0058e6] hover:text-[#cc3300] hover:underline text-[10px] sm:text-xs font-mono focus:outline-none cursor-pointer leading-none whitespace-nowrap"
          title={`Tocar ${chord}`}
        >
          {chord}
        </button>
        <span className="font-mono text-xs sm:text-sm text-gray-800 whitespace-pre">
          {segment || ' '}
        </span>
      </span>
    );

    // Advance past the segment already rendered, so it's not duplicated
    lastIdx = afterStart + (nextBracket === -1 ? afterText.length : nextBracket);
  }

  if (lastIdx < line.length) {
    elements.push(
      <span key="tend" className="font-mono text-xs sm:text-sm text-gray-800 whitespace-pre">
        {line.slice(lastIdx)}
      </span>
    );
  }

  return <div className="flex flex-wrap items-end min-h-[2.5rem] leading-relaxed">{elements}</div>;
}

// ─── CifraCard ────────────────────────────────────────────────────────────────

function CifraCard({ cifra, onView, onEdit, onDelete }: {
  cifra: CustomCifra;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] p-3 flex flex-col gap-2 shadow-md">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-black font-mono truncate">{cifra.title}</div>
          <div className="text-xs text-gray-600 font-mono truncate">{cifra.artist}</div>
        </div>
        <div className="flex gap-1 shrink-0">
          <span className="text-[10px] font-mono bg-[#d4d0c8] border border-[#808080] px-1.5 py-0.5 text-gray-700">
            {cifra.key}
          </span>
          <span className="text-[10px] font-mono bg-[#d4d0c8] border border-[#808080] px-1.5 py-0.5 text-gray-700">
            {cifra.bpm} BPM
          </span>
        </div>
      </div>

      <div className="text-[10px] font-mono text-gray-500 flex items-center gap-2 flex-wrap">
        <span className="bg-[#c2d7f2] px-1.5 py-0.5 border border-[#5b93c7] text-[#002fa7]">
          {cifra.genre}
        </span>
        <span>{cifra.chordsUsed.length} acordes</span>
      </div>

      <div className="flex gap-1.5 mt-1">
        <button
          onClick={onView}
          className="flex-1 py-1 bg-[#0058e6] text-white text-[10px] font-bold font-mono border border-[#002fa7] hover:bg-blue-600 cursor-pointer"
        >
          Ver Cifra
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1 bg-[#ece9d8] text-black text-[10px] font-bold font-mono border border-white border-r-[#808080] border-b-[#808080] active:border-t-[#808080] active:border-l-[#808080] hover:bg-white cursor-pointer"
        >
          Editar
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 bg-[#cc3300] text-white text-[10px] font-bold font-mono border border-[#992200] hover:bg-red-700 cursor-pointer"
          title="Excluir cifra"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center select-none">
      <div className="text-5xl font-mono">♪</div>
      <h3 className="font-bold text-gray-700 font-mono text-sm">Nenhuma cifra criada ainda</h3>
      <p className="text-xs text-gray-500 font-mono max-w-xs leading-relaxed">
        Crie suas próprias cifras com letras, acordes, tom e BPM.
        A rolagem automática acompanha o ritmo da música.
      </p>
      <button
        onClick={onNew}
        className="px-5 py-2 bg-[#0058e6] text-white font-bold text-xs font-mono border border-[#002fa7] hover:bg-blue-600 cursor-pointer"
      >
        + Nova Cifra
      </button>
    </div>
  );
}

// ─── CifraViewer ──────────────────────────────────────────────────────────────

function CifraViewer({ cifra, onEdit, onBack }: {
  cifra: CustomCifra;
  onEdit: () => void;
  onBack: () => void;
}) {
  const [isScrolling, setIsScrolling] = useState(false);
  const [bpm, setBpm] = useState(cifra.bpm);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isScrolling) {
      intervalRef.current = setInterval(() => {
        scrollRef.current?.scrollBy({ top: bpm / 60 * 0.8 });
      }, 50);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isScrolling, bpm]);

  const lines = cifra.content.split('\n');

  return (
    <div className="flex flex-col h-full">
      {/* Title bar */}
      <div className="winxp-gradient-blue text-white px-3 py-1.5 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="shrink-0 text-white text-xs font-bold bg-white/20 hover:bg-white/30 border border-white/40 px-2 py-0.5 cursor-pointer font-mono"
          >
            ← Voltar
          </button>
          <div className="min-w-0">
            <div className="font-bold text-sm font-mono truncate">{cifra.title}</div>
            <div className="text-[10px] opacity-80 font-mono truncate">
              {cifra.artist} · Tom: {cifra.key}
            </div>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 ml-2 px-3 py-0.5 bg-[#ece9d8] text-black text-xs font-bold font-mono border border-white border-r-[#808080] border-b-[#808080] hover:bg-white cursor-pointer"
        >
          Editar
        </button>
      </div>

      {/* Controls bar */}
      <div className="bg-[#d4d0c8] border-b border-[#808080] px-3 py-2 flex items-center gap-4 shrink-0 flex-wrap">
        <button
          onClick={() => setIsScrolling(s => !s)}
          className={`px-3 py-1 text-xs font-bold font-mono border cursor-pointer transition-colors ${
            isScrolling
              ? 'bg-[#cc3300] text-white border-[#992200] hover:bg-red-700'
              : 'bg-[#228b22] text-white border-[#1a6b1a] hover:bg-green-700'
          }`}
        >
          {isScrolling ? '⏸ Pausar' : '▶ Rolagem Auto'}
        </button>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono font-bold text-gray-700 shrink-0">BPM:</label>
          <input
            type="range"
            min={40} max={220} value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            className="w-24 cursor-pointer"
          />
          <span className="text-[10px] font-mono font-bold text-gray-800 min-w-[2.5rem]">{bpm}</span>
        </div>

        {cifra.chordsUsed.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {cifra.chordsUsed.map(chord => (
              <button
                key={chord}
                onClick={() => playChordByName(chord)}
                className="px-2 py-0.5 bg-white border border-[#808080] text-[10px] font-bold font-mono text-[#002fa7] hover:bg-[#c2d7f2] cursor-pointer"
                title={`Tocar ${chord}`}
              >
                {chord}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white p-4 retro-scrollbar">
        <div className="max-w-2xl mx-auto flex flex-col gap-0.5">
          {lines.map((line, i) => (
            <CifraLine key={i} line={line} onChordClick={playChordByName} />
          ))}
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}

// ─── CifraEditor ──────────────────────────────────────────────────────────────

const DEFAULT_BPM = 80;

function CifraEditor({ initial, onSave, onCancel, onDelete }: {
  initial?: CustomCifra;
  onSave: (cifra: CustomCifra) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [artist, setArtist] = useState(initial?.artist ?? '');
  const [genre, setGenre] = useState(initial?.genre ?? 'MPB');
  const [key, setKey] = useState(initial?.key ?? 'G');
  const [bpm, setBpm] = useState(initial?.bpm ?? DEFAULT_BPM);
  const [content, setContent] = useState(initial?.content ?? '');

  const tapHistory = useRef<number[]>([]);
  const previewLines = content.split('\n');
  const liveChords = extractChords(content);
  const canSave = title.trim().length > 0 && artist.trim().length > 0;

  const handleTapTempo = () => {
    const now = Date.now();
    // Keep only taps within the last 4 seconds
    tapHistory.current = [...tapHistory.current.filter(t => now - t < 4000), now];
    if (tapHistory.current.length >= 2) {
      const intervals = tapHistory.current
        .slice(1)
        .map((t, i) => t - tapHistory.current[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.max(40, Math.min(220, Math.round(60000 / avg))));
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    const now = Date.now();
    onSave({
      id: initial?.id ?? `cifra-${now}`,
      title: title.trim(),
      artist: artist.trim(),
      genre,
      key,
      bpm,
      content,
      chordsUsed: extractChords(content),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Title bar */}
      <div className="winxp-gradient-blue text-white px-3 py-1.5 flex items-center justify-between select-none shrink-0">
        <span className="font-bold text-sm font-mono">
          {initial ? 'Editar Cifra' : 'Nova Cifra'}
        </span>
        <div className="flex gap-1.5">
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-2 py-0.5 bg-[#cc3300] text-white text-xs font-bold font-mono border border-[#992200] hover:bg-red-700 cursor-pointer"
            >
              Excluir
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-2 py-0.5 bg-[#ece9d8] text-black text-xs font-bold font-mono border border-white border-r-[#808080] border-b-[#808080] hover:bg-white cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-0.5 bg-[#228b22] text-white text-xs font-bold font-mono border border-[#1a6b1a] hover:bg-green-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Salvar
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* ── Left panel: form ── */}
        <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-3 p-4 overflow-y-auto border-r border-[#d4d0c8] bg-[#ece9d8] retro-scrollbar">

          {/* Metadata block */}
          <div className="bg-[#d4d0c8] border border-white border-r-[#808080] border-b-[#808080] flex flex-col">
            <div className="winxp-gradient-blue text-white px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide">
              Informações da Música
            </div>
            <div className="p-3 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold font-mono text-gray-700">Título *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Tocando em Frente"
                  className="bg-white border-2 border-r-white border-b-white border-[#808080] px-2 py-1 text-xs font-mono focus:outline-none shadow-inner"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold font-mono text-gray-700">Artista / Autor *</label>
                <input
                  type="text"
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                  placeholder="Ex: Almir Sater"
                  className="bg-white border-2 border-r-white border-b-white border-[#808080] px-2 py-1 text-xs font-mono focus:outline-none shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold font-mono text-gray-700">Gênero</label>
                  <select
                    value={genre}
                    onChange={e => setGenre(e.target.value)}
                    className="bg-white border-2 border-r-white border-b-white border-[#808080] px-1 py-1 text-xs font-mono focus:outline-none shadow-inner cursor-pointer"
                  >
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold font-mono text-gray-700">Tom</label>
                  <select
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    className="bg-white border-2 border-r-white border-b-white border-[#808080] px-1 py-1 text-xs font-mono focus:outline-none shadow-inner cursor-pointer"
                  >
                    {NOTE_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* BPM block */}
          <div className="bg-[#d4d0c8] border border-white border-r-[#808080] border-b-[#808080] flex flex-col">
            <div className="winxp-gradient-blue text-white px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide">
              Andamento (BPM)
            </div>
            <div className="p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={40} max={220} value={bpm}
                  onChange={e => setBpm(Number(e.target.value))}
                  className="flex-1 cursor-pointer"
                />
                <input
                  type="number"
                  min={40} max={220} value={bpm}
                  onChange={e => setBpm(Math.max(40, Math.min(220, Number(e.target.value) || DEFAULT_BPM)))}
                  className="w-14 bg-white border-2 border-r-white border-b-white border-[#808080] px-1 py-0.5 text-xs font-mono text-center focus:outline-none shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-gray-600 leading-tight">
                  40 (Lento) — 220 (Rápido)
                </span>
                <button
                  onClick={handleTapTempo}
                  className="px-2 py-1 bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] active:border-t-[#808080] active:border-l-[#808080] text-[10px] font-bold font-mono cursor-pointer hover:bg-white select-none shrink-0"
                  title="Toque no ritmo da música para detectar o BPM automaticamente"
                >
                  Tap Tempo
                </button>
              </div>

              <div className="text-[10px] font-mono text-gray-600 bg-[#ece9d8] border border-[#808080] p-1.5 leading-relaxed">
                A rolagem automática no visualizador é sincronizada com este BPM.
                Ajuste até acompanhar a música real.
              </div>
            </div>
          </div>

          {/* Content block */}
          <div className="bg-[#d4d0c8] border border-white border-r-[#808080] border-b-[#808080] flex flex-col flex-1">
            <div className="winxp-gradient-blue text-white px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide">
              Letra e Acordes
            </div>
            <div className="p-3 flex flex-col gap-2 flex-1">
              <div className="text-[10px] font-mono text-gray-600 leading-relaxed bg-[#ece9d8] border border-[#808080] p-1.5">
                Coloque acordes entre <code className="font-bold">[colchetes]</code> antes da sílaba:<br />
                <code>[G]Tocando em fren[D7]te</code>
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={"[G]Tocando em frente\n[D7]como um velho boia[G]deiro\n\n[G]E estrada eu [D7]sou"}
                rows={16}
                className="bg-white border-2 border-r-white border-b-white border-[#808080] p-2 text-xs font-mono focus:outline-none shadow-inner resize-none leading-relaxed flex-1 min-h-[200px]"
              />
            </div>
          </div>
        </div>

        {/* ── Right panel: live preview ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white">
          <div className="bg-[#d4d0c8] border-b border-[#808080] px-3 py-1.5 shrink-0 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold font-mono text-gray-700 uppercase tracking-wide shrink-0">
              Pré-visualização ao Vivo
            </span>
            {liveChords.length > 0 && (
              <div className="flex gap-1 flex-wrap justify-end">
                {liveChords.map(c => (
                  <button
                    key={c}
                    onClick={() => playChordByName(c)}
                    className="px-2 py-0.5 bg-white border border-[#808080] text-[10px] font-bold font-mono text-[#002fa7] hover:bg-[#c2d7f2] cursor-pointer"
                    title={`Tocar ${c}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 retro-scrollbar">
            {!title && !content ? (
              <div className="text-center text-gray-400 italic text-xs font-mono py-16 select-none">
                A pré-visualização aparece aqui enquanto você digita...
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                {title && (
                  <div className="font-bold text-sm font-mono text-black mb-0.5">{title}</div>
                )}
                {(artist || key || bpm) && (
                  <div className="text-xs font-mono text-gray-500 mb-4">
                    {[artist, key && `Tom: ${key}`, bpm && `${bpm} BPM`].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {previewLines.map((line, i) => (
                    <CifraLine key={i} line={line} onChordClick={playChordByName} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── MinhasCifras (root) ──────────────────────────────────────────────────────

type View = 'list' | 'edit' | 'view';

export const MinhasCifras: React.FC = () => {
  const [cifras, setCifras] = useState<CustomCifra[]>(loadCifras);
  const [view, setView] = useState<View>('list');
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeCifra = activeId ? cifras.find(c => c.id === activeId) ?? null : null;

  const handleSave = (cifra: CustomCifra) => {
    const updated = cifras.some(c => c.id === cifra.id)
      ? cifras.map(c => c.id === cifra.id ? cifra : c)
      : [...cifras, cifra];
    setCifras(updated);
    saveCifras(updated);
    setActiveId(cifra.id);
    setView('view');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta cifra permanentemente?')) return;
    const updated = cifras.filter(c => c.id !== id);
    setCifras(updated);
    saveCifras(updated);
    setActiveId(null);
    setView('list');
  };

  const openNew = () => { setActiveId(null); setView('edit'); };

  if (view === 'edit') {
    return (
      <CifraEditor
        initial={activeCifra ?? undefined}
        onSave={handleSave}
        onCancel={() => setView(activeCifra ? 'view' : 'list')}
        onDelete={activeCifra ? () => handleDelete(activeCifra.id) : undefined}
      />
    );
  }

  if (view === 'view' && activeCifra) {
    return (
      <CifraViewer
        cifra={activeCifra}
        onEdit={() => setView('edit')}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="winxp-gradient-blue text-white px-3 py-1.5 flex items-center justify-between select-none shrink-0">
        <span className="font-bold text-sm font-mono">Minhas Cifras</span>
        <button
          onClick={openNew}
          className="px-3 py-0.5 bg-[#228b22] text-white text-xs font-bold font-mono border border-[#1a6b1a] hover:bg-green-700 cursor-pointer"
        >
          + Nova Cifra
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 retro-scrollbar bg-[#ece9d8]">
        {cifras.length === 0 ? (
          <EmptyState onNew={openNew} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...cifras].reverse().map(cifra => (
              <CifraCard
                key={cifra.id}
                cifra={cifra}
                onView={() => { setActiveId(cifra.id); setView('view'); }}
                onEdit={() => { setActiveId(cifra.id); setView('edit'); }}
                onDelete={() => handleDelete(cifra.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
