import base from '@blog/config/eslint';

export default [
  ...base,
  {
    // RF-003 (spec 002): ningún texto de un bloque se interpreta como marcado.
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Prohibido dangerouslySetInnerHTML: los bloques se renderizan siempre como texto (RF-003).',
        },
      ],
    },
  },
];
