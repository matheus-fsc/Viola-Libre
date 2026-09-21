import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode, command }) => {
  // Prefixo 'VITE_' e não '': com o prefixo vazio, `loadEnv` traz para dentro da
  // configuração TODA variável de ambiente do build — inclusive a chave interna, que
  // abre /api/internal/* e nunca deveria estar ao alcance daqui. Hoje nada a repassa
  // ao bundle, mas a distância entre "carregada na config" e "publicada no JavaScript"
  // é um `define` distraído. Restringir na entrada custa nada e tira a possibilidade.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // A chave pública falha de um jeito traiçoeiro: sem ela o build passa, o site sobe e
  // funciona para leitura, e só as escritas (view, favorito, dificuldade, sync) voltam
  // 403 — sem erro visível em lugar nenhum. Foi o que a renomeação para
  // VIOLA_PUBLIC_KEY (sem o prefixo VITE_) provocou em 21/09/2026.
  //
  // Aviso, e não erro: o CI roda `npm run build` sem segredo nenhum a cada PR, então
  // abortar aqui reprovaria toda a integração por um motivo que não é do código.
  if (command === 'build' && !env.VITE_VIOLA_PUBLIC_KEY) {
    console.warn(
      [
        '',
        '[vite] ATENÇÃO: VITE_VIOLA_PUBLIC_KEY ausente neste build.',
        '       As rotas de escrita da API vão responder 403 em produção.',
        '       Se este for um build de deploy, confira o nome da variável no',
        '       Cloudflare Pages — o prefixo VITE_ é obrigatório.',
        '',
      ].join('\n'),
    );
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
        }
      }
    }
  }
})

