# Transactions Operations Dashboard

Private financial-operations dashboard built with Next.js and PostgreSQL. This repository is the most complete public variant of a family of three production deployments used to centralize transaction intake, account balances, remittance-agent operations and financial reporting.

## What it solves

The system replaces fragmented manual processing with a single auditable workflow for:

- Ingesting bank and Zelle transactions from n8n.
- Managing banks, accounts and transaction status.
- Assigning transactions to remittance agents (remeseros).
- Tracking agent debt, payments and reversals.
- Maintaining a transactional cash ledger.
- Calculating Zelle FIFO valuation, wire fees, commissions and net profit.
- Safely deleting and restoring transactions with an audit trail.
- Reviewing balances, movements and operational metrics from responsive dashboards.

## Key engineering decisions

- **Idempotent ingestion:** the API validates payloads with Zod and rejects duplicate transactions by bank and confirmation code.
- **Transactional ledger:** cash movements lock the current financial state, store before/after balances and use compensating reversals instead of destructive edits.
- **FIFO valuation:** Zelle inventory is valued in order of consumption so wire profitability can be reported as exact, estimated or unavailable.
- **Auditability:** assignment history, debt snapshots and transaction deletion events preserve the context needed to explain financial changes.
- **Automation boundary:** n8n handles external email/workflow automation while the application owns validation, authorization and persistence.

## Technology

- Next.js 16 App Router
- React 19 and TypeScript
- Neon PostgreSQL with `@neondatabase/serverless`
- Tailwind CSS, Radix UI and Recharts
- React Hook Form and Zod
- Vitest
- n8n over authenticated HTTP webhooks
- Cookie-based application sessions

## Running locally

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env.local` from `.env.example` and set:

   ```env
   DATABASE_URL="postgresql://..."
   N8N_INGEST_API_KEY="replace-with-a-long-random-token"
   APP_ACCESS_PASSWORD="replace-with-the-shared-access-password"
   APP_SESSION_SECRET="replace-with-at-least-32-random-characters"
   ```

3. Apply the SQL migrations in `migrations/` to the development database.

4. Start the development server:

   ```bash
   pnpm dev
   ```

The dashboard is available at http://localhost:3000.

## n8n integration

Send a `POST` request to `/api/transactions` with:

- `bankName`
- `accountName`
- `amount`
- `confirmationCode`

Optional fields include `senderName`, `currency`, `occurredAt` and `postedAt`. Authenticate with:

```
Authorization: Bearer <N8N_INGEST_API_KEY>
```

A duplicate bank/confirmation-code pair returns HTTP 409 instead of creating a second financial record. See [n8n-guide.md](n8n-guide.md) and the example workflow in `n8n/workflows/`.

## Quality checks

```bash
pnpm build
pnpm lint
```

No production customer records or credentials are stored in this repository.
