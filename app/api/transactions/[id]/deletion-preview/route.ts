import { z } from "zod";
import { getPool } from "@/lib/db";
import {
  buildTransactionLifecyclePreview,
  loadTransactionLifecycleRecord,
} from "@/lib/transaction-lifecycle";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await params);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "validation_error" }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    const transaction = await loadTransactionLifecycleRecord(
      client,
      parsed.data.id,
    );
    if (!transaction) {
      return Response.json(
        { ok: false, error: "transaction_not_found" },
        { status: 404 },
      );
    }

    const preview = await buildTransactionLifecyclePreview(
      client,
      transaction,
      "delete",
    );
    return Response.json({ ok: true, preview }, { status: 200 });
  } finally {
    client.release();
  }
}
