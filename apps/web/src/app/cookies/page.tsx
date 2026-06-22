import { LegalPage, LegalSection } from '../../components/LegalPage';

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" effectiveDate="June 22, 2026">
      <LegalSection title="Essential cookies">
        <p>
          Ghoast uses an HTTP-only refresh cookie to keep you signed in securely. It is required
          for authentication and is not used for advertising.
        </p>
      </LegalSection>
      <LegalSection title="Local browser storage">
        <p>
          The web app stores a short-lived access token and basic account display data in session
          storage. Session storage is cleared when the browser tab is closed.
        </p>
      </LegalSection>
      <LegalSection title="Controls">
        <p>
          Signing out clears local authentication data. Blocking essential cookies prevents the
          authenticated product from working.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
