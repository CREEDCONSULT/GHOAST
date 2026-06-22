import { LegalPage, LegalSection } from '../../components/LegalPage';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="June 22, 2026">
      <LegalSection title="The service">
        <p>
          Ghoast provides tools for analyzing Instagram relationship data and submitting actions
          that you explicitly select. Ghoast is independent and is not affiliated with or endorsed
          by Instagram or Meta.
        </p>
      </LegalSection>
      <LegalSection title="Your authorization">
        <p>
          You must own or be authorized to operate every connected account. By connecting an
          account, you authorize Ghoast to use the supplied session for the disclosed purposes.
          You remain responsible for your account, content, choices, and compliance with applicable
          platform rules and law.
        </p>
      </LegalSection>
      <LegalSection title="Risks and prohibited use">
        <p>
          Unofficial integrations may stop working or trigger platform limits, challenges, or
          account restrictions. Do not use Ghoast for unauthorized access, harassment, evasion of
          safeguards, unlawful automation, resale of access, or activity that harms another person
          or service.
        </p>
      </LegalSection>
      <LegalSection title="Actions and availability">
        <p>
          Review every action before submitting it. Actions may be delayed, rejected, duplicated
          by an upstream service, or unavailable. We may pause or limit actions to protect users,
          connected accounts, and the service.
        </p>
      </LegalSection>
      <LegalSection title="Billing and termination">
        <p>
          Paid plans renew until canceled under the terms shown at purchase. You may delete your
          account from Settings. We may suspend access for misuse, security risk, nonpayment, or a
          legal requirement.
        </p>
      </LegalSection>
      <LegalSection title="Disclaimers and liability">
        <p>
          The service is provided as available without guarantees that it will be uninterrupted,
          error-free, or compatible with Instagram. To the extent permitted by law, Ghoast is not
          liable for indirect, incidental, special, consequential, or platform-enforcement losses.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>Questions about these terms may be sent to legal@ghoast.app.</p>
      </LegalSection>
    </LegalPage>
  );
}
