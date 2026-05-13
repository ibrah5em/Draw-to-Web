/** Top toolbar — owned by Luf8y */
export default function Toolbar(): JSX.Element {
  return (
    <div
      style={{
        height: 48,
        background: '#111',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 14 }}>Draw to Web</span>
    </div>
  )
}
