import { Menu, Tray, nativeImage, type NativeImage } from 'electron'

export interface TrayActions {
  isEnabled: () => boolean
  onToggleEnabled: (next: boolean) => void
  onManualTranslate: () => void
  onOpenSettings: () => void
  onQuit: () => void
}

function createTrayIconImage(): NativeImage {
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const insideBox = x >= 1 && x <= 14 && y >= 1 && y <= 14
      if (!insideBox) {
        continue
      }
      const isGlyph =
        (y === 4 && x >= 4 && x <= 11) ||
        (x === 7 && y >= 4 && y <= 12) ||
        (x === 8 && y >= 4 && y <= 12) ||
        (y === 8 && x >= 5 && x <= 10)
      // BGRA byte order on Windows bitmap
      buf[idx] = isGlyph ? 255 : 235
      buf[idx + 1] = isGlyph ? 255 : 110
      buf[idx + 2] = isGlyph ? 255 : 79
      buf[idx + 3] = 255
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

export class AppTray {
  private tray: Tray | null = null
  private readonly actions: TrayActions

  constructor(actions: TrayActions) {
    this.actions = actions
  }

  public init(): void {
    this.tray = new Tray(createTrayIconImage())
    this.tray.setToolTip('划词翻译 (Highlight Translator)')
    this.tray.on('double-click', () => {
      this.actions.onOpenSettings()
    })
    this.refreshMenu()
  }

  public refreshMenu(): void {
    if (!this.tray) {
      return
    }
    const enabled = this.actions.isEnabled()
    const menu = Menu.buildFromTemplate([
      {
        label: '启用划词翻译',
        type: 'checkbox',
        checked: enabled,
        click: (item) => {
          this.actions.onToggleEnabled(item.checked)
        }
      },
      {
        label: '翻译当前选区 / 剪贴板',
        click: () => {
          this.actions.onManualTranslate()
        }
      },
      { type: 'separator' },
      {
        label: '设置...',
        click: () => {
          this.actions.onOpenSettings()
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.actions.onQuit()
        }
      }
    ])
    this.tray.setContextMenu(menu)
  }

  public destroy(): void {
    if (!this.tray) {
      return
    }
    this.tray.destroy()
    this.tray = null
  }
}
