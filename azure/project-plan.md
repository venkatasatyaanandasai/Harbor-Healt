# Community Health and Donor Platform — Project Plan

**Status**: Approved
**Created**: 2026-10-28
**Mode**: Interactive

## 1. Project Overview

Build a new healthcare web platform for patients, caregivers, clinicians, administrators, and blood donors. It will provide role-based dashboards and workflows for appointments, medication lists and reminders, records and test results, care-team messaging, clinic/user administration, a medicine catalog with demo-only checkout, donor registration, blood-type/location-based matching and requests, and educational symptom guidance.

## 2. Goals & Scope

- Support authenticated, role-appropriate experiences for the five user groups.
- Offer symptom education limited to general self-care and urgent-care guidance. No automated diagnosis or prescription. Clinical guidance is shown only when supplied or approved as clinician-reviewed material.
- Provide AI-oriented recommendations only within this non-diagnostic educational scope; do not make clinical decisions or imply that AI output is clinician-reviewed.
- Include a sample-data demo mode distinct from production mode. Checkout is demonstrative only; no real payment processing is in scope.
- Keep production region undecided and configurable. Production readiness, jurisdictional requirements, and any compliance determination require later human review; this plan makes no compliance claim.

## 3. Architecture

- **Frontend**: React with TypeScript, providing accessible, role-based dashboards and feature workflows.
- **Backend**: TypeScript with Express, exposing authenticated APIs and enforcing role- and resource-level authorization.
- **Data**: PostgreSQL for structured application data; Blob Storage for records, test results, and other files.
- **Integration boundary**: Keep demo/sample data and production configuration separated. Keep AI recommendation behavior behind a replaceable service boundary and constrain its inputs/outputs to approved educational material and non-diagnostic guidance.
- **Hosting**: Azure-oriented deployment can be selected during implementation; region, service SKUs, and production topology remain undecided pending requirements and review.

## 4. Data & API

Core records include user/role and clinic membership, appointments, medication lists/reminders, record and result metadata with file references, care-team messages, medicine catalog items, donor profiles/preferences, and blood requests/matches. Define API contracts for authentication/authorization, each role-appropriate workflow, donor matching, and administration. Donor matching uses blood type and location criteria; avoid exposing more location or health information than the workflow requires.

Use PostgreSQL and Blob Storage as captured in requirements. Final schemas, retention periods, access policies, and production data migration rules require implementation-time decisions and review. Demo fixtures must be synthetic and clearly separated from production data.

## 5. Security, Safety & Environments

Require sign-in for protected API features and enforce least-privilege access on every operation. Plan secure transport and storage, auditable access to sensitive records, safe file handling, and privacy-conscious logging; implementation and deployment must validate these controls. Do not place production data in demo mode.

Maintain distinct demo and production configuration/data paths. Before production use, establish the deployment region, jurisdiction-specific obligations, identity and operational controls, data retention and incident procedures, and obtain qualified review. No regulatory compliance or production-readiness claim is made by this plan.

## 6. Design System & UI

**Component Library**: Fluent UI v9

Use a responsive, accessible interface with clear role navigation and distinct dashboards for patients, caregivers, clinicians, administrators, and donors. Prioritize readable clinical information, explicit empty/loading/error states, and clear separation between educational guidance and clinician-provided content. The demo mode must be visibly labeled; the catalog checkout must state that it is not a real transaction.

## 7. Delivery Plan

1. Establish app structure, shared design system, authentication, role authorization, and isolated demo/production configuration.
2. Implement core profiles, appointments, medication lists/reminders, records/results, messaging, and administration APIs and screens.
3. Implement medicine catalog/demo checkout and donor registration, requests, and blood-type/location matching.
4. Add bounded educational guidance using only supplied/approved clinician-reviewed material; validate safety copy and prevent diagnosis/prescription behavior.
5. Test role and resource authorization, accessibility, data separation, file handling, and end-to-end workflows. Treat production deployment as a separate review after region and operational requirements are decided.

## 8. Open Decisions

- Production Azure region and jurisdictional requirements.
- Production hosting topology, service tiers, and identity-provider choice.
- Retention, consent, audit, support, and operational procedures.
- Source and review/maintenance process for clinician-approved educational content, and whether/how a non-diagnostic AI recommendation feature is enabled.
- Any real commerce or payment scope (not included in this demo-checkout plan).
