'use client';
/**
 * MobileNav — Client island for mobile hamburger menu.
 * Only loaded on mobile. Keeps Nav.tsx a server component.
 */
import { useState } from 'react';
import Link from 'next/link';

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="show-mobile" style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
          color: 'var(--ghost-text)',
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        {open ? '✕' : '☰'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            background: 'var(--slate)',
            border: '1px solid var(--violet-mid)',
            borderRadius: 12,
            padding: '16px 0',
            minWidth: 200,
            marginTop: 8,
          }}
        >
          {[
            { href: '#how-it-works', label: 'How it works' },
            { href: '#tiers', label: 'Ghost tiers' },
            { href: '#pricing', label: 'Pricing' },
            { href: '/login', label: 'Log in' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '12px 24px',
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--ghost-text)',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </Link>
          ))}
          <div style={{ padding: '8px 16px' }}>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'var(--grad)',
                padding: '12px 20px',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
