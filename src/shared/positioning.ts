import type { Point, Rect, Size } from './types'

const OFFSET_X_DIP = 10
const OFFSET_Y_BELOW_DIP = 12
const OFFSET_Y_ABOVE_DIP = 10
const EDGE_PADDING_DIP = 8

function clampHorizontal(desiredX: number, width: number, workArea: Rect): number {
  const minX = workArea.x + EDGE_PADDING_DIP
  const maxX = workArea.x + workArea.width - width - EDGE_PADDING_DIP
  if (maxX <= minX) {
    return workArea.x
  }
  if (desiredX < minX) {
    return minX
  }
  if (desiredX > maxX) {
    return maxX
  }
  return desiredX
}

function resolveVertical(anchorY: number, height: number, workArea: Rect): number {
  const minY = workArea.y + EDGE_PADDING_DIP
  const maxY = workArea.y + workArea.height - height - EDGE_PADDING_DIP
  if (maxY <= minY) {
    return workArea.y
  }
  const belowY = anchorY + OFFSET_Y_BELOW_DIP
  if (belowY <= maxY) {
    return Math.max(minY, belowY)
  }
  const aboveY = anchorY - height - OFFSET_Y_ABOVE_DIP
  if (aboveY >= minY) {
    return aboveY
  }
  return maxY
}

export function computePopupPosition(
  dipAnchor: Point,
  popupSize: Size,
  workArea: Rect
): Point {
  return {
    x: clampHorizontal(Math.round(dipAnchor.x) + OFFSET_X_DIP, popupSize.width, workArea),
    y: resolveVertical(Math.round(dipAnchor.y), popupSize.height, workArea)
  }
}
