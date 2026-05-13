import { Layer, Line } from 'react-konva'

interface GridOverlayProps {
  width: number
  height: number
  /** Number of columns — defaults to 12. */
  columns?: number
}

/**
 * Renders semi-transparent vertical column guide lines inside a Konva Layer.
 * Must be a direct child of a Konva <Stage>.
 * Non-interactive: the layer and every line have listening={false}.
 */
export default function GridOverlay({
  width,
  height,
  columns = 12,
}: GridOverlayProps): JSX.Element {
  const colW = width / columns
  return (
    <Layer listening={false}>
      {Array.from({ length: columns - 1 }, (_, i) => (
        <Line
          key={i}
          points={[(i + 1) * colW, 0, (i + 1) * colW, height]}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={1}
          listening={false}
        />
      ))}
    </Layer>
  )
}
