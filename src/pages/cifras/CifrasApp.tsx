import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ArtistList } from './ArtistList';
import { SongList } from './SongList';
import { CifraViewer } from './CifraViewer';

export const CifrasApp: React.FC = () => {
  return (
    <div className="w-full h-full bg-[var(--color-winxp-bg)] flex flex-col font-sans text-black relative">
      <Routes>
        <Route path="/" element={<Navigate to="/cifras" replace />} />
        <Route path="/cifras" element={<ArtistList />} />
        <Route path="/cifras/:artistSlug" element={<SongList />} />
        <Route path="/cifras/:artistSlug/*" element={<CifraViewer />} />
      </Routes>
    </div>
  );
};
