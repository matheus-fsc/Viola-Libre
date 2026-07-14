import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `scratch/` guarda scripts de experimentação (golden tests de acordes, etc.),
  // não é código da aplicação — não deve reprovar o CI.
  globalIgnores(['dist', 'scratch']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Permite marcar argumentos/variáveis intencionalmente não usados com `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Regras novas do React Compiler (react-hooks v7): apontam padrões que hoje
      // funcionam (reset de estado ao trocar de prop, refs carregando estado entre
      // renders). Mantidas como aviso — visíveis no editor/lint, mas não reprovam o
      // CI — para refatorar de forma incremental, sem risco de regressão agora.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
])
