# Kind Supply CRM

A CRM for Kind Supply Digital and its client workspaces. The CRM lives in `crm/` and deploys as a separate Vercel project with a Vite frontend, a Node.js API, and PostgreSQL.

## What you can do

| Area | Capabilities |
| --- | --- |
| Contacts | Search by practice, contact, email, phone, city, or tags. Filter by region, website health, and overdue follow-ups. Import and export contact CSVs. Review activity and notes on each contact. |
| Pipeline | Drag opportunities between stages or edit stages with the keyboard. Configure stage names and outcomes. Save deal value, monthly retainer, expected close, objections, and demo, proposal, or payment links. |
| Inbox | Group conversations by contact. Log calls, replies, and outreach. Save email and SMS drafts. With provider setup, send drafts and receive matched email and SMS replies. |
| Calendar and tasks | Connect Google Calendar with OAuth, import appointments, sync CRM changes, and resolve conflicting edits. Record appointments in the workspace time zone and track scheduled, completed, canceled, and no-show statuses. Review due tasks and contact reminders. |
| Lead forms | Share an inquiry or booking request form. Create an opportunity for new contacts and a confirmation task for booking requests. |
| Proposals | Publish private links with fixed terms, amount, and expiry. Record acceptance with the submitted name and time. Withdraw a proposal before acceptance. |
| Payments | Create a Stripe-hosted one-time Checkout session or use an approved monthly Stripe price. Track payment activity, invoices, subscriptions, and risk events from signed webhooks. |
| Workflows | Create tasks, tag contacts, set follow-up dates, or queue message drafts when matching events occur. See triggered actions in the run history. |
| Reports | See subscription MRR and ARR, payments received, net receipts, refunds, failed payments, open invoice balances, at-risk MRR, source mix, win rate, and activity. Export contacts or the workspace snapshot. |
| Workspace administration | Create isolated workspaces within one deployment. Invite users with operator or read-only access, and manage membership as the workspace owner. |

## Local preview

Use Node.js 24. From the repository root, run:

```sh
cd crm
npm ci
npm run build
npm run preview
```

Open [http://localhost:4174](http://localhost:4174). Without a database URL, the local preview uses fictional records and stores demo edits in that browser. Public links, message delivery, Stripe, team invitations, and workflow execution require a live workspace.

For hot reload, start `npm run preview` for the API on port 4174 and run `npm run dev` in a separate terminal.

## Deploy to Vercel

1. Create a **separate Vercel project** and import this GitHub repository. Set **Root Directory** to `crm`, **Framework Preset** to Vite, and **Node.js Version** to 24.x. Make sure the branch you deploy contains the `crm/` directory. For a GitHub production deployment from the repository’s default branch, merge this CRM branch first.
2. Connect a hosted PostgreSQL database, such as Neon, and enter the pooled connection string in the Vercel project’s **DATABASE_URL**. Set **APP_URL** to the exact HTTPS origin users will visit. Set these values for each Vercel environment you use. Give previews their own database and origin.
3. In your local checkout, copy `.env.example` to `.env`. Fill in `DATABASE_URL`, `OWNER_EMAIL`, `OWNER_PASSWORD`, and optionally `OWNER_NAME` and `WORKSPACE_NAME`. Use a dedicated CRM password at least 8 characters long. Keep the owner password in the one-time local setup only.
4. Run `npm ci` and `npm run setup` from `crm/` to initialize the schema and create the owner. Vercel builds also initialize the schema when `DATABASE_URL` is configured. Set `OWNER_EMAIL`, `OWNER_PASSWORD`, and optionally `OWNER_NAME` as sensitive Production environment variables for the first build, then remove the bootstrap credentials after setup. For subsequent schema migrations, use `npm run setup -- --migrate-only`. Remove the bootstrap password from the local environment once it has been used.
5. Deploy and sign in. Open **Settings** to invite your team. If you want Stripe or messaging, copy the workspace ID from **Settings → Workspace profile** to the Vercel project’s `INTEGRATION_WORKSPACE_ID`. Provider credentials are available only to that workspace.

You can also deploy the feature branch as its own Vercel project with the CLI. Check out the branch locally, enter `crm/`, and run `npx vercel@latest` to link the directory to a new Vercel project. Set the environment variables on that project and redeploy. Use `npx vercel@latest --prod` from that same directory when you want the production deployment.

The database connection, provider keys, and webhook signing secrets belong in sensitive Vercel environment variables. Deploy with sandbox provider credentials and a dedicated test database before using production payments or outbound messaging.

## Stripe

1. Add a restricted Stripe key as `STRIPE_API_KEY`. Give it the minimum permissions needed for Checkout Sessions and read access to Prices, Subscriptions, Invoices, Invoice Payments, Charges, and Refunds. Check the key permissions in your Stripe sandbox.
2. Configure a Stripe webhook endpoint at `https://YOUR-CRM-DOMAIN/api/crm?route=webhook%2Fstripe` and set `STRIPE_WEBHOOK_SECRET` to that endpoint’s signing secret. Use API version `2026-10-28.endive` for the endpoint.
3. Subscribe to these events.

   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `radar.early_fraud_warning.created`
   - `charge.succeeded`
   - `charge.failed`
   - `payment_intent.payment_failed`
   - `invoice.finalized`
   - `invoice.updated`
   - `invoice.voided`
   - `invoice.marked_uncollectible`

4. For recurring payments, set `STRIPE_MONTHLY_PRICE_IDS` to a comma-separated list of active, flat USD monthly price IDs. Enter the matching monthly amount on the opportunity. Deploy the new environment variables.
5. Create a Checkout link from an opportunity and test one-time payment, subscription checkout, and webhook delivery in Stripe. Copy the hosted link to share it. Stripe Checkout links expire in about 24 hours.

After connecting Stripe, use **Payments → Sync Stripe** to import existing invoices, charges, and subscriptions for the designated account. The import paginates through existing activity. Signed webhooks keep current records updated. This workspace reports all activity in that Stripe account. Assign `INTEGRATION_WORKSPACE_ID` to the intended agency workspace.

Financial tiles total USD activity. Payment tables preserve other currencies. Subscription MRR normalizes licensed recurring prices by quantity and billing interval before discounts and tax, includes active and past-due subscriptions, and excludes trials, unpaid, and canceled subscriptions. ARR is twelve times MRR. Usage and tiered pricing need a separate pricing review. Payment receipts, invoice records, and Checkout records are reconciled through Stripe resource IDs to avoid counting the same payment twice. Period filters apply to receipts and refunds. Open balances and recurring revenue reflect current state.

Stripe tracks recurring billing independently of the commercial terms recorded in a proposal. Set any finite billing schedule or cancellation date in Stripe before using a fixed-term offer. Refunds, subscription changes, and dispute responses are handled in Stripe. Configure [Stripe Tax for recurring payments](https://docs.stripe.com/billing/taxes/collect-taxes) separately if your sales require tax collection.

## Google Calendar

1. In your Google Cloud project, enable Google Calendar API and configure the Google Auth Platform audience.
2. Create OAuth credentials for a **Web application**. Add `https://YOUR-CRM-DOMAIN/api/google-calendar` as the exact authorized redirect URI. For an app in Testing, add the Google account you will connect as a test user. Google controls authorization and any app verification requirements.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `CALENDAR_ENCRYPTION_KEY` as sensitive Production environment variables on the CRM project. Generate the encryption key once with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep the same encryption key for existing connections.
4. Redeploy and open **Settings → Google Calendar → Manage calendar**. Approve access in Google, then choose a calendar that permits creating events.
5. Use **Calendar → Sync Google** for a manual refresh. Google events from the past 90 days and next 365 days are imported. The CRM also syncs when the calendar opens, when the tab becomes visible, and every five minutes while the workspace is open. Local appointment saves attempt synchronization immediately.
6. Resolve any conflicting changes with **Use Google version**. All-day events are displayed by calendar date and edited in Google. Cancel a linked appointment and save it to propagate cancellation.

OAuth state is single-use, expires after ten minutes, and is bound to the signed-in administrator and workspace. Refresh tokens are encrypted in PostgreSQL using AES-256-GCM. Provider tokens never appear in workspace responses or exports. Calendar changes use Google event IDs, sync tokens, and ETags. Background processing while the CRM is closed and public booking availability are separate capabilities. Appointment invitations are managed in Google.

## Email, SMS, and calls

- **Email** uses `RESEND_API_KEY` and `RESEND_FROM` with a verified sending identity. Inbound email also needs a receiving domain and `RESEND_WEBHOOK_SECRET`. In the CRM, generate webhook addresses under **Settings → Inbound webhooks** and use the inbound email address as the endpoint for `email.received`.
- **SMS** uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM`. Use the copied inbound SMS address as the number’s inbound messaging webhook with the POST method. Enable opt-out handling in Twilio. Signed STOP messages clear permission in the CRM.
- **Missed calls** use the copied voice address as a POST status callback on your existing call-routing service. Forwarding and answering are configured in that service. The CRM logs a missed-call event when the provider reports a missed status for a uniquely matched contact.
- The app matches inbound messages to an existing contact only when the sending address or phone identifies one record. Use the provider inbox for unrecognized or ambiguous recipients. A submitted outbound message means the provider accepted the request. Verify delivery status in the provider dashboard.
- Sending requires explicit contact permission and review of the draft. An ambiguous delivery attempt needs provider review before being resent.

Keep provider dashboard URLs identical to the full generated endpoint. Providers must be able to reach webhooks and clients must be able to reach published forms and proposals. The CRM requires sign-in for workspace endpoints.

## Data and operating scope

This release is sized for an agency sales team. It uses a versioned record model in a transactionally locked PostgreSQL workspace document. Keep separate PostgreSQL backups. The JSON export is a readable snapshot, and CSV import brings in contact rows. Shared capture links are for business inquiries. Appointment requests go to the team for confirmation. Proposal acceptance records the submitted name and timestamp through a bearer link.

The CRM covers internal sales and follow-up. For an agency product that resells client accounts, visual funnel or website building, drag-and-drop workflow branching, bulk sequences, public Google Calendar booking availability, dedicated e-signatures, and per-client email/SMS/Stripe accounts need separate implementation.

## Repository layout and verification

| Location | Contents |
| --- | --- |
| `src/` | Workspace UI, local demo, views, data entry, and import/export |
| `server/` | Authentication, permissions, workspace records, workflows, messaging, and Stripe |
| `api/crm.js` | Vercel Function entry point |
| `server/schema.sql` | PostgreSQL schema |
| `test/` | CSV and HTTP integration coverage |

Run `npm test` for the automated suite and `npm run build` for the production bundle. The automated suite uses an embedded PostgreSQL engine and signed provider fixtures. Provider sandbox charges, messaging delivery, webhooks against the Vercel origin, and production deployment can be verified once your project and sandbox credentials are configured.
