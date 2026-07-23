// Central legal / compliance copy for Wyzrdy. Each page is a list of sections
// { id, h, body: [paragraph | { list: [...] }] } consumed by LegalPage.jsx.

const effective = 'July 18, 2026';

export const LEGAL_META = { effective, entity: 'The Good Idea LLC', contact: 'legal@wyzrdy.com', privacy: 'privacy@wyzrdy.com' };

export const PRIVACY = {
  slug: 'privacy',
  title: 'Privacy Policy',
  intro: `This Privacy Policy explains how ${LEGAL_META.entity} ("Wyzrdy", "we", "us") collects, uses, discloses, and safeguards information when you use the Wyzrdy AI business operating system, including Wyzrdy, Easy Breezy, and ForgeSEO (collectively, the "Service"). We align our practices with the GDPR, CCPA/CPRA, and COPPA.`,
  sections: [
    { id: 'collection', h: '1. Information We Collect', body: [
      'We collect information you provide directly and information generated as you use the Service.',
      { list: [
        'Account data: name, email address, password (hashed), company, website, and profile preferences.',
        'Content data: objectives, blueprints, workflows, conversations, projects, assets, and SEO audits you create.',
        'Payment data: billing tier, currency, and transaction metadata. Card and bank details are processed by our payment processors and never stored on our servers.',
        'Usage data: API calls, feature interactions, device and browser type, IP address, and timestamps.',
        'Cookies and similar technologies as described in our Cookie Policy.',
      ] },
    ] },
    { id: 'use', h: '2. How We Use Information', body: [
      'We process personal data on the lawful bases of contract performance, legitimate interests, consent, and legal obligation.',
      { list: [
        'Provide, maintain, and improve the Service and generate AI outputs you request.',
        'Authenticate users, enforce tier limits, and prevent fraud and abuse.',
        'Process payments, manage subscriptions, and issue invoices.',
        'Communicate service, security, and (with consent) marketing messages.',
        'Maintain audit logs for security and compliance (see Data Retention).',
      ] },
    ] },
    { id: 'sharing', h: '3. How We Share Information', body: [
      'We do not sell personal information. We share it only with service providers acting on our instructions under data processing agreements:',
      { list: [
        'AI providers to generate model outputs (e.g., OpenRouter, Z.ai).',
        'Automation and orchestration providers (e.g., Composio).',
        'Payment processors (e.g., Stripe, PayPal, Coinbase Commerce).',
        'Infrastructure, hosting, and analytics vendors under contractual confidentiality.',
        'Authorities where required by law, or to protect rights, safety, and security.',
      ] },
    ] },
    { id: 'rights', h: '4. Your Privacy Rights', body: [
      'Depending on your jurisdiction you may have rights to access, correct, delete, restrict, or port your personal data, and to object to certain processing or withdraw consent.',
      'EU/UK residents (GDPR) and California residents (CCPA/CPRA) may exercise these rights at no charge. Submit a request via the Data Subject Access Request form or email ' + LEGAL_META.privacy + '. We will not discriminate against you for exercising your rights.',
    ] },
    { id: 'cookies', h: '5. Cookies & Tracking', body: [
      'We use essential, analytics, and marketing cookies. You can manage non-essential cookies at any time from the consent banner or your account settings. Declining non-essential cookies does not restrict access to the Service. See the Cookie Policy for details.',
    ] },
    { id: 'retention', h: '6. Data Retention', body: [
      'We retain account and content data for as long as your account is active and as needed to provide the Service. Audit and transaction logs are retained for up to seven (7) years to meet tax and legal obligations. Upon verified deletion request, we delete or anonymize personal data except where retention is legally required.',
    ] },
    { id: 'security', h: '7. Security', body: [
      'We protect data in transit with TLS 1.2+/1.3 and at rest with AES-256. Access is role-based and least-privilege, with logging and monitoring. See the Security & Compliance page for our full program.',
    ] },
    { id: 'children', h: '8. Children\u2019s Privacy', body: [
      'The Service is not directed to children under 16 and we do not knowingly collect their data (COPPA). If you believe a child provided us data, contact ' + LEGAL_META.privacy + ' and we will delete it.',
    ] },
    { id: 'intl', h: '9. International Transfers', body: [
      'Where data is transferred internationally, we rely on Standard Contractual Clauses and equivalent safeguards. Enterprise customers may request EU or US data residency.',
    ] },
    { id: 'changes', h: '10. Changes & Contact', body: [
      'We will post updates here and, for material changes, re-display the consent banner and/or notify you. For privacy inquiries contact ' + LEGAL_META.privacy + '.',
    ] },
  ],
};

export const TERMS = {
  slug: 'terms',
  title: 'Terms of Service',
  intro: `These Terms of Service ("Terms") govern your access to and use of the Service provided by ${LEGAL_META.entity}. By creating an account or using the Service, you agree to these Terms and our Privacy Policy.`,
  sections: [
    { id: 'acceptance', h: '1. Acceptance of Terms', body: ['By accessing or using the Service you agree to be bound by these Terms. If you use the Service on behalf of an organization, you represent that you are authorized to bind it.'] },
    { id: 'service', h: '2. Service Description', body: ['Wyzrdy is an AI business operating system that helps you plan, build, optimize, and grow revenue systems across Wyzrdy, Easy Breezy, and ForgeSEO. Features and limits vary by subscription tier.'] },
    { id: 'accounts', h: '3. Accounts & Responsibilities', body: [
      'You are responsible for the accuracy of your registration information and for safeguarding your credentials and all activity under your account.',
      { list: [
        'Do not misuse the Service, reverse engineer it, or interfere with its operation.',
        'Do not upload unlawful, infringing, or harmful content, or violate others\u2019 rights.',
        'Do not attempt unauthorized access, scraping, or circumvention of security or rate limits.',
      ] },
    ] },
    { id: 'ip', h: '4. Intellectual Property & Content', body: [
      'We and our licensors own the Service and all related IP. You retain ownership of content you submit and outputs generated for you, and you grant us a limited license to host and process them to operate the Service. You are responsible for your use of AI outputs.',
    ] },
    { id: 'payment', h: '5. Payment, Billing & Refunds', body: [
      'Paid plans are billed in advance on a recurring basis until cancelled. You authorize recurring charges to your chosen payment method. Except where required by law, fees are non-refundable. You may cancel at any time and retain access through the end of the paid period.',
    ] },
    { id: 'pilot', h: '6. Pilot Program', body: [
      'One-time founding access for your first year: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. Once the limit is reached, this offer is gone. Access is granted only after a payment is successfully verified; registration, a pending or failed payment, or a referral does not grant access. One year of access applies to the Wyzrdy Individual plan only — metered third-party usage, premium add-ons, implementation services and future enterprise services are excluded. After 12 months, standard subscription pricing applies. Founding access is personal and non-transferable. A refunded or disputed payment loses access and no longer counts toward the 20,000 limit.',
    ] },
    { id: 'thirdparty', h: '7. Third-Party Services', body: [
      'The Service integrates third parties (e.g., Composio, Stripe, PayPal, Coinbase, AI providers). Your use of those services is subject to their terms, and we are not responsible for their acts or omissions.',
    ] },
    { id: 'warranty', h: '8. Disclaimers', body: [
      'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. AI outputs may be inaccurate; you are responsible for reviewing them.',
    ] },
    { id: 'liability', h: '9. Limitation of Liability', body: [
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WYZRDY WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOST PROFITS OR DATA. OUR TOTAL LIABILITY WILL NOT EXCEED THE AMOUNTS YOU PAID IN THE 12 MONTHS BEFORE THE CLAIM.',
    ] },
    { id: 'indemnity', h: '10. Indemnification', body: ['You agree to indemnify and hold Wyzrdy harmless from claims arising out of your content, your use of the Service, or your breach of these Terms.'] },
    { id: 'termination', h: '11. Termination', body: ['You may stop using the Service at any time. We may suspend or terminate access for breach, legal risk, or non-payment. Upon termination, your right to use the Service ends; certain provisions survive.'] },
    { id: 'disputes', h: '12. Dispute Resolution & Governing Law', body: [
      'These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-laws rules. Disputes will be resolved by binding arbitration on an individual basis, except claims that may be brought in small-claims court. You may opt out of arbitration within 30 days of acceptance by emailing ' + LEGAL_META.contact + '.',
    ] },
    { id: 'changes', h: '13. Changes & Contact', body: ['We may update these Terms; material changes will be notified and re-consented where required. Continued use constitutes acceptance. Contact ' + LEGAL_META.contact + '.'] },
  ],
};

export const COOKIES = {
  slug: 'cookies',
  title: 'Cookie Policy',
  intro: 'This Cookie Policy explains how we use cookies and similar technologies and how you can control them. You can update your choices anytime via the consent banner or account settings.',
  sections: [
    { id: 'what', h: '1. What Are Cookies', body: ['Cookies are small files stored on your device. We also use localStorage and similar technologies to remember preferences and secure your session.'] },
    { id: 'types', h: '2. Categories We Use', body: [
      { list: [
        'Essential \u2014 required for authentication, security, and core functionality. Always on.',
        'Analytics \u2014 help us understand usage to improve the Service (optional).',
        'Marketing \u2014 support retargeting and campaign measurement (optional).',
        'Integrations \u2014 enable connected third-party services you choose to use (optional).',
      ] },
    ] },
    { id: 'manage', h: '3. Managing Cookies', body: ['Use our consent banner or Settings to accept or reject non-essential categories. You can also control cookies in your browser settings. Declining optional cookies does not limit access to the Service.'] },
    { id: 'retention', h: '4. Duration', body: ['Session cookies expire when you close your browser; persistent cookies last until they expire or you delete them. Consent preferences are stored for up to 12 months before we ask again.'] },
  ],
};

export const SECURITY = {
  slug: 'security',
  title: 'Security & Compliance',
  intro: 'Security is foundational to Wyzrdy. We operate an enterprise-grade program modeled on S&P 500 standards and continuously invest in controls, monitoring, and independent assurance.',
  sections: [
    { id: 'frameworks', h: '1. Frameworks & Certifications', body: [
      { list: [
        'Security controls designed with reference to the SOC 2 Trust Services Criteria (security, availability, confidentiality). We do not currently hold a completed SOC 2 attestation.',
        'ISO/IEC 27001 information security management practices.',
        'GDPR and CCPA/CPRA privacy compliance.',
        'PCI DSS handled through certified payment processors.',
        'HIPAA-ready architecture available for eligible enterprise agreements.',
      ] },
    ] },
    { id: 'encryption', h: '2. Encryption', body: ['Data is encrypted in transit with TLS 1.2+/1.3 and at rest with AES-256. Secrets are stored in isolated, access-controlled vaults.'] },
    { id: 'access', h: '3. Access Control', body: ['We enforce role-based access control (RBAC), least privilege, and support two-factor authentication and, for enterprise, SSO (SAML 2.0 / OAuth) and IP whitelisting. Sessions expire and can be revoked.'] },
    { id: 'logging', h: '4. Audit Logging & Monitoring', body: ['All significant user and system actions are logged with actor, action, resource, and timestamp, retained up to seven years, and monitored for anomalies with alerting on suspicious activity.'] },
    { id: 'resilience', h: '5. Resilience', body: ['We maintain incident response, business continuity, and disaster recovery plans, with regular backups and vendor risk management for all third-party integrations.'] },
    { id: 'testing', h: '6. Testing', body: ['We perform internal security reviews and dependency scanning. Report vulnerabilities to security@wyzrdy.com.'] },
  ],
};

export const ACCESSIBILITY = {
  slug: 'accessibility',
  title: 'Accessibility Statement',
  intro: 'Wyzrdy is committed to digital accessibility for everyone. We aim to conform to WCAG 2.1 Level AA across the Service.',
  sections: [
    { id: 'commitment', h: '1. Our Commitment', body: ['We design and build with accessibility in mind and continually improve the experience for assistive-technology users.'] },
    { id: 'measures', h: '2. Measures We Take', body: [
      { list: [
        'Semantic HTML with proper heading hierarchy and landmarks.',
        'ARIA labels on interactive elements and visible focus indicators.',
        'Color contrast targets of 4.5:1 for text and 3:1 for graphics.',
        'Full keyboard navigation (Tab, Enter, Escape) and skip-to-content links.',
        'Respect for prefers-reduced-motion and no essential time limits.',
        'Descriptive alt text for meaningful images and clear form error messaging.',
      ] },
    ] },
    { id: 'feedback', h: '3. Feedback', body: ['If you encounter a barrier, contact accessibility@wyzrdy.com and we will work to provide the information or functionality you need.'] },
  ],
};

export const DPA = {
  slug: 'dpa',
  title: 'Data Processing Agreement',
  intro: 'This Data Processing Agreement ("DPA") supplements the Terms of Service for enterprise customers ("Controller") whose use of the Service involves Wyzrdy ("Processor") processing personal data on their behalf.',
  sections: [
    { id: 'roles', h: '1. Roles & Scope', body: ['The Controller determines the purposes and means of processing; Wyzrdy processes personal data only per documented instructions and to provide the Service.'] },
    { id: 'obligations', h: '2. Processor Obligations', body: [
      { list: [
        'Process personal data only on the Controller\u2019s instructions.',
        'Ensure personnel are bound by confidentiality.',
        'Implement appropriate technical and organizational security measures.',
        'Assist with data-subject requests and breach notification.',
        'Delete or return personal data at the end of the engagement.',
      ] },
    ] },
    { id: 'subprocessors', h: '3. Sub-processors', body: ['Wyzrdy engages vetted sub-processors (AI, payments, infrastructure) under equivalent obligations and maintains a current list available on request. Controllers may object to new sub-processors on reasonable grounds.'] },
    { id: 'transfers', h: '4. International Transfers', body: ['Cross-border transfers rely on Standard Contractual Clauses and supplementary measures. EU/US data residency is available on request.'] },
    { id: 'contact', h: '5. Contact', body: ['To execute a countersigned DPA, contact ' + LEGAL_META.privacy + '.'] },
  ],
};

export const LEGAL_PAGES = { privacy: PRIVACY, terms: TERMS, cookies: COOKIES, security: SECURITY, accessibility: ACCESSIBILITY, dpa: DPA };
