import type { TranslatorBridgeApi } from './index'

declare global {
  interface Window {
    translatorApi: TranslatorBridgeApi
  }
}
