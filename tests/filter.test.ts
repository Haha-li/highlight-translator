import { describe, expect, it } from 'vitest'
import { decideSelectionAction } from '../src/shared/selectionFilter'
import { DEFAULT_CONFIG } from '../src/shared/types'

describe('selectionFilter', () => {
  it('ignores empty or whitespace-only selections', () => {
    const action = decideSelectionAction(
      { text: '   \n\t ', programName: 'chrome.exe', ctrlPressed: false },
      DEFAULT_CONFIG
    )
    expect(action).toBe('ignore')
  })

  it('ignores selections when feature is disabled or from own process', () => {
    const disabledAction = decideSelectionAction(
      { text: 'hello', programName: 'chrome.exe', ctrlPressed: false },
      { ...DEFAULT_CONFIG, enabled: false }
    )
    const selfAction = decideSelectionAction(
      { text: 'hello', programName: 'highlight-translator.exe', ctrlPressed: false },
      DEFAULT_CONFIG
    )
    expect(disabledAction).toBe('ignore')
    expect(selfAction).toBe('ignore')
  })

  it('ignores blacklisted processes case-insensitively', () => {
    const action = decideSelectionAction(
      { text: 'enemy spotted', programName: 'C:\\Games\\CS2.EXE', ctrlPressed: false },
      DEFAULT_CONFIG
    )
    expect(action).toBe('ignore')
  })

  it('requires ctrlPressed when triggerMode is ctrl', () => {
    const cfg = { ...DEFAULT_CONFIG, triggerMode: 'ctrl' as const }
    expect(
      decideSelectionAction({ text: 'hello', programName: 'chrome.exe', ctrlPressed: false }, cfg)
    ).toBe('ignore')
    expect(
      decideSelectionAction({ text: 'hello', programName: 'chrome.exe', ctrlPressed: true }, cfg)
    ).toBe('show-toolbar')
  })

  it('returns direct-translate when triggerMode is direct', () => {
    const cfg = { ...DEFAULT_CONFIG, triggerMode: 'direct' as const }
    expect(
      decideSelectionAction({ text: 'hello', programName: 'chrome.exe', ctrlPressed: false }, cfg)
    ).toBe('direct-translate')
  })
})
