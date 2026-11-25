export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }

export interface UpdateMenuItem {
  label: string
  enabled: boolean
}

export function describeUpdateMenu(state: UpdateState, currentVersion: string): UpdateMenuItem {
  switch (state.kind) {
    case 'checking':
      return { label: '正在检查更新...', enabled: false }
    case 'downloading':
      return { label: `正在下载更新 v${state.version}（${state.percent}%）`, enabled: false }
    case 'ready':
      return { label: `重启并安装更新 v${state.version}`, enabled: true }
    case 'error':
      return { label: '检查更新失败，点击重试', enabled: true }
    default:
      return { label: `检查更新（当前 v${currentVersion}）`, enabled: true }
  }
}
