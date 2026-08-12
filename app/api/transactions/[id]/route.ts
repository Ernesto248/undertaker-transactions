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

const DeleteSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

async function readBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as unknown;
}

export async function DELETE(request: Request, { params }: Params) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(await params);
  let payload: unknown;
  try {
    payload = await readBody(request);
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsedBody = DeleteSchema.safeParse(payload);

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
    const transaction = await loadTransactionLifecycleRecord(
      client,
      parsedParams.data.id,
      true,
    );
    if (!transaction) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "transaction_not_found" }, { status: 404 });
    }

    const preview = await buildTransactionLifecyclePreview(client, transaction, "delete");
    if (!preview.canProceed) {
      await client.query("ROLLBACK");
      return Response.json(
        { ok: false, error: preview.blocker, preview },
        { status: 409 },
      );
    }

    const reason = parsedBody.data.reason?.trim() || null;
    const updated = await client.query(
      `UPDATE transactions
       SET deleted_at = now(), deletion_reason = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING deleted_at as "deletedAt"`,
      [transaction.id, reason],
    );
    if (!updated.rows[0]?.deletedAt) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "already_deleted" }, { status: 409 });
    }

    await insertTransactionLifecycleAudit(
      client,
      transaction.id,
      "DELETED",
      reason,
      preview,
    );
    await client.query("COMMIT");

    return Response.json(
      {
        ok: true,
        transactionId: transaction.id,
        deletedAt: new Date(updated.rows[0].deletedAt).toISOString(),
        preview,
      },
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
