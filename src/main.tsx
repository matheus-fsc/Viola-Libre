/*
 * Viola Libre — o cifrário aberto e matemático da música de raiz
 * Copyright (C) 2026 Matheus Coelho
 * Licenciado sob a GNU AGPL-3.0 — veja o arquivo LICENSE na raiz do projeto.
 */
import './zodConfig' // DEVE ser o primeiro import — ativa jitless antes de qualquer schema
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
