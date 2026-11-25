import type { TranslatorConfig } from './types'

export interface SelectionCandidate {
  text: string
  programName: string
  ctrlPressed: boolean
}

export type SelectionDecision = 'ignore' | 'show-toolbar' | 'direct-translate'

const MAX_SELECTION_LENGTH = 5000
const SELF_PROCESS_TOKEN = 'highlight-translator'

function extractExecutableName(programPath: string): string {
  const normalized = programPath.trim().toLowerCase().replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1]
}

function isIgnoredProcess(programName: string, blacklist: string[]): boolean {
  const exe = extractExecutableName(programName)
  if (exe.includes(SELF_PROCESS_TOKEN)) {
    return true
  }
  return blacklist.some((entry) => {
    const target = entry.trim().toLowerCase()
    return target.length > 0 && exe === target
  })
}

export function decideSelectionAction(
  candidate: SelectionCandidate,
  config: TranslatorConfig
): SelectionDecision {
  if (!config.enabled) {
    return 'ignore'
  }
  const trimmed = candidate.text.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_SELECTION_LENGTH) {
    return 'ignore'
  }
  if (isIgnoredProcess(candidate.programName, config.blacklist)) {
    return 'ignore'
  }
  if (config.triggerMode === 'ctrl' && !candidate.ctrlPressed) {
    return 'ignore'
  }
  if (config.triggerMode === 'direct') {
    return 'direct-translate'
  }
  return 'show-toolbar'
}
