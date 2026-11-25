import { join } from 'node:path'
import { app, clipboard, ipcMain, nativeTheme } from 'electron'
import {
  IPC_CHANNELS,
  type FetchModelsParams,
  type Result,
  type TranslateRequest,
  type TranslatorConfig
} from '../shared/types'
import { describeUpdateMenu } from '../shared/update'
import { SelectionService } from './selectionService'
import { ConfigStore } from './store'
import { TranslatorEngine } from './translator'
import { AppTray } from './tray'
import { AppUpdater } from './updater'
import { WindowManager } from './windows'

const isSmokeTest = process.argv.includes('--smoke-test')

// Eliminate dedicated GPU process (~32MB) and share a single capped V8 renderer process
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('renderer-process-limit', '1')
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=48')

interface AppRuntime {
  store: ConfigStore
  windows: WindowManager
  translator: TranslatorEngine
  selection: SelectionService
  tray: AppTray
}

function registerIpcHandlers(rt: AppRuntime): void {
  ipcMain.on(IPC_CHANNELS.TOOLBAR_TRIGGER_TRANSLATE, () => {
    rt.windows.openTranslateFromLatest()
  })

  ipcMain.on(IPC_CHANNELS.TOOLBAR_HIDE, () => {
    rt.windows.hideToolbar()
  })

  ipcMain.handle(IPC_CHANNELS.TRANSLATE_START, async (_event, req: TranslateRequest) => {
    await rt.translator.translateStream(req, rt.store.get(), (streamEv) => {
      rt.windows.sendStreamEvent(streamEv)
    })
  })

  ipcMain.handle(IPC_CHANNELS.TRANSLATE_ABORT, () => {
    rt.translator.abortCurrent()
  })

  ipcMain.handle(IPC_CHANNELS.TRANSLATE_PIN, (_event, pinned: boolean) => {
    rt.windows.setTranslatePinned(pinned)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSLATE_CLOSE, () => {
    rt.windows.hideTranslate()
  })

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE, (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (): TranslatorConfig => {
    return rt.store.get()
  })

  ipcMain.handle(
    IPC_CHANNELS.MODELS_FETCH,
    async (_event, params: FetchModelsParams): Promise<Result<string[]>> => {
      return rt.translator.fetchModels(params)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE,
    async (_event, next: TranslatorConfig): Promise<Result<TranslatorConfig>> => {
      const saved = await rt.store.save(next)
      if (!saved.ok) {
        return saved
      }
      nativeTheme.themeSource = saved.value.theme
      rt.windows.broadcastConfigUpdated(saved.value)
      const hookRes = rt.selection.applyConfig(saved.value)
      rt.tray.refreshMenu()
      if (!hookRes.ok) {
        return { ok: false, error: hookRes.error }
      }
      return saved
    }
  )
}

function bootstrap(): void {
  const store = new ConfigStore(join(app.getPath('userData'), 'config.json'))
  nativeTheme.themeSource = store.get().theme
  const translator = new TranslatorEngine()
  const windows = new WindowManager(() => {
    translator.abortCurrent()
  })
  const selection = new SelectionService({ store, windows })
  const updater = new AppUpdater({
    onStateChange: () => tray.refreshMenu(),
    onNotify: (title, content) => tray.notify(title, content)
  })
  const tray = new AppTray({
    isEnabled: () => store.get().enabled,
    onToggleEnabled: (next) => {
      const updated = { ...store.get(), enabled: next }
      void store.save(updated).then(() => {
        selection.applyConfig(updated)
        tray.refreshMenu()
      })
    },
    onManualTranslate: () => selection.triggerManualTranslate(),
    onOpenSettings: () => windows.openSettings(),
    getUpdateMenu: () => describeUpdateMenu(updater.getState(), app.getVersion()),
    onUpdateClick: () => updater.handleMenuClick(),
    onQuit: () => app.quit()
  })

  registerIpcHandlers({ store, windows, translator, selection, tray })
  tray.init()
  const startRes = selection.start()
  if (!startRes.ok) {
    console.error('[Main] Selection hook startup warning:', startRes.error)
  }
  if (!isSmokeTest) {
    updater.start()
  }

  // First launch without API key opens settings so user knows app is running
  if (!isSmokeTest && store.get().apiKey.trim().length === 0) {
    windows.openSettings()
  }

  app.on('will-quit', () => {
    updater.dispose()
    translator.abortCurrent()
    selection.dispose()
    tray.destroy()
    windows.destroyAll()
  })

  if (isSmokeTest) {
    console.log('[SMOKE_OK] Highlight Translator initialized successfully')
    setTimeout(() => {
      app.quit()
    }, 300)
  }
}

const gotSingleLock = app.requestSingleInstanceLock()
if (!gotSingleLock && !isSmokeTest) {
  app.quit()
} else {
  app.on('window-all-closed', () => {
    // Keep background tray resident when all windows close
  })
  void app.whenReady().then(bootstrap)
}
