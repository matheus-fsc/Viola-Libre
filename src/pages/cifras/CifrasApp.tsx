import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ArtistList } from './ArtistList';
import { SongList } from './SongList';
import { CifraViewer } from './CifraViewer';
import { TimingEditorPage } from './TimingEditorPage';

export const CifrasApp: React.FC = () => {
  return (
    <div className="w-full h-full bg-[var(--color-winxp-bg)] flex flex-col font-sans text-black relative">
      <Routes>
        <Route path="/cifras" element={<ArtistList />} />
        <Route path="/cifras/:artistSlug" element={<SongList />} />
        <Route path="/cifras/:artistSlug/:songSlug/timing" element={<TimingEditorPage />} />
        <Route path="/cifras/:artistSlug/*" element={<CifraViewer />} />
        {/* Rota desconhecida: tabFromPathname já a trouxe pra aba de cifras, mas nenhuma
            rota daqui casava e a janela abria vazia. Manda pro explorador.
            Seguro porque CifrasApp só monta quando activeTab === 'cifras'. */}
        <Route path="*" element={<Navigate to="/cifras" replace />} />
      </Routes>
    </div>
  );
};
