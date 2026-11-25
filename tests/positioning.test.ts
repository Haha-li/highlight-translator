import { describe, expect, it } from 'vitest'
import { computePopupPosition, physicalToDip } from '../src/shared/positioning'
import type { DisplayMetrics } from '../src/shared/types'

describe('positioning', () => {
  const display150: DisplayMetrics = {
    workArea: { x: 0, y: 0, width: 1280, height: 720 },
    scaleFactor: 1.5
  }

  it('converts physical coordinates to DIP coordinates using scaleFactor', () => {
    const dip = physicalToDip({ x: 300, y: 450 }, 1.5)
    expect(dip).toEqual({ x: 200, y: 300 })
  })

  it('places popup slightly below-right of cursor when space is sufficient', () => {
    const pos = computePopupPosition(
      { x: 300, y: 300 },
      { width: 36, height: 36 },
      display150
    )
    expect(pos).toEqual({ x: 208, y: 208 })
  })

  it('flips or clamps popup inside workArea when near right and bottom edges', () => {
    const pos = computePopupPosition(
      { x: 1900, y: 1060 },
      { width: 380, height: 260 },
      display150
    )
    expect(pos.x + 380).toBeLessThanOrEqual(display150.workArea.x + display150.workArea.width)
    expect(pos.y + 260).toBeLessThanOrEqual(display150.workArea.y + display150.workArea.height)
    expect(pos.x).toBeGreaterThanOrEqual(display150.workArea.x)
    expect(pos.y).toBeGreaterThanOrEqual(display150.workArea.y)
  })
})
