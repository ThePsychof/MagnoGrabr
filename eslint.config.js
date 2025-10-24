import { defineConfig } from 'eslint/config'
import parser from '@typescript-eslint/parser'

// Valid flat config: pass parser object (not a string) in languageOptions
export default defineConfig([
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json'
      }
    },
    env: { browser: true, es2021: true },
    rules: {
      'no-console': 'off'
    }
  }
])
