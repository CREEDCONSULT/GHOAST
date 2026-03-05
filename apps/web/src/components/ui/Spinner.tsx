export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin .7s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="rgba(123,79,255,.25)"
        strokeWidth="2.5"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="var(--violet)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SkeletonRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 20px',
        borderBottom: '1px solid rgba(123,79,255,.08)',
      }}
    >
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 14, width: '40%' }} />
        <div className="skeleton" style={{ height: 12, width: '25%' }} />
      </div>
      <div className="skeleton" style={{ height: 14, width: 32 }} />
      <div className="skeleton" style={{ height: 14, width: 48 }} />
      <div className="skeleton" style={{ height: 32, width: 80, borderRadius: 8 }} />
    </div>
  );
}
