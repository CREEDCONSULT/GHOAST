import { LegalPage, LegalSection } from '../../components/LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="June 22, 2026">
      <LegalSection title="What Ghoast collects">
        <p>
          We collect your email address, account and billing records, product activity, and the
          Instagram session token you provide. The token is encrypted before storage. We use it
          to retrieve relationship data and to submit an unfollow only after you request one.
        </p>
      </LegalSection>
      <LegalSection title="Instagram data">
        <p>
          Ghoast may store connected account identifiers, handles, profile metadata, follower and
          following relationships, scan results, action history, and safety status. We do not ask
          for or store your Instagram password.
        </p>
      </LegalSection>
      <LegalSection title="How data is used">
        <p>
          We use data to operate and secure the service, calculate relationship insights, process
          requested actions, provide support, prevent abuse, and meet legal obligations. We do not
          sell personal information.
        </p>
      </LegalSection>
      <LegalSection title="Service providers and retention">
        <p>
          Infrastructure, database, cache, analytics, error-monitoring, email, and payment
          providers may process limited data for us. We retain information only as long as needed
          for the service, security, billing, disputes, or law. Payment card details are handled
          by Stripe and are not stored by Ghoast.
        </p>
      </LegalSection>
      <LegalSection title="Your controls">
        <p>
          You can disconnect an Instagram account or permanently delete your Ghoast account from
          Settings. Deletion removes the account data under our control, subject to short-lived
          backups and records we must retain for legal or financial reasons.
        </p>
      </LegalSection>
      <LegalSection title="Contact and changes">
        <p>
          Privacy requests may be sent to privacy@ghoast.app. We may revise this policy as the
          product changes and will update the effective date when we do.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
