import Link from 'next/link';
import { LegalPage, LegalSection } from '../../../components/LegalPage';

export default function AccountDeletionPage() {
  return (
    <LegalPage title="Delete Your Account" effectiveDate="June 22, 2026">
      <LegalSection title="Self-service deletion">
        <p>
          Sign in, open Settings, and use Delete account. You will be asked to type DELETE before
          the request is accepted.
        </p>
      </LegalSection>
      <LegalSection title="What happens">
        <p>
          Pending Instagram actions are blocked and removed, active subscriptions are canceled,
          and your Ghoast profile, connected accounts, scan results, and action records are
          permanently deleted from the primary database.
        </p>
      </LegalSection>
      <LegalSection title="Need help?">
        <p>
          If you cannot sign in, email privacy@ghoast.app from your account email address. We may
          request verification before processing the deletion.
        </p>
      </LegalSection>
      <Link href="/app/settings" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
        Open Settings
      </Link>
    </LegalPage>
  );
}
