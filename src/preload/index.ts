import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type FetchModelsParams,
  type Result,
  type SelectionPayload,
  type StreamEvent,
  type TranslateRequest,
  type TranslatorConfig
} from '../shared/types'

const translatorApi = {
  triggerTranslateFromToolbar: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TOOLBAR_TRIGGER_TRANSLATE)
  },
  hideToolbar: (): void => {
    ipcRenderer.send(IPC_CHANNELS.TOOLBAR_HIDE)
  },
  onToolbarShow: (callback: (payload: SelectionPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: SelectionPayload): void => {
      callback(payload)
    }
    ipcRenderer.on(IPC_CHANNELS.TOOLBAR_SHOW, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TOOLBAR_SHOW, handler)
  },
  onTranslateOpen: (callback: (payload: SelectionPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: SelectionPayload): void => {
      callback(payload)
    }
    ipcRenderer.on(IPC_CHANNELS.TRANSLATE_OPEN, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSLATE_OPEN, handler)
  },
  onStreamEvent: (callback: (ev: StreamEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ev: StreamEvent): void => {
      callback(ev)
    }
    ipcRenderer.on(IPC_CHANNELS.TRANSLATE_STREAM, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSLATE_STREAM, handler)
  },
  startTranslate: (req: TranslateRequest): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSLATE_START, req)
  },
  abortTranslate: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSLATE_ABORT)
  },
  setPinned: (pinned: boolean): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSLATE_PIN, pinned)
  },
  closeTranslate: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSLATE_CLOSE)
  },
  copyText: (text: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE, text)
  },
  getConfig: (): Promise<TranslatorConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET)
  },
  fetchModels: (params: FetchModelsParams): Promise<Result<string[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MODELS_FETCH, params)
  },
  saveConfig: (config: TranslatorConfig): Promise<Result<TranslatorConfig>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SAVE, config)
  },
  onConfigUpdated: (callback: (config: TranslatorConfig) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: TranslatorConfig): void => {
      callback(config)
    }
    ipcRenderer.on(IPC_CHANNELS.CONFIG_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_UPDATED, handler)
  }
}

export type TranslatorBridgeApi = typeof translatorApi

contextBridge.exposeInMainWorld('translatorApi', translatorApi)
