import type { ThemeMode } from './types'

export type EffectiveTheme = 'light' | 'dark'

export function resolveEffectiveTheme(mode: ThemeMode, prefersDark: boolean): EffectiveTheme {
  if (mode === 'light' || mode === 'dark') {
    return mode
  }
  return prefersDark ? 'dark' : 'light'
}
