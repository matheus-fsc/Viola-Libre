import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { z } from 'zod'
import './index.css'
import App from './App.tsx'

// CSP estrita (script-src 'self', sem 'unsafe-eval') bloqueia o probe de JIT
// do Zod v4. jitless: true pula o probe e evita o report de CSP no console;
// a validação segue no modo interpretado.
z.config({ jitless: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
