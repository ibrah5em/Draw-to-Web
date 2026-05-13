/** Right-side properties panel — owned by Luf8y */
export default function PropertiesPanel(): JSX.Element {
  return (
    <div
      style={{
        width: 280,
        background: '#111',
        borderLeft: '1px solid #333',
        padding: 16,
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <p style={{ fontSize: 12, color: '#666' }}>Select an element to edit its properties.</p>
    </div>
  )
}
