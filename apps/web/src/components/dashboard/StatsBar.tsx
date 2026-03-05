import type { AccountStats, Account } from '../../lib/api';

interface StatsBarProps {
  account: Account;
  stats: AccountStats;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function StatsBar({ account, stats }: StatsBarProps) {
  const ratio =
    account.followingCount > 0
      ? (account.followersCount / account.followingCount).toFixed(2)
      : '—';

  return (
    <div>
      {/* Account header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 2 }}>
            @{account.handle}
          </h2>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {account.lastScannedAt
              ? `Last scanned ${new Date(account.lastScannedAt).toLocaleDateString()}`
              : 'Not yet scanned'}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--cyan)',
          }}
        >
          <span className="pulse-dot" />
          Live Data
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 24,
        }}
      >
        <div className="stat-box">
          <div className="stat-val">{fmt(account.followersCount)}</div>
          <div className="stat-label">Followers</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{fmt(account.followingCount)}</div>
          <div className="stat-label">Following</div>
        </div>
        <div className="stat-box">
          <div className="stat-val" style={{ color: 'var(--red)' }}>
            {stats.totalGhosts - stats.removedGhosts}
          </div>
          <div className="stat-label">Ghosts</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{ratio}</div>
          <div className="stat-label">Ratio</div>
        </div>
      </div>
    </div>
  );
}
