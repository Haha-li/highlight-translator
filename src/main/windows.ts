import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { computePopupPosition, physicalToDip } from '../shared/positioning'
import {
  IPC_CHANNELS,
  type DisplayMetrics,
  type Point,
  type SelectionPayload,
  type Size,
  type StreamEvent,
  type TranslatorConfig
} from '../shared/types'

const TOOLBAR_SIZE: Size = { width: 42, height: 42 }
const TRANSLATE_SIZE: Size = { width: 380, height: 310 }
const SETTINGS_SIZE: Size = { width: 520, height: 640 }

function loadRendererPage(win: BrowserWindow, htmlFile: string): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl && devUrl.length > 0) {
    void win.loadURL(`${devUrl}/${htmlFile}`)
    return
  }
  void win.loadFile(join(__dirname, `../renderer/${htmlFile}`))
}

function getDisplayForPhysicalPoint(physicalPoint: Point): DisplayMetrics {
  const primaryScale = screen.getPrimaryDisplay().scaleFactor
  const approxDip = physicalToDip(physicalPoint, primaryScale)
  const display = screen.getDisplayNearestPoint(approxDip)
  return {
    workArea: display.workArea,
    scaleFactor: display.scaleFactor
  }
}

export class WindowManager {
  private toolbarWin: BrowserWindow | null = null
  private translateWin: BrowserWindow | null = null
  private settingsWin: BrowserWindow | null = null
  private latestSelection: SelectionPayload | null = null
  private isTranslatePinned = false
  private readonly onTranslateBlurClose: () => void

  constructor(onTranslateBlurClose: () => void) {
    this.onTranslateBlurClose = onTranslateBlurClose
  }

  private preloadPath(): string {
    return join(__dirname, '../preload/index.js')
  }

  private ensureToolbarWindow(): BrowserWindow {
    if (this.toolbarWin && !this.toolbarWin.isDestroyed()) {
      return this.toolbarWin
    }
    const win = new BrowserWindow({
      width: TOOLBAR_SIZE.width,
      height: TOOLBAR_SIZE.height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      hasShadow: false,
      webPreferences: {
        preload: this.preloadPath(),
        contextIsolation: true,
        nodeIntegration: false
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
      transparent: true,
      resizable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: this.preloadPath(),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    win.setAlwaysOnTop(true, 'pop-up-menu')
    win.on('blur', () => {
      if (this.isTranslatePinned) {
        return
      }
      win.hide()
      this.onTranslateBlurClose()
    })
    loadRendererPage(win, 'translate.html')
    this.translateWin = win
    return win
  }

  // not safe for concurrent calls: main-thread UI window operation only
  public showToolbar(payload: SelectionPayload): void {
    this.latestSelection = payload
    const win = this.ensureToolbarWindow()
    const display = getDisplayForPhysicalPoint(payload.anchor)
    const pos = computePopupPosition(payload.anchor, TOOLBAR_SIZE, display)
    win.setBounds({ x: pos.x, y: pos.y, width: TOOLBAR_SIZE.width, height: TOOLBAR_SIZE.height })
    win.showInactive()
    win.webContents.send(IPC_CHANNELS.TOOLBAR_SHOW, payload)
  }

  public hideToolbar(): void {
    if (!this.toolbarWin || this.toolbarWin.isDestroyed() || !this.toolbarWin.isVisible()) {
      return
    }
    this.toolbarWin.hide()
  }

  public isPointInsideToolbar(physicalPoint: Point): boolean {
    if (!this.toolbarWin || this.toolbarWin.isDestroyed() || !this.toolbarWin.isVisible()) {
      return false
    }
    const display = getDisplayForPhysicalPoint(physicalPoint)
    const dip = physicalToDip(physicalPoint, display.scaleFactor)
    const bounds = this.toolbarWin.getBounds()
    return (
      dip.x >= bounds.x &&
      dip.x <= bounds.x + bounds.width &&
      dip.y >= bounds.y &&
      dip.y <= bounds.y + bounds.height
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
    this.latestSelection = payload
    this.hideToolbar()
    const win = this.ensureTranslateWindow()
    const display = getDisplayForPhysicalPoint(payload.anchor)
    const currentBounds = win.getBounds()
    const targetSize: Size = { width: currentBounds.width, height: currentBounds.height }
    const pos = computePopupPosition(payload.anchor, targetSize, display)
    win.setPosition(pos.x, pos.y)

    const dispatchPayload = (): void => {
      win.show()
      win.focus()
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
        nodeIntegration: false
      }
    })
    loadRendererPage(win, 'settings.html')
    win.on('closed', () => {
      this.settingsWin = null
    })
    this.settingsWin = win
  }

  public warmUpFloatingWindows(): void {
    this.ensureToolbarWindow()
    this.ensureTranslateWindow()
  }

  public destroyAll(): void {
    const list = [this.toolbarWin, this.translateWin, this.settingsWin]
    for (const win of list) {
      if (win && !win.isDestroyed()) {
        win.destroy()
      }
    }
  }
}
