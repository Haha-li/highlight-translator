import { clipboard, globalShortcut, screen } from 'electron'
import SelectionHook, { type TextSelectionData } from 'selection-hook'
import { decideSelectionAction } from '../shared/selectionFilter'
import type { Point, Result, SelectionPayload, TranslatorConfig } from '../shared/types'
import type { ConfigStore } from './store'
import type { WindowManager } from './windows'

export interface SelectionServiceDeps {
  store: ConfigStore
  windows: WindowManager
}

function toDipIfValid(raw: Point): Point | null {
  if (
    raw.x === SelectionHook.INVALID_COORDINATE ||
    raw.y === SelectionHook.INVALID_COORDINATE ||
    (raw.x === 0 && raw.y === 0)
  ) {
    return null
  }
  if (process.platform === 'darwin') {
    return { x: raw.x, y: raw.y }
  }
  return screen.screenToDipPoint({ x: raw.x, y: raw.y })
}

function resolveSelectionDipAnchor(data: TextSelectionData): Point {
  if (data.posLevel !== SelectionHook.PositionLevel.NONE) {
    const mouseEnd = toDipIfValid(data.mousePosEnd)
    if (mouseEnd) {
      return mouseEnd
    }
    if (data.posLevel >= SelectionHook.PositionLevel.SEL_FULL) {
      const endBottom = toDipIfValid(data.endBottom)
      if (endBottom) {
        return endBottom
      }
    }
  }
  return screen.getCursorScreenPoint()
}

export class SelectionService {
  private readonly store: ConfigStore
  private readonly windows: WindowManager
  private readonly hook: SelectionHook
  private ctrlPressed = false
  private registeredShortcut = ''
  private listenersBound = false

  constructor(deps: SelectionServiceDeps) {
    this.store = deps.store
    this.windows = deps.windows
    this.hook = new SelectionHook()
  }

  private bindHookListeners(): void {
    if (this.listenersBound) {
      return
    }
    this.listenersBound = true

    this.hook.on('key-down', (ev) => {
      if (ev.uniKey === 'Control') {
        this.ctrlPressed = true
      }
      if (ev.uniKey === 'Escape') {
        this.windows.hideToolbar()
      }
    })

    this.hook.on('key-up', (ev) => {
      if (ev.uniKey === 'Control') {
        this.ctrlPressed = false
      }
    })

    this.hook.on('mouse-down', (ev) => {
      const dip = toDipIfValid({ x: ev.x, y: ev.y })
      const checkPoint = dip ? dip : screen.getCursorScreenPoint()
      if (this.windows.isDipPointInsideToolbar(checkPoint)) {
        return
      }
      this.windows.hideToolbar()
    })

    this.hook.on('mouse-wheel', () => {
      this.windows.hideToolbar()
    })

    this.hook.on('text-selection', (data) => {
      this.handleSelection(data)
    })

    this.hook.on('error', (err) => {
      console.error('[SelectionService] Native hook error:', err)
    })
  }

  private handleSelection(data: TextSelectionData): void {
    const config = this.store.get()
    const decision = decideSelectionAction(
      {
        text: data.text,
        programName: data.programName,
        ctrlPressed: this.ctrlPressed
      },
      config
    )
    if (decision === 'ignore') {
      return
    }

    const payload: SelectionPayload = {
      text: data.text.trim(),
      anchor: resolveSelectionDipAnchor(data),
      programName: data.programName
    }

    if (decision === 'direct-translate') {
      this.windows.openTranslate(payload)
      return
    }
    this.windows.showToolbar(payload)
  }

  private applyShortcut(shortcut: string): Result<boolean> {
    if (this.registeredShortcut.length > 0) {
      globalShortcut.unregister(this.registeredShortcut)
      this.registeredShortcut = ''
    }
    const clean = shortcut.trim()
    if (clean.length === 0) {
      return { ok: true, value: true }
    }
    try {
      const ok = globalShortcut.register(clean, () => {
        this.triggerManualTranslate()
      })
      if (!ok) {
        return { ok: false, error: `全局快捷键 ${clean} 已被其他程序占用` }
      }
      this.registeredShortcut = clean
      return { ok: true, value: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `快捷键格式无效 (${clean}): ${msg}` }
    }
  }

  // not safe for concurrent calls: invoke on Electron main thread only
  public start(): Result<boolean> {
    this.bindHookListeners()
    return this.applyConfig(this.store.get())
  }

  // not safe for concurrent calls: invoke on Electron main thread only
  public applyConfig(config: TranslatorConfig): Result<boolean> {
    const shortcutResult = this.applyShortcut(config.shortcut)
    if (!config.enabled) {
      this.windows.hideToolbar()
      if (this.hook.isRunning()) {
        this.hook.stop()
      }
      return shortcutResult
    }

    if (this.hook.isRunning()) {
      this.hook.stop()
    }
    const started = this.hook.start({
      enableClipboard: config.enableClipboardFallback,
      globalFilterMode: SelectionHook.FilterMode.EXCLUDE_LIST,
      globalFilterList: config.blacklist
    })
    if (!started) {
      return { ok: false, error: '启动系统划词监听钩子失败' }
    }
    return shortcutResult
  }

  public triggerManualTranslate(): void {
    const current = this.hook.isRunning() ? this.hook.getCurrentSelection() : null
    const rawText = current && current.text.trim().length > 0 ? current.text : clipboard.readText()
    const trimmed = rawText.trim()
    if (trimmed.length === 0) {
      return
    }

    const anchor: Point = current
      ? resolveSelectionDipAnchor(current)
      : screen.getCursorScreenPoint()

    this.windows.openTranslate({
      text: trimmed,
      anchor,
      programName: current ? current.programName : 'manual-shortcut'
    })
  }

  public dispose(): void {
    if (this.registeredShortcut.length > 0) {
      globalShortcut.unregister(this.registeredShortcut)
      this.registeredShortcut = ''
    }
    this.hook.cleanup()
  }
}
