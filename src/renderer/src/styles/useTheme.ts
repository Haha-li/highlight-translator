import { useEffect, useState } from 'react'
import { resolveEffectiveTheme } from '../../../shared/theme'
import type { ThemeMode } from '../../../shared/types'

export function useTheme(previewMode?: ThemeMode): void {
  const [storedMode, setStoredMode] = useState<ThemeMode>('system')
  const activeMode = previewMode ? previewMode : storedMode

  useEffect(() => {
    void window.translatorApi.getConfig().then((cfg) => {
      setStoredMode(cfg.theme)
    })
    return window.translatorApi.onConfigUpdated((cfg) => {
      setStoredMode(cfg.theme)
    })
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncDom = (): void => {
      document.documentElement.dataset.theme = resolveEffectiveTheme(activeMode, media.matches)
    }
    syncDom()
    media.addEventListener('change', syncDom)
    return () => media.removeEventListener('change', syncDom)
  }, [activeMode])
}
