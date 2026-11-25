import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/common.css'
import { useTheme } from '../styles/useTheme'

function ToolbarApp(): React.JSX.Element {
  useTheme()

  const handleTrigger = (ev: React.MouseEvent): void => {
    ev.preventDefault()
    ev.stopPropagation()
    window.translatorApi.triggerTranslateFromToolbar()
  }

  return (
    <div className="toolbar-wrap">
      <button
        type="button"
        className="toolbar-btn"
        title="翻译选中文本"
        onMouseDown={handleTrigger}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m5 8 6 6" />
          <path d="m4 14 6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="m22 22-5-10-5 10" />
          <path d="M14 18h6" />
        </svg>
      </button>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<ToolbarApp />)
}
