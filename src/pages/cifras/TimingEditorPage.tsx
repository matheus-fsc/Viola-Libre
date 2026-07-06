import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCifra, type CifraDetail } from '../../services/api';
import { TimingEditor } from '../../components/TimingEditor';
import type { TimingContribution } from '../../services/timingApi';

const previewKey = (slug: string) => `viola_preview_timing_${slug}`;

export const TimingEditorPage: React.FC = () => {
  const { artistSlug, songSlug } = useParams<{ artistSlug: string; songSlug: string }>();
  const navigate = useNavigate();

  const [cifra, setCifra] = useState<CifraDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artistSlug || !songSlug) return;
    setLoading(true);
    getCifra(artistSlug, songSlug)
      .then(setCifra)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [artistSlug, songSlug]);

  const lines = useMemo(() => {
    if (!cifra) return [];
    return cifra.content_html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .split('\n');
  }, [cifra]);

  const handlePreviewTiming = (t: TimingContribution | null) => {
    if (!songSlug) return;
    if (t) {
      localStorage.setItem(previewKey(songSlug), JSON.stringify(t));
      navigate(`/cifras/${artistSlug}/${songSlug}`);
    } else {
      localStorage.removeItem(previewKey(songSlug));
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-winxp-bg)] p-2 gap-2 overflow-hidden">
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center justify-between font-bold text-sm shrink-0">
        <span className="truncate">
          ✏️ Contribuir Timing{cifra ? ` — ${cifra.title}` : ''}
        </span>
        <button
          onClick={() => navigate(`/cifras/${artistSlug}/${songSlug}`)}
          className="bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0 text-xs active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white shrink-0 ml-2"
        >
          ← Voltar à cifra
        </button>
      </div>

      {loading && (
        <p className="text-xs text-gray-500 text-center py-10">Carregando cifra...</p>
      )}

      {!loading && !cifra && (
        <p className="text-xs text-[#cc3300] text-center py-10">Cifra não encontrada.</p>
      )}

      {!loading && cifra && (
        <div className="flex-1 min-h-0">
          <TimingEditor
            slug={songSlug || ''}
            lines={lines}
            onPreviewTiming={handlePreviewTiming}
          />
        </div>
      )}
    </div>
  );
};
