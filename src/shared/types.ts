export type TriggerMode = 'toolbar' | 'direct' | 'ctrl'

export type ThemeMode = 'system' | 'light' | 'dark'

export type TargetLanguage = 'auto' | '简体中文' | 'English' | '日本語' | '한국어' | 'Français' | 'Deutsch'

export interface TranslatorConfig {
  enabled: boolean
  theme: ThemeMode
  triggerMode: TriggerMode
  shortcut: string
  enableClipboardFallback: boolean
  blacklist: string[]
  apiBaseUrl: string
  apiKey: string
  model: string
  availableModels: string[]
  primaryLanguage: Exclude<TargetLanguage, 'auto'>
  secondaryLanguage: Exclude<TargetLanguage, 'auto'>
}

export interface FetchModelsParams {
  apiBaseUrl: string
  apiKey: string
}

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface DisplayMetrics {
  workArea: Rect
  scaleFactor: number
}

export interface SelectionPayload {
  text: string
  anchor: Point
  programName: string
}

export interface TranslateRequest {
  requestId: string
  text: string
  targetLanguage: TargetLanguage
}

export type StreamEvent =
  | { type: 'start'; requestId: string; resolvedLanguage: string }
  | { type: 'chunk'; requestId: string; delta: string }
  | { type: 'done'; requestId: string }
  | { type: 'error'; requestId: string; message: string }

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export const DEFAULT_CONFIG: TranslatorConfig = {
  enabled: true,
  theme: 'system',
  triggerMode: 'toolbar',
  shortcut: 'Alt+Q',
  enableClipboardFallback: true,
  blacklist: ['valorant.exe', 'cs2.exe', 'league of legends.exe'],
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  availableModels: ['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'qwen2.5:7b'],
  primaryLanguage: '简体中文',
  secondaryLanguage: 'English'
}

export const IPC_CHANNELS = {
  TOOLBAR_SHOW: 'toolbar:show',
  TOOLBAR_TRIGGER_TRANSLATE: 'toolbar:trigger-translate',
  TOOLBAR_HIDE: 'toolbar:hide',
  TRANSLATE_OPEN: 'translate:open',
  TRANSLATE_START: 'translate:start',
  TRANSLATE_ABORT: 'translate:abort',
  TRANSLATE_STREAM: 'translate:stream',
  TRANSLATE_PIN: 'translate:pin',
  TRANSLATE_CLOSE: 'translate:close',
  CLIPBOARD_WRITE: 'clipboard:write',
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',
  CONFIG_UPDATED: 'config:updated',
  MODELS_FETCH: 'models:fetch'
} as const
