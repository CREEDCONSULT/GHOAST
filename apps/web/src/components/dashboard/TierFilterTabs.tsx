'use client';

const TIER_LABELS: Record<number, string> = {
  1: 'Safe to Cut',
  2: 'Probably Cut',
  3: 'Your Call',
  4: 'Might Keep',
  5: 'Keep Following',
};

const TIER_COLORS: Record<number, string> = {
  1: '#FF3E3E',
  2: '#FF7A3E',
  3: '#FFD166',
  4: '#7B4FFF',
  5: '#00E676',
};

interface TierFilterTabsProps {
  active: number | null;
  onChange: (tier: number | null) => void;
  tierBreakdown?: Record<string, number>;
}

export default function TierFilterTabs({ active, onChange, tierBreakdown = {} }: TierFilterTabsProps) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 16 }}>
      <button
        className={`tier-tab${active === null ? ' active' : ''}`}
        onClick={() => onChange(null)}
      >
        All{' '}
        {tierBreakdown && (
          <span
            style={{
              fontFamily: 'DM Mono',
              fontSize: 12,
              color: active === null ? 'var(--muted)' : 'var(--muted)',
              marginLeft: 4,
            }}
          >
            {Object.values(tierBreakdown).reduce((s, n) => s + n, 0)}
          </span>
        )}
      </button>

      {[1, 2, 3, 4, 5].map((tier) => {
        const count = tierBreakdown[String(tier)] ?? 0;
        const isActive = active === tier;
        return (
          <button
            key={tier}
            className={`tier-tab${isActive ? ' active' : ''}`}
            onClick={() => onChange(isActive ? null : tier)}
            style={isActive ? { borderColor: TIER_COLORS[tier], color: TIER_COLORS[tier] } : {}}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: TIER_COLORS[tier],
                marginRight: 6,
                boxShadow: isActive ? `0 0 6px ${TIER_COLORS[tier]}88` : 'none',
              }}
            />
            T{tier}
            <span
              style={{
                fontFamily: 'DM Mono',
                fontSize: 12,
                color: 'var(--muted)',
                marginLeft: 5,
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { TIER_COLORS, TIER_LABELS };
