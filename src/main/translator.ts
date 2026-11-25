import { buildTranslateMessages, resolveTargetLanguage } from '../shared/language'
import type {
  FetchModelsParams,
  Result,
  StreamEvent,
  TranslateRequest,
  TranslatorConfig
} from '../shared/types'

const MODELS_TIMEOUT_MS = 10000

function isLocalEndpoint(url: string): boolean {
  return url.includes('://localhost') || url.includes('://127.0.0.1')
}

function validateCredentials(apiBaseUrl: string, apiKey: string): Result<string> {
  const base = apiBaseUrl.trim().replace(/\/+$/, '')
  if (base.length === 0) {
    return { ok: false, error: '请先在设置中配置 API Base URL' }
  }
  if (!isLocalEndpoint(base) && apiKey.trim().length === 0) {
    return { ok: false, error: '请先在设置中配置 API Key' }
  }
  return { ok: true, value: base }
}

function validateConfig(config: TranslatorConfig): Result<string> {
  const baseRes = validateCredentials(config.apiBaseUrl, config.apiKey)
  if (!baseRes.ok) {
    return baseRes
  }
  if (config.model.trim().length === 0) {
    return { ok: false, error: '请先在设置中配置模型名称' }
  }
  return { ok: true, value: `${baseRes.value}/chat/completions` }
}

function parseModelsPayload(rawText: string): Result<string[]> {
  try {
    const parsed = JSON.parse(rawText) as { data?: Array<{ id?: unknown }> }
    if (!Array.isArray(parsed.data)) {
      return { ok: false, error: '接口返回格式不包含有效的 data 模型数组' }
    }
    const ids = parsed.data
      .map((item) => (typeof item.id === 'string' ? item.id.trim() : ''))
      .filter((id) => id.length > 0)
    const uniqueSorted = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
    if (uniqueSorted.length === 0) {
      return { ok: false, error: '接口返回的可用模型列表为空' }
    }
    return { ok: true, value: uniqueSorted }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `解析模型列表失败: ${message}` }
  }
}

function extractDeltaFromJson(rawJson: string): Result<string> {
  try {
    const parsed = JSON.parse(rawJson) as {
      choices?: Array<{ delta?: { content?: string } }>
    }
    const first = parsed.choices && parsed.choices[0]
    const content = first && first.delta && first.delta.content
    return { ok: true, value: typeof content === 'string' ? content : '' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `SSE JSON 解析失败: ${message}` }
  }
}

function parseSseDataLine(line: string): Result<{ done: boolean; delta: string }> {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) {
    return { ok: true, value: { done: false, delta: '' } }
  }
  const payload = trimmed.slice(5).trim()
  if (payload === '[DONE]') {
    return { ok: true, value: { done: true, delta: '' } }
  }
  const extracted = extractDeltaFromJson(payload)
  if (!extracted.ok) {
    return extracted
  }
  return { ok: true, value: { done: false, delta: extracted.value } }
}

async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  requestId: string,
  onEvent: (ev: StreamEvent) => void
): Promise<Result<null>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() as string

    for (const line of lines) {
      const parsed = parseSseDataLine(line)
      if (!parsed.ok) {
        return parsed
      }
      if (parsed.value.done) {
        return { ok: true, value: null }
      }
      if (parsed.value.delta.length > 0) {
        onEvent({ type: 'chunk', requestId, delta: parsed.value.delta })
      }
    }
  }
  return { ok: true, value: null }
}

export class TranslatorEngine {
  private activeController: AbortController | null = null
  private readonly fetchImpl: typeof fetch

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl
  }

  // safe for concurrent calls: idempotent cancellation of active stream
  public abortCurrent(): void {
    if (!this.activeController) {
      return
    }
    this.activeController.abort()
    this.activeController = null
  }

  // safe for concurrent calls: aborts in-flight stream before starting a new one
  public async translateStream(
    req: TranslateRequest,
    config: TranslatorConfig,
    onEvent: (ev: StreamEvent) => void
  ): Promise<void> {
    const endpoint = validateConfig(config)
    if (!endpoint.ok) {
      onEvent({ type: 'error', requestId: req.requestId, message: endpoint.error })
      return
    }

    this.abortCurrent()
    const controller = new AbortController()
    this.activeController = controller

    const resolvedLanguage = resolveTargetLanguage(req.text, {
      requested: req.targetLanguage,
      primary: config.primaryLanguage,
      secondary: config.secondaryLanguage
    })
    onEvent({ type: 'start', requestId: req.requestId, resolvedLanguage })

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.apiKey.trim().length > 0) {
        headers.Authorization = `Bearer ${config.apiKey.trim()}`
      }
      const response = await this.fetchImpl(endpoint.value, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model.trim(),
          messages: buildTranslateMessages(req.text, resolvedLanguage),
          stream: true
        })
      })

      if (!response.ok || !response.body) {
        const detail = await response.text()
        onEvent({
          type: 'error',
          requestId: req.requestId,
          message: `翻译接口请求失败 (HTTP ${response.status}): ${detail.slice(0, 500)}`
        })
        return
      }

      const streamResult = await consumeSseStream(response.body, req.requestId, onEvent)
      if (!streamResult.ok) {
        onEvent({ type: 'error', requestId: req.requestId, message: streamResult.error })
        return
      }
      onEvent({ type: 'done', requestId: req.requestId })
    } catch (err) {
      // Intentional cancellation from user or newer selection is not an error
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      onEvent({ type: 'error', requestId: req.requestId, message: `网络请求异常: ${message}` })
    } finally {
      if (this.activeController === controller) {
        this.activeController = null
      }
    }
  }

  // safe for concurrent calls: stateless HTTP GET with bounded timeout
  public async fetchModels(params: FetchModelsParams): Promise<Result<string[]>> {
    const baseRes = validateCredentials(params.apiBaseUrl, params.apiKey)
    if (!baseRes.ok) {
      return baseRes
    }
    const headers: Record<string, string> = {}
    if (params.apiKey.trim().length > 0) {
      headers.Authorization = `Bearer ${params.apiKey.trim()}`
    }

    try {
      const response = await this.fetchImpl(`${baseRes.value}/models`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(MODELS_TIMEOUT_MS)
      })
      const rawText = await response.text()
      if (!response.ok) {
        return {
          ok: false,
          error: `获取模型列表失败 (HTTP ${response.status}): ${rawText.slice(0, 300)}`
        }
      }
      return parseModelsPayload(rawText)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `获取模型列表异常: ${message}` }
    }
  }
}
