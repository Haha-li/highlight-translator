import { describe, expect, it } from 'vitest'
import { buildTranslateMessages, resolveTargetLanguage } from '../src/shared/language'

describe('language detection and prompt building', () => {
  it('translates English text into primaryLanguage when target is auto', () => {
    const target = resolveTargetLanguage('Selection Assistant for desktop', {
      requested: 'auto',
      primary: '简体中文',
      secondary: 'English'
    })
    expect(target).toBe('简体中文')
  })

  it('translates predominantly Chinese text into secondaryLanguage when target is auto', () => {
    const target = resolveTargetLanguage('这是一个独立的桌面端划词翻译工具', {
      requested: 'auto',
      primary: '简体中文',
      secondary: 'English'
    })
    expect(target).toBe('English')
  })

  it('honors explicit target language selection over auto detection', () => {
    const target = resolveTargetLanguage('Hello world', {
      requested: '日本語',
      primary: '简体中文',
      secondary: 'English'
    })
    expect(target).toBe('日本語')
  })

  it('builds system and user messages preserving raw text', () => {
    const messages = buildTranslateMessages('Hello, world!', '简体中文')
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('简体中文')
    expect(messages[1]).toEqual({ role: 'user', content: 'Hello, world!' })
  })
})
