import { describe, expect, it } from 'vitest'
import { TranslatorEngine } from '../src/main/translator'
import { DEFAULT_CONFIG, type StreamEvent } from '../src/shared/types'

function createSseResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    }
  })
  return new Response(stream, { status: 200 })
}

describe('TranslatorEngine', () => {
  it('returns explicit error event when apiKey is missing for remote endpoint', async () => {
    const events: StreamEvent[] = []
    const engine = new TranslatorEngine(async () => createSseResponse([]))

    await engine.translateStream(
      { requestId: 'req-1', text: 'Hello', targetLanguage: 'auto' },
      { ...DEFAULT_CONFIG, apiKey: '' },
      (ev) => events.push(ev)
    )

    expect(events).toEqual([
      {
        type: 'error',
        requestId: 'req-1',
        message: '请先在设置中配置 API Key'
      }
    ])
  })

  it('streams SSE chunks, omits hardcoded temperature, and emits done event', async () => {
    const events: StreamEvent[] = []
    let capturedBody: Record<string, unknown> = {}
    const mockFetch: typeof fetch = async (_input, init) => {
      if (init && typeof init.body === 'string') {
        capturedBody = JSON.parse(init.body) as Record<string, unknown>
      }
      return createSseResponse([
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
        'data: [DONE]\n\n'
      ])
    }

    const engine = new TranslatorEngine(mockFetch)
    await engine.translateStream(
      { requestId: 'req-2', text: 'Hello', targetLanguage: '简体中文' },
      { ...DEFAULT_CONFIG, apiKey: 'sk-test' },
      (ev) => events.push(ev)
    )

    expect(capturedBody.temperature).toBeUndefined()
    expect(events).toEqual([
      { type: 'start', requestId: 'req-2', resolvedLanguage: '简体中文' },
      { type: 'chunk', requestId: 'req-2', delta: '你' },
      { type: 'chunk', requestId: 'req-2', delta: '好' },
      { type: 'done', requestId: 'req-2' }
    ])
  })

  it('aborts previous in-flight request when a new request starts concurrently', async () => {
    const signals: AbortSignal[] = []
    const mockFetch: typeof fetch = async (_input, init) => {
      if (init && init.signal) {
        signals.push(init.signal)
      }
      return new Promise<Response>((_resolve, reject) => {
        if (init && init.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }
      })
    }

    const engine = new TranslatorEngine(mockFetch)
    const firstEvents: StreamEvent[] = []
    const firstPromise = engine.translateStream(
      { requestId: 'req-a', text: 'First', targetLanguage: '简体中文' },
      { ...DEFAULT_CONFIG, apiKey: 'sk-test' },
      (ev) => firstEvents.push(ev)
    )

    engine.abortCurrent()
    await firstPromise

    expect(signals[0].aborted).toBe(true)
    expect(firstEvents.some((e) => e.type === 'error')).toBe(false)
  })

  it('fetches and sorts model IDs from /models endpoint', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'gpt-4o' }]
        }),
        { status: 200 }
      )
    const engine = new TranslatorEngine(mockFetch)
    const res = await engine.fetchModels({
      apiBaseUrl: 'https://api.openai.com/v1/',
      apiKey: 'sk-test'
    })
    expect(res).toEqual({ ok: true, value: ['gpt-4o', 'gpt-4o-mini'] })
  })

  it('returns explicit error when fetching models without API key on remote host', async () => {
    const engine = new TranslatorEngine(async () => new Response('{}', { status: 200 }))
    const res = await engine.fetchModels({
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: ''
    })
    expect(res.ok).toBe(false)
  })
})
