import babelParser from '@babel/eslint-parser'
import globals from 'globals'
import pluginJs from '@eslint/js'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import pluginReactRefresh from 'eslint-plugin-react-refresh'

// JSX references are real variable usages, but ESLint core does not count
// component tags for no-unused-vars without a JSX-aware rule.
const jsxUsesVars = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    return {
      JSXOpeningElement(node) {
        let name = node.name
        while (name?.type === 'JSXMemberExpression') name = name.object
        if (name?.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name)) {
          context.sourceCode.markVariableAsUsed(name.name, node)
        }
      },
    }
  },
}

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        requireConfigFile: false,
        babelOptions: {
          presets: [['@babel/preset-react', { runtime: 'automatic' }]],
        },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'jsx-usage': { rules: { 'uses-vars': jsxUsesVars } },
      'react-hooks': pluginReactHooks,
      'react-refresh': pluginReactRefresh,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      'jsx-usage/uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
]