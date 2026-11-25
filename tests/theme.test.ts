import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigStore } from '../src/main/store'
import { resolveEffectiveTheme } from '../src/shared/theme'

describe('theme resolution and config persistence', () => {
  it('resolves explicit light and dark modes directly', () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light')
    expect(resolveEffectiveTheme('dark', false)).toBe('dark')
  })

  it('resolves system mode according to OS prefersDark media state', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark')
    expect(resolveEffectiveTheme('system', false)).toBe('light')
  })

  it('falls back to system theme when loading legacy config without theme field', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ht-theme-test-'))
    const cfgPath = join(tempDir, 'config.json')
    try {
      writeFileSync(cfgPath, JSON.stringify({ enabled: true, model: 'gpt-4o-mini' }), 'utf-8')
      const store = new ConfigStore(cfgPath)
      expect(store.get().theme).toBe('system')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
