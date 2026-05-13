import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Group, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useElementStore, useTemporalStore } from '../../../store/elementStore'
import type { CanvasElement } from '../../../store/elementStore'

const COLS = 12

function getColWidth(canvasW: number): number {
  return canvasW / COLS
}

function snapColIndex(pixelX: number, cw: number): number {
  return Math.max(0, Math.min(COLS - 1, Math.round(pixelX / cw)))
}

function snapColSpan(pixelW: number, cw: number, colIndex: number): number {
  return Math.min(Math.max(1, Math.round(pixelW / cw)), COLS - colIndex)
}

interface ElementShapeProps {
  el: CanvasElement
  cw: number
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, pixelX: number, y: number) => void
  onTransformEnd: (id: string, pixelX: number, y: number, pixelW: number, h: number) => void
  groupRef: (node: Konva.Group | null) => void
}

function ElementShape({
  el,
  cw,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  groupRef,
}: ElementShapeProps): JSX.Element | null {
  if (el.visible === false) return null

  const pixelX = el.x * cw
  const pixelW = el.width * cw
  const fill = el.props.background ?? (el.type === 'image' ? '#2a2a4a' : '#4a4a4a')
  const strokeColor = isSelected ? '#4a9eff' : (el.props.borderColor ?? 'transparent')
  const strokeWidth = isSelected ? 2 : (el.props.borderWidth ?? 0)

  return (
    <Group
      ref={groupRef}
      x={pixelX}
      y={el.y}
      draggable={!el.locked}
      onClick={() => onSelect(el.id)}
      onTap={() => onSelect(el.id)}
      onDragEnd={(e) => onDragEnd(el.id, e.target.x(), e.target.y())}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Group
        const sx = node.scaleX()
        const sy = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onTransformEnd(el.id, node.x(), node.y(), pixelW * sx, el.height * sy)
      }}
    >
      <Rect
        width={pixelW}
        height={el.height}
        fill={fill}
        cornerRadius={el.props.borderRadius ?? 0}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        dash={el.type === 'image' ? [6, 3] : undefined}
        listening={false}
      />
      {(el.type === 'text' || el.type === 'button') && (
        <Text
          width={pixelW}
          height={el.height}
          text={el.props.text ?? (el.type === 'button' ? 'Button' : 'Text')}
          fontSize={el.props.fontSize ?? (el.type === 'button' ? 14 : 16)}
          fontFamily={el.props.fontFamily ?? 'sans-serif'}
          fill={el.props.color ?? '#e0e0e0'}
          align={el.type === 'button' ? 'center' : 'left'}
          verticalAlign={el.type === 'button' ? 'middle' : 'top'}
          padding={el.props.padding ?? 4}
          listening={false}
        />
      )}
      {el.type === 'image' && (
        <Text
          width={pixelW}
          height={el.height}
          text={el.props.alt ? `[img: ${el.props.alt}]` : '[image placeholder]'}
          fontSize={12}
          fontFamily="sans-serif"
          fill="rgba(200,200,255,0.5)"
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      )}
    </Group>
  )
}

/** Main canvas editing area — owned by Luf8y */
export default function Canvas(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const groupRefs = useRef(new Map<string, Konva.Group>())
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [showGrid, setShowGrid] = useState(true)

  const elements = useElementStore((s) => s.elements)
  const selectedId = useElementStore((s) => s.selectedId)
  const setSelected = useElementStore((s) => s.setSelected)
  const updateElement = useElementStore((s) => s.updateElement)
  const removeElement = useElementStore((s) => s.removeElement)
  const undo = useTemporalStore((s) => s.undo)
  const redo = useTemporalStore((s) => s.redo)

  // Measure container via ResizeObserver so Stage fills available flex space
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.max(1, width), height: Math.max(1, height) })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Sync Transformer to selected node
  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    const node = selectedId ? (groupRefs.current.get(selectedId) ?? null) : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedId, elements])

  // Keyboard shortcuts: Delete, Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        removeElement(selectedId)
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, removeElement, undo, redo])

  const cw = getColWidth(size.width)

  const handleDragEnd = useCallback(
    (id: string, pixelX: number, y: number) => {
      const el = elements.find((e) => e.id === id)
      if (!el) return
      const cw = getColWidth(size.width)
      const newCol = snapColIndex(pixelX, cw)
      updateElement(id, {
        x: Math.min(newCol, COLS - el.width),
        y: Math.max(0, Math.round(y)),
      })
    },
    [elements, size.width, updateElement]
  )

  const handleTransformEnd = useCallback(
    (id: string, pixelX: number, y: number, pixelW: number, h: number) => {
      const el = elements.find((e) => e.id === id)
      if (!el) return
      const cw = getColWidth(size.width)
      const newCol = snapColIndex(pixelX, cw)
      const newSpan = snapColSpan(pixelW, cw, newCol)
      updateElement(id, {
        x: newCol,
        y: Math.max(0, Math.round(y)),
        width: newSpan,
        height: Math.max(20, Math.round(h)),
      })
    },
    [elements, size.width, updateElement]
  )

  const gridLines = Array.from({ length: COLS - 1 }, (_, i) => (
    <Line
      key={i}
      points={[(i + 1) * cw, 0, (i + 1) * cw, size.height]}
      stroke="rgba(255,255,255,0.07)"
      strokeWidth={1}
      listening={false}
    />
  ))

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', background: '#1e1e1e', cursor: 'default' }}
    >
      <button
        onClick={() => setShowGrid((v) => !v)}
        style={{
          position: 'absolute',
          top: 56,
          left: 8,
          zIndex: 10,
          background: showGrid ? '#4a9eff' : '#333',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Grid
      </button>
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) setSelected(null)
        }}
      >
        {showGrid && <Layer listening={false}>{gridLines}</Layer>}
        <Layer>
          {elements.map((el) => (
            <ElementShape
              key={el.id}
              el={el}
              cw={cw}
              isSelected={el.id === selectedId}
              onSelect={setSelected}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
              groupRef={(node) => {
                if (node) groupRefs.current.set(el.id, node)
                else groupRefs.current.delete(el.id)
              }}
            />
          ))}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < cw * 0.5 || newBox.height < 20 ? oldBox : newBox
            }
          />
        </Layer>
      </Stage>
    </div>
  )
}
