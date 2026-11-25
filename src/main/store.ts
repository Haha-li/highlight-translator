import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DEFAULT_CONFIG, type Result, type TranslatorConfig } from '../shared/types'

function sanitizeConfig(raw: Partial<TranslatorConfig>): TranslatorConfig {
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_CONFIG.enabled,
    theme:
      raw.theme === 'system' || raw.theme === 'light' || raw.theme === 'dark'
        ? raw.theme
        : DEFAULT_CONFIG.theme,
    triggerMode:
      raw.triggerMode === 'toolbar' || raw.triggerMode === 'direct' || raw.triggerMode === 'ctrl'
        ? raw.triggerMode
        : DEFAULT_CONFIG.triggerMode,
    shortcut:
      typeof raw.shortcut === 'string' && raw.shortcut.trim().length > 0
        ? raw.shortcut.trim()
        : DEFAULT_CONFIG.shortcut,
    enableClipboardFallback:
      typeof raw.enableClipboardFallback === 'boolean'
        ? raw.enableClipboardFallback
        : DEFAULT_CONFIG.enableClipboardFallback,
    blacklist: Array.isArray(raw.blacklist)
      ? raw.blacklist.filter((item): item is string => typeof item === 'string')
      : DEFAULT_CONFIG.blacklist,
    apiBaseUrl:
      typeof raw.apiBaseUrl === 'string' ? raw.apiBaseUrl : DEFAULT_CONFIG.apiBaseUrl,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : DEFAULT_CONFIG.apiKey,
    model: typeof raw.model === 'string' ? raw.model : DEFAULT_CONFIG.model,
    availableModels: Array.isArray(raw.availableModels)
      ? raw.availableModels.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : DEFAULT_CONFIG.availableModels,
    primaryLanguage: raw.primaryLanguage ? raw.primaryLanguage : DEFAULT_CONFIG.primaryLanguage,
    secondaryLanguage: raw.secondaryLanguage
      ? raw.secondaryLanguage
      : DEFAULT_CONFIG.secondaryLanguage
  }
}

export class ConfigStore {
  private readonly filePath: string
  private cached: TranslatorConfig
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath: string) {
    this.filePath = filePath
    this.cached = this.loadFromDisk()
  }

  private loadFromDisk(): TranslatorConfig {
    if (!existsSync(this.filePath)) {
      return { ...DEFAULT_CONFIG }
    }
    try {
      const rawText = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(rawText) as Partial<TranslatorConfig>
      return sanitizeConfig(parsed)
    } catch (err) {
      console.error('[ConfigStore] Failed to parse config file, using defaults:', err)
      return { ...DEFAULT_CONFIG }
    }
  }

  // safe for concurrent calls: returns shallow copy of immutable snapshot
  public get(): TranslatorConfig {
    return {
      ...this.cached,
      blacklist: [...this.cached.blacklist],
      availableModels: [...this.cached.availableModels]
    }
  }

  // safe for concurrent calls: serializes disk writes via writeChain
  public async save(next: TranslatorConfig): Promise<Result<TranslatorConfig>> {
    const sanitized = sanitizeConfig(next)
    this.cached = sanitized

    const task = this.writeChain.then(async () => {
      mkdirSync(dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(sanitized, null, 2), 'utf-8')
    })
    // Keep queue alive even if one write fails
    this.writeChain = task.catch(() => undefined)

    try {
      await task
      return { ok: true, value: this.get() }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `保存配置文件失败: ${message}` }
    }
  }
}
