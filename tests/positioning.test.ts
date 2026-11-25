import { describe, expect, it } from 'vitest'
import { computePopupPosition } from '../src/shared/positioning'
import type { Rect } from '../src/shared/types'

describe('positioning in DIP coordinates', () => {
  const workArea: Rect = { x: 0, y: 0, width: 1280, height: 720 }

  it('places popup slightly below-right of DIP anchor when space is sufficient', () => {
    const pos = computePopupPosition(
      { x: 300, y: 300 },
      { width: 36, height: 36 },
      workArea
    )
    expect(pos).toEqual({ x: 310, y: 312 })
  })

  it('flips popup above anchor when near bottom edge so selected line is not covered', () => {
    const pos = computePopupPosition(
      { x: 400, y: 680 },
      { width: 380, height: 310 },
      workArea
    )
    expect(pos.y).toBe(680 - 310 - 10)
    expect(pos.x).toBe(410)
  })

  it('clamps popup inside workArea on multi-monitor negative or offset coordinates', () => {
    const secondaryWorkArea: Rect = { x: -1920, y: 0, width: 1920, height: 1040 }
    const pos = computePopupPosition(
      { x: -50, y: 980 },
      { width: 380, height: 310 },
      secondaryWorkArea
    )
    expect(pos.x + 380).toBeLessThanOrEqual(secondaryWorkArea.x + secondaryWorkArea.width)
    expect(pos.x).toBeGreaterThanOrEqual(secondaryWorkArea.x)
    expect(pos.y).toBe(980 - 310 - 10)
  })
})
