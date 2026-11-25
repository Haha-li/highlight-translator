import type { TargetLanguage } from './types'

export interface LanguagePreference {
  requested: TargetLanguage
  primary: Exclude<TargetLanguage, 'auto'>
  secondary: Exclude<TargetLanguage, 'auto'>
}

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

const HAN_CHAR_REGEX = /\p{Script=Han}/gu
const WHITESPACE_REGEX = /\s+/g

function isPredominantlyChinese(text: string): boolean {
  const compact = text.replace(WHITESPACE_REGEX, '')
  if (compact.length === 0) {
    return false
  }
  const matches = compact.match(HAN_CHAR_REGEX)
  const hanCount = matches ? matches.length : 0
  return hanCount / compact.length >= 0.3
}

export function resolveTargetLanguage(
  text: string,
  pref: LanguagePreference
): Exclude<TargetLanguage, 'auto'> {
  if (pref.requested !== 'auto') {
    return pref.requested
  }
  if (pref.primary === '简体中文' && isPredominantlyChinese(text)) {
    return pref.secondary
  }
  return pref.primary
}

export function buildTranslateMessages(text: string, targetLanguage: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一个精准、地道的专业划词翻译引擎。请将用户输入的文本直接翻译为${targetLanguage}。只输出译文内容本身，不要添加任何解释、引号或前后缀；保留原文的段落与术语准确性。`
    },
    {
      role: 'user',
      content: text
    }
  ]
}
