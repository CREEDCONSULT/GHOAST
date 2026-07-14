import { LegalPage, LegalSection } from '../../components/LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="June 22, 2026">
      <LegalSection title="What Ghoast collects">
        <p>
          We collect your email address, account and billing records, product activity, and the
          contents of the Instagram data export you choose to upload. We never receive your
          Instagram password or session, we never sign in to your Instagram account, and we never
          take any action on Instagram on your behalf.
        </p>
      </LegalSection>
      <LegalSection title="Instagram data">
        <p>
          From your uploaded export, Ghoast stores the handles you follow and who follows you back,
          your Close Friends list, and your own likes and comments — used only to build and rank
          your ghost list. We do not ask for or store your Instagram password, and we do not access
          Instagram’s API with your credentials.
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
