import { describe, expect, it } from 'vitest'
import { describeUpdateMenu } from '../src/shared/update'

describe('describeUpdateMenu', () => {
  it('offers manual check with current version when idle', () => {
    expect(describeUpdateMenu({ kind: 'idle' }, '0.2.0')).toEqual({
      label: '检查更新（当前 v0.2.0）',
      enabled: true
    })
  })

  it('disables menu while checking or downloading', () => {
    expect(describeUpdateMenu({ kind: 'checking' }, '0.2.0').enabled).toBe(false)
    expect(describeUpdateMenu({ kind: 'downloading', version: '0.3.0', percent: 40 }, '0.2.0')).toEqual({
      label: '正在下载更新 v0.3.0（40%）',
      enabled: false
    })
  })

  it('offers restart to install when update is downloaded', () => {
    expect(describeUpdateMenu({ kind: 'ready', version: '0.3.0' }, '0.2.0')).toEqual({
      label: '重启并安装更新 v0.3.0',
      enabled: true
    })
  })

  it('allows retry after error', () => {
    expect(describeUpdateMenu({ kind: 'error', message: 'net' }, '0.2.0')).toEqual({
      label: '检查更新失败，点击重试',
      enabled: true
    })
  })
})
