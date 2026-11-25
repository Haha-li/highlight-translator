import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  DEFAULT_CONFIG,
  type TargetLanguage,
  type ThemeMode,
  type TranslatorConfig,
  type TriggerMode
} from '../../../shared/types'
import '../styles/common.css'
import { useTheme } from '../styles/useTheme'

const LANG_CHOICES: Array<Exclude<TargetLanguage, 'auto'>> = [
  '简体中文',
  'English',
  '日本語',
  '한국어',
  'Français',
  'Deutsch'
]

const API_PRESETS = [
  {
    label: 'OpenAI',
    url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1']
  },
  {
    label: 'DeepSeek',
    url: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    label: 'Ollama 本地',
    url: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
    models: ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b']
  }
]

function mergeModelOptions(available: string[], current: string): string[] {
  const trimmed = current.trim()
  if (trimmed.length === 0 || available.includes(trimmed)) {
    return available
  }
  return [trimmed, ...available]
}

function SettingsApp(): React.JSX.Element {
  const [config, setConfig] = useState<TranslatorConfig>(DEFAULT_CONFIG)
  const [blacklistText, setBlacklistText] = useState(DEFAULT_CONFIG.blacklist.join('\n'))
  const [manualModelInput, setManualModelInput] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  useTheme(config.theme)

  useEffect(() => {
    void window.translatorApi.getConfig().then((loaded) => {
      setConfig(loaded)
      setBlacklistText(loaded.blacklist.join('\n'))
    })
  }, [])

  const modelOptions = useMemo(
    () => mergeModelOptions(config.availableModels, config.model),
    [config.availableModels, config.model]
  )

  const updateField = <K extends keyof TranslatorConfig>(
    key: K,
    value: TranslatorConfig[K]
  ): void => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleFetchModels = async (): Promise<void> => {
    setFetchingModels(true)
    setStatus(null)
    const res = await window.translatorApi.fetchModels({
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey
    })
    setFetchingModels(false)

    if (!res.ok) {
      setStatus({ ok: false, text: res.error })
      return
    }
    const nextModel = res.value.includes(config.model) ? config.model : res.value[0]
    setConfig((prev) => ({
      ...prev,
      availableModels: res.value,
      model: nextModel
    }))
    setManualModelInput(false)
    setStatus({ ok: true, text: `已从接口获取 ${res.value.length} 个可用模型` })
  }

  const handleSave = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault()
    const blacklist = blacklistText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    const result = await window.translatorApi.saveConfig({ ...config, blacklist })
    if (!result.ok) {
      setStatus({ ok: false, text: result.error })
      return
    }
    setConfig(result.value)
    setStatus({ ok: true, text: '设置已保存并立即生效' })
  }

  return (
    <form className="settings-container" onSubmit={(e) => void handleSave(e)}>
      <section className="settings-section">
        <div className="section-title">外观与划词触发</div>
        <div className="field-row">
          <label className="field-label">界面主题</label>
          <select
            className="text-input"
            value={config.theme}
            onChange={(e) => updateField('theme', e.target.value as ThemeMode)}
          >
            <option value="system">跟随系统自动切换</option>
            <option value="light">浅色模式 (Light)</option>
            <option value="dark">深色模式 (Dark)</option>
          </select>
        </div>

        <div className="field-inline">
          <span className="field-label">启用系统全局划词监听</span>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateField('enabled', e.target.checked)}
          />
        </div>

        <div className="field-row">
          <label className="field-label">触发方式</label>
          <select
            className="text-input"
            value={config.triggerMode}
            onChange={(e) => updateField('triggerMode', e.target.value as TriggerMode)}
          >
            <option value="toolbar">划词后弹出小图标，点击后翻译（推荐）</option>
            <option value="direct">划词后直接弹出翻译卡片</option>
            <option value="ctrl">按住 Ctrl 键划词时弹出小图标</option>
          </select>
        </div>

        <div className="field-row">
          <label className="field-label">全局直译快捷键（直接翻译选中文本或剪贴板）</label>
          <input
            className="text-input"
            value={config.shortcut}
            placeholder="例如 Alt+Q 或 CommandOrControl+Shift+T"
            onChange={(e) => updateField('shortcut', e.target.value)}
          />
        </div>

        <div className="field-inline">
          <span className="field-label">启用剪贴板兜底取词（兼容不支持 UIA 的旧版应用）</span>
          <input
            type="checkbox"
            checked={config.enableClipboardFallback}
            onChange={(e) => updateField('enableClipboardFallback', e.target.checked)}
          />
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">翻译模型接口（OpenAI 兼容流式 API）</div>
        <div className="preset-row">
          {API_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="preset-chip"
              onClick={() => {
                setConfig((prev) => ({
                  ...prev,
                  apiBaseUrl: preset.url,
                  model: preset.model,
                  availableModels: preset.models
                }))
                setManualModelInput(false)
              }}
            >
              填入 {preset.label}
            </button>
          ))}
        </div>

        <div className="field-row">
          <label className="field-label">API Base URL</label>
          <input
            className="text-input"
            value={config.apiBaseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => updateField('apiBaseUrl', e.target.value)}
          />
        </div>

        <div className="field-row">
          <label className="field-label">API Key（本地 Ollama 可留空）</label>
          <input
            type="password"
            className="text-input"
            value={config.apiKey}
            placeholder="sk-..."
            onChange={(e) => updateField('apiKey', e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field-inline">
            <label className="field-label">选择模型</label>
            <div className="preset-row">
              <button
                type="button"
                className="preset-chip"
                disabled={fetchingModels}
                onClick={() => void handleFetchModels()}
              >
                {fetchingModels ? '拉取中...' : '从接口获取模型列表'}
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() => setManualModelInput((prev) => !prev)}
              >
                {manualModelInput ? '切换下拉选择' : '手动输入'}
              </button>
            </div>
          </div>

          {manualModelInput || modelOptions.length === 0 ? (
            <input
              className="text-input"
              value={config.model}
              placeholder="输入模型 ID，例如 gpt-4o-mini"
              onChange={(e) => updateField('model', e.target.value)}
            />
          ) : (
            <select
              className="text-input"
              value={config.model}
              onChange={(e) => updateField('model', e.target.value)}
            >
              {modelOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="field-row">
            <label className="field-label">首选目标语言（外译中默认）</label>
            <select
              className="text-input"
              value={config.primaryLanguage}
              onChange={(e) =>
                updateField('primaryLanguage', e.target.value as Exclude<TargetLanguage, 'auto'>)
              }
            >
              {LANG_CHOICES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <label className="field-label">备选互译语言（中译外默认）</label>
            <select
              className="text-input"
              value={config.secondaryLanguage}
              onChange={(e) =>
                updateField('secondaryLanguage', e.target.value as Exclude<TargetLanguage, 'auto'>)
              }
            >
              {LANG_CHOICES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">忽略进程黑名单（每行一个可执行文件名）</div>
        <textarea
          className="textarea-input"
          rows={3}
          value={blacklistText}
          onChange={(e) => setBlacklistText(e.target.value)}
        />
      </section>

      <button type="submit" className="primary-btn">
        保存设置
      </button>

      {status && (
        <div className={`status-msg ${status.ok ? 'status-ok' : 'status-err'}`}>{status.text}</div>
      )}
    </form>
  )
}

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<SettingsApp />)
}
