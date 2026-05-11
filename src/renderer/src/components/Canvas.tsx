import { Stage, Layer } from 'react-konva'

/** Main canvas editing area — owned by Yousef */
export default function Canvas(): JSX.Element {
  return (
    <Stage
      width={window.innerWidth - 280}
      height={window.innerHeight - 48}
      style={{ background: '#2a2a2a' }}
    >
      <Layer />
    </Stage>
  )
}
