# Harbor Health — Community Health & Donor Platform

A role-based healthcare workflow scaffold with a synthetic-data demo. The workspace contains a React/TypeScript frontend, a TypeScript/Express API, shared TypeScript contracts, and explicit PostgreSQL/Azure Blob adapter boundaries.

## Run locally

Requirements: Node.js 22.5+ and npm.

```powershell
npm install
npm start
```

`npm start` (or `npm run dev`) starts the local app. Open the Vite URL (normally `http://localhost:5173`). The API listens on `http://localhost:4000`. Local sign-up/login and donor requests are saved to a SQLite file at `services/api/.local-data/harbor-health.sqlite`; no PostgreSQL installation or credentials are needed for local development. No external font or payment provider is used.

Useful commands:

```powershell
npm run typecheck
npm run build
```

## Workspaces

- `services/web` — React, TypeScript, Fluent UI v9 role-based experience.
- `services/api` — Express API, locally persistent SQLite account and blood-network routes, PostgreSQL production routes, demo feature routes.
- `packages/shared` — shared API/domain types.
- `services/api/src/storage.ts` — PostgreSQL pool and Azure Blob Storage boundary. Production persistence currently covers only the account and blood-network workflows described below; other protected routes fail closed rather than returning demo fixtures.

## Scope and safeguards

- Account roles: blood donors, volunteers, and patients/requesters. Demo-only roles for caregivers, clinicians, and administrators are not offered at sign-up.
- Workflows: local appointment request tracking associated with the selected/entered hospital (persisted to local SQLite, with listed public hospital phone/map links where available; the hospital is not contacted and no slot is reserved), OP payments are disabled until each hospital supplies its official Razorpay appointment/fee integration and approved credentials, clinician-entered medication reminders using prescribed dose/frequency/quantity only (no medication is pre-filled and the app does not recommend doses), health-record/report summaries and manual device-reading entries (demo metadata only; no report file upload/download or device connection), care-team messages, clinic user listing, nearby primary health centres, health centres, clinics, hospitals, mobile health units, laboratories, and pharmacies from OpenStreetMap (browser location is requested only when the user starts a search; coordinates are sent to the public Overpass API and not stored by this app), India's emergency number 112 and helpline links (Police 112, Fire and Rescue 101, Ambulance 108, Women 181/112, Cyber Crime 1930, Child 1098, and Elder 14567), a fictional medicine catalog with demo-only checkout, blood-group and location matching, and sample educational content about fever, hand pain, hydration, and urgent-care guidance. Pharmacy listings do not include medicine inventory, purchases, or payments. Nearby facility data may be incomplete or out of date; facility contacts are shown only when listed by OpenStreetMap. Donor name and phone are available only from that donor's authenticated profile endpoint and are excluded from public requests and match results. Demo fixtures are synthetic and in-memory; production donor phone numbers are encrypted in PostgreSQL. District and city suggestions are examples; donors can enter other locations. The sample content is not clinically reviewed and requires qualified review before clinical use.
- Messages include a separate health information assistant and preserve the Harbor Care Team inbox. Without provider credentials it uses scripted demo replies, not an AI model. To enable model-generated replies, configure `AZURE_OPENAI_ENDPOINT` (HTTPS), `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_DEPLOYMENT` in the API environment; `AZURE_OPENAI_API_VERSION` is optional. User messages and recent conversation turns are sent to that Azure OpenAI resource and handled under its data settings. Complete privacy/security review before sending real patient information. The assistant is not for diagnosis, prescriptions, or emergencies; its messages are not saved by this app.
- The education area is general and non-diagnostic. It does not assess symptoms, diagnose, or prescribe. Emergency copy directs people to local emergency services.
- Checkout is demonstrative only: no order, shipment, or payment is created.
- Local accounts and blood requests are saved to SQLite on this computer; password hashes use scrypt, donor phone numbers are encrypted, and generated development keys are stored in the ignored `.local-data` folder. In local mode, all app pages appear in navigation after sign-in; sensitive actions still check the account role. This is for local development only and is not a production hosting setup.
- Setting `APP_MODE=demo` opts into the in-memory sample data and disables account sign-up/login.
- The PostgreSQL migration creates account, donor-profile, and blood-request tables without seed data. Production mode supports password-based sign-up/login, private donor profiles (phone encrypted at rest using `DONOR_DATA_ENCRYPTION_KEY`), volunteer referral codes, and public active blood requests. Other health workflows remain demo-only and return `503` in production.
- For local development, the API defaults to `APP_MODE=local` and creates its SQLite database and generated signing/encryption keys in the ignored `services/api/.local-data/` folder. This allows sign-up, login, volunteer referrals, donor profiles, and blood requests to work without installing PostgreSQL. Local SQLite data is not production-ready or suitable for shared/real patient use.
- To enable the account and blood-network workflows, configure a private PostgreSQL database and production environment variables for the API. Use a secret manager for `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and `DONOR_DATA_ENCRYPTION_KEY` (at least 32 characters); set `PGSSLMODE=require` for a database that requires TLS. Generate independent random secrets, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Never commit credentials or paste them into support requests.

  ```powershell
  $env:APP_MODE = "production"
  $env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/<database>"
  $env:JWT_SECRET = "<secret from your secret manager>"
  $env:DONOR_DATA_ENCRYPTION_KEY = "<different secret from your secret manager>"
  $env:PGSSLMODE = "require"
  npm run migrate -w @health/api
  npm run build -w @health/shared
  npm run build -w @health/api
  npm run start -w @health/api
  ```

- `npm start` at the repository root is a local development command, not the production server. Build `services/web` separately with `VITE_API_URL` set to the API's public URL, then serve its `dist` directory from your chosen hosting setup and set API `WEB_ORIGIN` to that frontend origin.
- The authentication and donor network implementation is a starting point, not a production-readiness or compliance claim. Before real users, obtain qualified security/privacy review and add operational controls such as rate limiting, account recovery, monitoring, retention/deletion procedures, and jurisdiction-specific review. Donor availability and blood-group entries are self-reported, not clinically verified.
- Production region, jurisdiction, compliance requirements, hosting topology, identity provider, retention, consent, audit, and incident procedures remain undecided. This scaffold makes **no compliance or production-readiness claim**.

See `.azure/integration-plan.md` for the implementation hand-off and remaining data integration work.


    Role	                     Email	                           Password
    Donor	                 harbor.demo@example.test	        Testing-Login-2026!
    Patient / requester	   patient.demo@example.test	      LocalPatient-2026!
    Volunteer	             volunteer.demo@example.test	    LocalVolunteer-2026!

The volunteer referral code is VOL-6A935C03DA1F
