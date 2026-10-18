// Config ESLint compartida (constitucion.md §III, packages/config).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Convenciones comunes del monorepo. Las apps que traen sus propios presets
 * (eslint-config-next ya registra typescript-eslint) solo suman estas reglas.
 */
export const reglasComunes = {
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  '@typescript-eslint/consistent-type-imports': 'error',
  'no-console': ['error', { allow: ['warn', 'error'] }],
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '**/tipos.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: reglasComunes },
);
