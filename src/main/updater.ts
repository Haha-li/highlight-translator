import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../shared/update'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const PROGRESS_STEP = 10

export interface UpdaterCallbacks {
  onStateChange: (state: UpdateState) => void
  onNotify: (title: string, content: string) => void
}

// not safe for concurrent calls: invoke on Electron main thread only
export class AppUpdater {
  private state: UpdateState = { kind: 'idle' }
  private timer: ReturnType<typeof setInterval> | null = null
  private manualCheck = false
  private readonly callbacks: UpdaterCallbacks

  constructor(callbacks: UpdaterCallbacks) {
    this.callbacks = callbacks
  }

  public getState(): UpdateState {
    return this.state
  }

  private setState(next: UpdateState): void {
    this.state = next
    this.callbacks.onStateChange(next)
  }

  private bindEvents(): void {
    autoUpdater.on('checking-for-update', () => this.setState({ kind: 'checking' }))
    autoUpdater.on('update-available', (info) => {
      this.setState({ kind: 'downloading', version: info.version, percent: 0 })
    })
    autoUpdater.on('update-not-available', () => {
      this.setState({ kind: 'idle' })
      if (this.manualCheck) {
        this.callbacks.onNotify('划词翻译', `已是最新版本 v${app.getVersion()}`)
      }
      this.manualCheck = false
    })
    autoUpdater.on('download-progress', (progress) => {
      if (this.state.kind !== 'downloading') {
        return
      }
      const stepped = Math.floor(progress.percent / PROGRESS_STEP) * PROGRESS_STEP
      if (stepped === this.state.percent) {
        return
      }
      this.setState({ ...this.state, percent: stepped })
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.manualCheck = false
      this.setState({ kind: 'ready', version: info.version })
      this.callbacks.onNotify('划词翻译有新版本', `v${info.version} 已下载，右键托盘选择“重启并安装更新”，或退出时自动安装`)
    })
    autoUpdater.on('error', (err) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[AppUpdater] update error:', message)
      this.setState({ kind: 'error', message })
      if (this.manualCheck) {
        this.callbacks.onNotify('检查更新失败', message.slice(0, 120))
      }
      this.manualCheck = false
    })
  }

  public start(): void {
    // Dev builds lack app-update.yml; updater only works in packaged installs
    if (!app.isPackaged) {
      return
    }
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    this.bindEvents()
    void this.check(false)
    this.timer = setInterval(() => void this.check(false), CHECK_INTERVAL_MS)
  }

  public async check(manual: boolean): Promise<void> {
    if (!app.isPackaged) {
      this.callbacks.onNotify('划词翻译', '开发模式不支持自动更新，请使用安装版')
      return
    }
    const busy = this.state.kind === 'checking' || this.state.kind === 'downloading'
    if (busy || this.state.kind === 'ready') {
      return
    }
    this.manualCheck = manual
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      // 'error' event already updates state; log here to avoid silent swallow
      console.error('[AppUpdater] checkForUpdates rejected:', err)
    }
  }

  public installNow(): void {
    if (this.state.kind !== 'ready') {
      return
    }
    autoUpdater.quitAndInstall(true, true)
  }

  public handleMenuClick(): void {
    if (this.state.kind === 'ready') {
      this.installNow()
      return
    }
    void this.check(true)
  }

  public dispose(): void {
    if (!this.timer) {
      return
    }
    clearInterval(this.timer)
    this.timer = null
  }
}
