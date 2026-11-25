import { resolveEffectiveTheme } from '../../../shared/theme'
import type { ThemeMode } from '../../../shared/types'
import '../styles/common.css'

let currentMode: ThemeMode = 'system'
const darkMedia = window.matchMedia('(prefers-color-scheme: dark)')

function syncToolbarTheme(): void {
  document.documentElement.dataset.theme = resolveEffectiveTheme(currentMode, darkMedia.matches)
}

syncToolbarTheme()
darkMedia.addEventListener('change', syncToolbarTheme)

void window.translatorApi.getConfig().then((cfg) => {
  currentMode = cfg.theme
  syncToolbarTheme()
})

window.translatorApi.onConfigUpdated((cfg) => {
  currentMode = cfg.theme
  syncToolbarTheme()
})

const root = document.getElementById('root')
if (root) {
  root.innerHTML = `
    <div class="toolbar-wrap">
      <button type="button" class="toolbar-btn" title="翻译选中文本" id="trigger-btn">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m5 8 6 6" />
          <path d="m4 14 6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="m22 22-5-10-5 10" />
          <path d="M14 18h6" />
        </svg>
      </button>
    </div>
  `
  const btn = document.getElementById('trigger-btn')
  if (btn) {
    btn.addEventListener('mousedown', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      window.translatorApi.triggerTranslateFromToolbar()
    })
  }
}
