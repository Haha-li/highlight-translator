import type { DisplayMetrics, Point, Size } from './types'

const CURSOR_OFFSET_DIP = 8
const EDGE_PADDING_DIP = 8

export function physicalToDip(point: Point, scaleFactor: number): Point {
  if (scaleFactor <= 0) {
    return { x: Math.round(point.x), y: Math.round(point.y) }
  }
  return {
    x: Math.round(point.x / scaleFactor),
    y: Math.round(point.y / scaleFactor)
  }
}

function clampAxis(desired: number, length: number, minBound: number, maxBound: number): number {
  const minAllowed = minBound + EDGE_PADDING_DIP
  const maxAllowed = maxBound - length - EDGE_PADDING_DIP
  if (maxAllowed <= minAllowed) {
    return minBound
  }
  if (desired < minAllowed) {
    return minAllowed
  }
  if (desired > maxAllowed) {
    return maxAllowed
  }
  return desired
}

export function computePopupPosition(
  physicalAnchor: Point,
  popupSize: Size,
  display: DisplayMetrics
): Point {
  const dip = physicalToDip(physicalAnchor, display.scaleFactor)
  const { workArea } = display
  return {
    x: clampAxis(dip.x + CURSOR_OFFSET_DIP, popupSize.width, workArea.x, workArea.x + workArea.width),
    y: clampAxis(dip.y + CURSOR_OFFSET_DIP, popupSize.height, workArea.y, workArea.y + workArea.height)
  }
}
