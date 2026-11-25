import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { StreamEvent, TargetLanguage } from '../../../shared/types'
import '../styles/common.css'
import { useTheme } from '../styles/useTheme'

const LANGUAGE_OPTIONS: Array<{ value: TargetLanguage; label: string }> = [
  { value: 'auto', label: '自动互译' },
  { value: '简体中文', label: '简体中文' },
  { value: 'English', label: 'English' },
  { value: '日本語', label: '日本語' },
  { value: '한국어', label: '한국어' },
  { value: 'Français', label: 'Français' },
  { value: 'Deutsch', label: 'Deutsch' }
]

function TranslateApp(): React.JSX.Element {
  useTheme()
  const [sourceText, setSourceText] = useState('')
  const [targetLang, setTargetLang] = useState<TargetLanguage>('auto')
  const [resolvedLang, setResolvedLang] = useState('')
  const [translated, setTranslated] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [pinned, setPinned] = useState(false)
  const [expandedSource, setExpandedSource] = useState(false)
  const [copied, setCopied] = useState(false)
  const activeReqId = useRef('')

  const runTranslation = useCallback((text: string, lang: TargetLanguage): void => {
    if (text.trim().length === 0) {
      return
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    activeReqId.current = requestId
    setTranslated('')
    setErrorMsg('')
    setStreaming(true)
    void window.translatorApi.startTranslate({
      requestId,
      text,
      targetLanguage: lang
    })
  }, [])

  useEffect(() => {
    const offOpen = window.translatorApi.onTranslateOpen((payload) => {
      setSourceText(payload.text)
      setExpandedSource(false)
      runTranslation(payload.text, targetLang)
    })

    const offStream = window.translatorApi.onStreamEvent((ev: StreamEvent) => {
      if (ev.requestId !== activeReqId.current) {
        return
      }
      if (ev.type === 'start') {
        setResolvedLang(ev.resolvedLanguage)
        return
      }
      if (ev.type === 'chunk') {
        setTranslated((prev) => prev + ev.delta)
        return
      }
      if (ev.type === 'done') {
        setStreaming(false)
        return
      }
      setStreaming(false)
      setErrorMsg(ev.message)
    })

    return () => {
      offOpen()
      offStream()
    }
  }, [runTranslation, targetLang])

  const handleLanguageChange = (next: TargetLanguage): void => {
    setTargetLang(next)
    runTranslation(sourceText, next)
  }

  const togglePin = (): void => {
    const next = !pinned
    setPinned(next)
    void window.translatorApi.setPinned(next)
  }

  const handleCopy = (): void => {
    if (translated.length === 0) {
      return
    }
    void window.translatorApi.copyText(translated).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <div className="translate-card">
      <header className="card-header">
        <div className="header-left">
          <select
            className="lang-select"
            value={targetLang}
            onChange={(e) => handleLanguageChange(e.target.value as TargetLanguage)}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {resolvedLang.length > 0 && <span className="badge">→ {resolvedLang}</span>}
        </div>
        <div className="header-right">
          <button
            type="button"
            className={`icon-btn ${pinned ? 'active' : ''}`}
            title={pinned ? '取消固定窗口' : '固定窗口 (失焦不关闭)'}
            onClick={togglePin}
          >
            📌
          </button>
          <button
            type="button"
            className="icon-btn"
            title="关闭"
            onClick={() => void window.translatorApi.closeTranslate()}
          >
            ✕
          </button>
        </div>
      </header>

      <div
        className="source-bar"
        title="点击展开/折叠原文"
        onClick={() => setExpandedSource((prev) => !prev)}
      >
        <div className={expandedSource ? 'source-text-expanded' : 'source-text-collapsed'}>
          {sourceText}
        </div>
      </div>

      <main className="result-area">
        {errorMsg.length > 0 ? (
          <div className="error-box">{errorMsg}</div>
        ) : (
          <>
            <span>{translated}</span>
            {streaming && <span className="cursor-blink" />}
          </>
        )}
      </main>

      <footer className="card-footer">
        <span>{sourceText.length} 字符</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="action-btn"
            onClick={() => runTranslation(sourceText, targetLang)}
          >
            重试
          </button>
          <button type="button" className="action-btn" onClick={handleCopy}>
            {copied ? '已复制 ✓' : '复制译文'}
          </button>
        </div>
      </footer>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<TranslateApp />)
}
