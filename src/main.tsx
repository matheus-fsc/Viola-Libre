/*
 * Viola Libre — o cifrário aberto e matemático da música de raiz
 * Copyright (C) 2026 Matheus Coelho
 * Licenciado sob a GNU AGPL-3.0 — veja o arquivo LICENSE na raiz do projeto.
 */
import './zodConfig' // DEVE ser o primeiro import — ativa jitless antes de qualquer schema
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { CifraPrintPage } from './pages/cifras/CifraPrintPage.tsx'
import { registrarServiceWorker } from './registrarSW.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* A folha de impressão é a única rota que NÃO vive dentro da janela XP: barra de
          abas, barra de tarefas e moldura da janela não vão para o papel, e mantê-las
          montadas só para escondê-las com CSS deixaria os contêineres de rolagem delas
          no caminho da paginação. Por isso ela é irmã do App, não filha.

          A rota estática ganha do `path="*"` no ranking do React Router, então o App
          segue respondendo por todo o resto. */}
      <Routes>
        <Route path="/cifras/:artistSlug/:songSlug/print" element={<CifraPrintPage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

registrarServiceWorker()
