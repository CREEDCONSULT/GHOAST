/**
 * C-08 Monogram — deterministic initial + username-hash hue.
 * The export contains no avatars; we never fetch or fake them (spec §3.2).
 * Deterministic so a username always looks the same across scans.
 */

function hashHue(username: string): number {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function Monogram({ username, size = 40 }: { username: string; size?: number }) {
  const hue = hashHue(username.toLowerCase());
  const initial = (username[0] ?? '?').toUpperCase();
  return (
    <span
      className="monogram"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        // HSL pairs tuned to pass AA as a decorative tile on dark & light surfaces
        background: `linear-gradient(135deg, hsl(${hue} 45% 30%), hsl(${hue} 55% 22%))`,
        color: `hsl(${hue} 90% 88%)`,
      }}
    >
      {initial}
    </span>
  );
}
