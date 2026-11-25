import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { computePopupPosition } from '../shared/positioning'
import {
  IPC_CHANNELS,
  type Point,
  type SelectionPayload,
  type Size,
  type StreamEvent,
  type TranslatorConfig
} from '../shared/types'

const TOOLBAR_SIZE: Size = { width: 34, height: 34 }
const TRANSLATE_SIZE: Size = { width: 380, height: 310 }
const SETTINGS_SIZE: Size = { width: 520, height: 640 }
const IDLE_RECLAIM_MS = 25000

function loadRendererPage(win: BrowserWindow, htmlFile: string): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl && devUrl.length > 0) {
    void win.loadURL(`${devUrl}/${htmlFile}`)
    return
  }
  void win.loadFile(join(__dirname, `../renderer/${htmlFile}`))
}

function applyPopupBounds(win: BrowserWindow, dipAnchor: Point, size: Size, focus: boolean): void {
  const display = screen.getDisplayNearestPoint(dipAnchor)
  const pos = computePopupPosition(dipAnchor, size, display.workArea)
  const targetBounds = { x: pos.x, y: pos.y, width: size.width, height: size.height }
  win.setBounds(targetBounds)
  if (focus) {
    win.show()
    win.focus()
  } else {
    win.showInactive()
  }
  // Re-apply bounds after show to prevent Windows cross-DPI monitor scaling drift
  win.setBounds(targetBounds)
}

export class WindowManager {
  private toolbarWin: BrowserWindow | null = null
  private translateWin: BrowserWindow | null = null
  private settingsWin: BrowserWindow | null = null
  private latestSelection: SelectionPayload | null = null
  private isTranslatePinned = false
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private readonly onTranslateBlurClose: () => void

  constructor(onTranslateBlurClose: () => void) {
    this.onTranslateBlurClose = onTranslateBlurClose
  }

  private preloadPath(): string {
    return join(__dirname, '../preload/index.js')
  }

  private cancelIdleReclaim(): void {
    if (!this.idleTimer) {
      return
    }
    clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  private scheduleIdleReclaim(): void {
    this.cancelIdleReclaim()
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      this.reclaimHiddenPopups()
    }, IDLE_RECLAIM_MS)
  }

  private reclaimHiddenPopups(): void {
    const toolbarVisible = Boolean(
      this.toolbarWin && !this.toolbarWin.isDestroyed() && this.toolbarWin.isVisible()
    )
    const translateVisible = Boolean(
      this.translateWin && !this.translateWin.isDestroyed() && this.translateWin.isVisible()
    )
    if (toolbarVisible || translateVisible) {
      return
    }
    if (this.toolbarWin && !this.toolbarWin.isDestroyed()) {
      this.toolbarWin.destroy()
      this.toolbarWin = null
    }
    if (this.translateWin && !this.translateWin.isDestroyed()) {
      this.translateWin.destroy()
      this.translateWin = null
    }
  }

  private ensureToolbarWindow(): BrowserWindow {
    if (this.toolbarWin && !this.toolbarWin.isDestroyed()) {
      return this.toolbarWin
    }
    const win = new BrowserWindow({
      width: TOOLBAR_SIZE.width,
      height: TOOLBAR_SIZE.height,
      frame: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      roundedCorners: true,
      show: false,
      backgroundColor: '#1e2028',
      webPreferences: {
        preload: this.preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    loadRendererPage(win, 'toolbar.html')
    this.toolbarWin = win
    return win
  }

  private ensureTranslateWindow(): BrowserWindow {
    if (this.translateWin && !this.translateWin.isDestroyed()) {
      return this.translateWin
    }
    const win = new BrowserWindow({
      width: TRANSLATE_SIZE.width,
      height: TRANSLATE_SIZE.height,
      minWidth: 320,
      minHeight: 220,
      frame: false,
      resizable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      roundedCorners: true,
      show: false,
      backgroundColor: '#1e2028',
      webPreferences: {
        preload: this.preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    win.setAlwaysOnTop(true, 'pop-up-menu')
    win.on('blur', () => {
      if (this.isTranslatePinned) {
        return
      }
      win.hide()
      this.onTranslateBlurClose()
      this.scheduleIdleReclaim()
    })
    loadRendererPage(win, 'translate.html')
    this.translateWin = win
    return win
  }

  // not safe for concurrent calls: main-thread UI window operation only
  public showToolbar(payload: SelectionPayload): void {
    this.cancelIdleReclaim()
    this.latestSelection = payload
    const win = this.ensureToolbarWindow()

    const reveal = (): void => {
      if (win.isDestroyed()) {
        return
      }
      applyPopupBounds(win, payload.anchor, TOOLBAR_SIZE, false)
      win.webContents.send(IPC_CHANNELS.TOOLBAR_SHOW, payload)
    }

    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', reveal)
      return
    }
    reveal()
  }

  public hideToolbar(): void {
    if (!this.toolbarWin || this.toolbarWin.isDestroyed() || !this.toolbarWin.isVisible()) {
      return
    }
    this.toolbarWin.hide()
    this.scheduleIdleReclaim()
  }

  public isDipPointInsideToolbar(dipPoint: Point): boolean {
    if (!this.toolbarWin || this.toolbarWin.isDestroyed() || !this.toolbarWin.isVisible()) {
      return false
    }
    const bounds = this.toolbarWin.getBounds()
    return (
      dipPoint.x >= bounds.x &&
      dipPoint.x <= bounds.x + bounds.width &&
      dipPoint.y >= bounds.y &&
      dipPoint.y <= bounds.y + bounds.height
    )
  }

  public openTranslateFromLatest(): void {
    if (!this.latestSelection) {
      return
    }
    this.openTranslate(this.latestSelection)
  }

  // not safe for concurrent calls: main-thread UI window operation only
  public openTranslate(payload: SelectionPayload): void {
    this.cancelIdleReclaim()
    this.latestSelection = payload
    if (this.toolbarWin && !this.toolbarWin.isDestroyed() && this.toolbarWin.isVisible()) {
      this.toolbarWin.hide()
    }
    const win = this.ensureTranslateWindow()
    const currentBounds = win.getBounds()
    const targetSize: Size = { width: currentBounds.width, height: currentBounds.height }

    const dispatchPayload = (): void => {
      if (win.isDestroyed()) {
        return
      }
      applyPopupBounds(win, payload.anchor, targetSize, true)
      win.webContents.send(IPC_CHANNELS.TRANSLATE_OPEN, payload)
    }

    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', dispatchPayload)
      return
    }
    dispatchPayload()
  }

  public setTranslatePinned(pinned: boolean): void {
    this.isTranslatePinned = pinned
  }

  public hideTranslate(): void {
    if (!this.translateWin || this.translateWin.isDestroyed()) {
      return
    }
    this.isTranslatePinned = false
    this.translateWin.hide()
    this.onTranslateBlurClose()
    this.scheduleIdleReclaim()
  }

  public sendStreamEvent(event: StreamEvent): void {
    if (!this.translateWin || this.translateWin.isDestroyed()) {
      return
    }
    this.translateWin.webContents.send(IPC_CHANNELS.TRANSLATE_STREAM, event)
  }

  public broadcastConfigUpdated(config: TranslatorConfig): void {
    const targets = [this.toolbarWin, this.translateWin, this.settingsWin]
    for (const win of targets) {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.CONFIG_UPDATED, config)
      }
    }
  }

  public openSettings(): void {
    if (this.settingsWin && !this.settingsWin.isDestroyed()) {
      this.settingsWin.show()
      this.settingsWin.focus()
      return
    }
    const win = new BrowserWindow({
      width: SETTINGS_SIZE.width,
      height: SETTINGS_SIZE.height,
      title: '划词翻译设置',
      autoHideMenuBar: true,
      resizable: false,
      webPreferences: {
        preload: this.preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    loadRendererPage(win, 'settings.html')
    win.on('closed', () => {
      this.settingsWin = null
    })
    this.settingsWin = win
  }

  public destroyAll(): void {
    this.cancelIdleReclaim()
    const list = [this.toolbarWin, this.translateWin, this.settingsWin]
    for (const win of list) {
      if (win && !win.isDestroyed()) {
        win.destroy()
      }
    }
  }
}
