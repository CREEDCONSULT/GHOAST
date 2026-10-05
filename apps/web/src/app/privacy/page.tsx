import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <main id="main">
      <div className="public-page">
        <h1>Privacy, in plain language</h1>
        <p className="lead muted">
          We can’t leak what we never have. GHOAST processes your Instagram export on your device —
          the file is never uploaded, and there is no GHOAST account by default.
        </p>

        <h2>What GHOAST reads</h2>
        <p>
          Exactly two lists from your official Instagram “Download Your Information” export:
          <strong> followers and following</strong>. Each entry contains a username, a profile link,
          and the date the follow started. Everything else in the archive is ignored.
        </p>

        <h2>Where your data lives</h2>
        <p>
          In your browser’s local storage (IndexedDB), on your device. There is no GHOAST server that
          receives your archive; the page’s own security policy forbids the app from sending it
          anywhere. You can verify this in your browser’s developer tools — zero network requests
          carry your archive.
        </p>

        <h2>What GHOAST never does</h2>
        <ul>
          <li>Never asks for your Instagram password or login session.</li>
          <li>Never acts on your Instagram account — you do all unfollowing yourself, in Instagram.</li>
          <li>Never shows data the export doesn’t contain (no avatars, follower counts, or activity).</li>
        </ul>

        <h2>Deletion</h2>
        <p>
          Settings → Data → <strong>Delete everything</strong> wipes every scan, decision, and
          preference from this device, instantly. There is nothing on our side to delete — nothing
          was ever sent.
        </p>

        <h2>Analytics (opt-in, off by default)</h2>
        <p>
          If you choose to enable analytics in Settings, GHOAST sends anonymous, event-level product
      	signals only — e.g. “an upload succeeded” or aggregate counts like “how many ghosts were
          found”. It never includes usernames, relationship lists, archive contents, file names, or
          Instagram identifiers. Events pass through our own first-party relay; nothing goes directly
          to any third party. You can turn it off at any time, and “Delete everything” removes the
          anonymous id with the rest of your local data.
        </p>

        <h2>Payments</h2>
        <p>
          GHOAST+ purchases are handled by Stripe on Stripe’s hosted checkout page. We receive back
          only a payment confirmation — never your card details, and never anything from your archive.
        </p>

        <p className="mt-6">
          <Link href="/start" className="btn btn-primary">Find my ghosts — free</Link>
        </p>
      </div>
      <PublicFooter />
    </main>
  );
}
