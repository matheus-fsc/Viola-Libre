import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ArtistList } from './ArtistList';
import { SongList } from './SongList';
import { CifraViewer } from './CifraViewer';

export const CifrasApp: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 w-full h-full bg-[var(--color-winxp-bg)] flex flex-col font-sans text-black relative">
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ArtistList />} />
          <Route path="/:artistSlug" element={<SongList />} />
          <Route path="/:artistSlug/*" element={<CifraViewer />} />
        </Routes>
      </MemoryRouter>
    </div>
  );
};
