import { z } from "zod"
import pool from "@/lib/db"

export const runtime = "nodejs"

const IngestTransactionSchema = z.object({
  bankName: z.string().trim().min(1),
  emailAccount: z.string().trim().email(),
  senderName: z.string().trim().min(1).optional().nullable(),
  amount: z.union([z.number(), z.string().trim()]).transform((v) => (typeof v === "string" ? Number(v) : v)),
  currency: z.string().trim().min(1).default("USD"),
  confirmationCode: z.string().trim().min(1),
  occurredAt: z.string().datetime().optional().nullable(),
  postedAt: z.string().datetime().optional().nullable(),
})

function isAuthorized(request: Request) {
  const expected = process.env.N8N_INGEST_API_KEY
  if (!expected) return false

  const authorization = request.headers.get("authorization")
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim()
    return token === expected
  }

  const apiKey = request.headers.get("x-api-key")
  if (apiKey) return apiKey.trim() === expected

  return false
}

async function getOrCreateBankId(client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> }, bankName: string) {
  const existing = await client.query("SELECT id FROM banks WHERE name = $1 LIMIT 1", [bankName])
  if (existing.rows[0]?.id) return existing.rows[0].id as string

  try {
    const inserted = await client.query("INSERT INTO banks (name) VALUES ($1) RETURNING id", [bankName])
    if (inserted.rows[0]?.id) return inserted.rows[0].id as string
  } catch {}

  const fallback = await client.query("SELECT id FROM banks WHERE name = $1 LIMIT 1", [bankName])
  return fallback.rows[0]?.id ?? null
}

async function getOrCreateGmailAccountId(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> },
  emailAddress: string
) {
  const existing = await client.query("SELECT id FROM gmail_accounts WHERE email_address = $1 LIMIT 1", [emailAddress])
  if (existing.rows[0]?.id) return existing.rows[0].id as string

  try {
    const inserted = await client.query("INSERT INTO gmail_accounts (email_address) VALUES ($1) RETURNING id", [emailAddress])
    if (inserted.rows[0]?.id) return inserted.rows[0].id as string
  } catch {}

  const fallback = await client.query("SELECT id FROM gmail_accounts WHERE email_address = $1 LIMIT 1", [emailAddress])
  return fallback.rows[0]?.id ?? null
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = IngestTransactionSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json({ ok: false, error: "validation_error", details: parsed.error.flatten() }, { status: 400 })
  }

  if (!Number.isFinite(parsed.data.amount)) {
    return Response.json({ ok: false, error: "validation_error", details: { amount: ["invalid_number"] } }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const bankId = await getOrCreateBankId(client, parsed.data.bankName)
    const gmailAccountId = await getOrCreateGmailAccountId(client, parsed.data.emailAccount)

    if (!gmailAccountId) {
      await client.query("ROLLBACK")
      return Response.json({ ok: false, error: "gmail_account_not_found" }, { status: 400 })
    }

    const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null
    const postedAt = parsed.data.postedAt ? new Date(parsed.data.postedAt) : null

    const insert = await client.query(
      `INSERT INTO transactions
        (bank_id, gmail_account_id, actor_name, amount, currency, confirmation_code, occurred_at, posted_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        bankId,
        gmailAccountId,
        parsed.data.senderName ?? null,
        parsed.data.amount,
        parsed.data.currency,
        parsed.data.confirmationCode,
        occurredAt,
        postedAt,
      ]
    )

    await client.query("COMMIT")

    if (insert.rows[0]?.id) {
      return Response.json({ ok: true, inserted: true, id: insert.rows[0].id }, { status: 200 })
    }

    return Response.json({ ok: false, error: "insert_failed" }, { status: 500 })
  } catch (err: any) {
    try {
      await client.query("ROLLBACK")
    } catch {}

    if (err?.code === "23505") {
      return Response.json({ ok: false, error: "duplicate_transaction" }, { status: 409 })
    }

    return Response.json({ ok: false, error: "server_error" }, { status: 500 })
  } finally {
    client.release()
  }
}
