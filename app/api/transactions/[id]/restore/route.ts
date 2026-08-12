import { z } from "zod";
import { getPool } from "@/lib/db";
import {
  buildTransactionLifecyclePreview,
  insertTransactionLifecycleAudit,
  loadTransactionLifecycleRecord,
  lockTransactionAccount,
} from "@/lib/transaction-lifecycle";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const RestoreSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

async function getValidatedId(params: Params["params"]) {
  return z.object({ id: z.string().uuid() }).safeParse(await params);
}

export async function GET(_request: Request, { params }: Params) {
  const parsed = await getValidatedId(params);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "validation_error" }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    const transaction = await loadTransactionLifecycleRecord(client, parsed.data.id);
    if (!transaction) {
      return Response.json({ ok: false, error: "transaction_not_found" }, { status: 404 });
    }
    const preview = await buildTransactionLifecyclePreview(client, transaction, "restore");
    return Response.json({ ok: true, preview }, { status: 200 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request, { params }: Params) {
  const parsedParams = await getValidatedId(params);
  let payload: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) payload = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsedBody = RestoreSchema.safeParse(payload);

  if (!parsedParams.success || !parsedBody.success) {
    return Response.json({ ok: false, error: "validation_error" }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const initial = await loadTransactionLifecycleRecord(client, parsedParams.data.id);
    if (!initial) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "transaction_not_found" }, { status: 404 });
    }

    await lockTransactionAccount(client, initial.accountId);
    const transaction = await loadTransactionLifecycleRecord(client, parsedParams.data.id, true);
    if (!transaction) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "transaction_not_found" }, { status: 404 });
    }

    const preview = await buildTransactionLifecyclePreview(client, transaction, "restore");
    if (!preview.canProceed) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: preview.blocker, preview }, { status: 409 });
    }

    const reason = parsedBody.data.reason?.trim() || null;
    const updated = await client.query(
      `UPDATE transactions
       SET deleted_at = NULL, deletion_reason = NULL, updated_at = now()
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING id`,
      [transaction.id],
    );
    if (!updated.rows[0]?.id) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "not_deleted" }, { status: 409 });
    }

    await insertTransactionLifecycleAudit(
      client,
      transaction.id,
      "RESTORED",
      reason,
      preview,
    );
    await client.query("COMMIT");

    return Response.json(
      { ok: true, transactionId: transaction.id, preview },
      { status: 200 },
    );
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {}
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
