import { z } from "zod";
import { getPool } from "@/lib/db";
import type { AccountBalance } from "@/lib/types";

export const runtime = "nodejs";

const OptionalStringSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.string().trim().optional());

const CreateAccountMovementSchema = z.object({
  accountId: z.string().uuid(),
  movementType: z.enum(["wire", "expense"]),
  amount: z
    .union([z.number(), z.string().trim()])
    .transform((value) => (typeof value === "string" ? Number(value) : value))
    .refine(
      (value) => Number.isFinite(value) && value > 0,
      "amount must be > 0",
    ),
  note: OptionalStringSchema,
});

function mapAccountRow(row: any): AccountBalance {
  return {
    id: String(row.id),
    accountName: String(row.accountName),
    incomingTotal: Number(row.incomingTotal ?? 0),
    outgoingTotal: Number(row.outgoingTotal ?? 0),
    balance: Number(row.balance ?? 0),
    transactionCount: Number(row.transactionCount ?? 0),
    lastTransactionAt: row.lastTransactionAt
      ? new Date(row.lastTransactionAt).toISOString()
      : null,
  };
}

function parseDateParam(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromParam = parseDateParam(url.searchParams.get("from"));
  const toParam = parseDateParam(url.searchParams.get("to"));

  if (url.searchParams.get("from") && !fromParam) {
    return Response.json({ ok: false, error: "invalid_from" }, { status: 400 });
  }

  if (url.searchParams.get("to") && !toParam) {
    return Response.json({ ok: false, error: "invalid_to" }, { status: 400 });
  }

  const values: unknown[] = [];
  const txFilters: string[] = [];
  const movementFilters: string[] = [];

  if (fromParam) {
    values.push(fromParam);
    const placeholder = `$${values.length}`;
    txFilters.push(`COALESCE(occurred_at, created_at) >= ${placeholder}`);
    movementFilters.push(`created_at >= ${placeholder}`);
  }

  if (toParam) {
    values.push(toParam);
    const placeholder = `$${values.length}`;
    txFilters.push(`COALESCE(occurred_at, created_at) <= ${placeholder}`);
    movementFilters.push(`created_at <= ${placeholder}`);
  }

  const txWhere =
    txFilters.length > 0 ? `WHERE ${txFilters.join(" AND ")}` : "";
  const movementWhere =
    movementFilters.length > 0 ? `AND ${movementFilters.join(" AND ")}` : "";

  const client = await getPool().connect();

  try {
    const result = await client.query(
      `
      SELECT
        g.id,
        g.account_name as "accountName",
        COALESCE(tx.total_incoming, 0) as "incomingTotal",
        COALESCE(m.total_outgoing, 0) as "outgoingTotal",
        (COALESCE(tx.total_incoming, 0) - COALESCE(m.total_outgoing, 0)) as "balance",
        COALESCE(tx.transaction_count, 0) as "transactionCount",
        tx.last_transaction_at as "lastTransactionAt"
      FROM gmail_accounts g
      LEFT JOIN (
        SELECT
          gmail_account_id,
          SUM(amount) as total_incoming,
          COUNT(*) as transaction_count,
          MAX(COALESCE(occurred_at, created_at)) as last_transaction_at
        FROM transactions
        ${txWhere}
        GROUP BY gmail_account_id
      ) tx ON tx.gmail_account_id = g.id
      LEFT JOIN (
        SELECT
          gmail_account_id,
          SUM(amount) as total_outgoing
        FROM account_outflow_movements
        WHERE reverted_at IS NULL
        ${movementWhere}
        GROUP BY gmail_account_id
      ) m ON m.gmail_account_id = g.id
      WHERE g.account_name !~* '^\\s*vigo\\s+capital\\s+solutions(\\s+llc)?\\s*$'
      ORDER BY g.account_name ASC
      `,
      values,
    );

    const accounts: AccountBalance[] = result.rows.map(mapAccountRow);
    return Response.json({ ok: true, accounts }, { status: 200 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateAccountMovementSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const client = await getPool().connect();

  try {
    const inserted = await client.query(
      `
      INSERT INTO account_outflow_movements
        (gmail_account_id, movement_type, amount, note)
      VALUES
        ($1, $2, $3, $4)
      RETURNING id
      `,
      [
        parsed.data.accountId,
        parsed.data.movementType,
        parsed.data.amount,
        parsed.data.note ?? null,
      ],
    );

    return Response.json(
      { ok: true, movementId: inserted.rows[0]?.id ?? null },
      { status: 201 },
    );
  } catch (err: any) {
    if (err?.code === "23503") {
      return Response.json(
        { ok: false, error: "account_not_found" },
        { status: 404 },
      );
    }

    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = z
    .object({
      movementId: z.string().uuid(),
      reason: OptionalStringSchema,
    })
    .safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const client = await getPool().connect();

  try {
    const result = await client.query(
      `
      UPDATE account_outflow_movements
      SET
        reverted_at = now(),
        reverted_reason = COALESCE($2, reverted_reason),
        updated_at = now()
      WHERE id = $1 AND reverted_at IS NULL
      RETURNING id
      `,
      [parsed.data.movementId, parsed.data.reason ?? null],
    );

    if (!result.rows[0]?.id) {
      return Response.json(
        { ok: false, error: "movement_not_found_or_already_reverted" },
        { status: 404 },
      );
    }

    return Response.json({ ok: true }, { status: 200 });
  } finally {
    client.release();
  }
}
