import { reglasComunes } from '@blog/config/eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: reglasComunes },
  // Límites de capas (constitucion.md §III.4; spec 003, T007): la clave de servicio y el subpath de
  // servidor no llegan a los componentes ni a nada fuera de las acciones.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/acciones/**', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/servicio', '**/lib/servicio.ts'],
              message: 'lib/servicio (clave de servicio) solo se importa desde src/acciones.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/componentes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@blog/db/servicio', '**/lib/servicio', '**/lib/servicio.ts'],
              message: 'Los componentes no importan la clave de servicio.',
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
