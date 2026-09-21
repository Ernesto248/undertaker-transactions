import { getPool } from "@/lib/db";
import type { Bank } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const manualOnly = new URL(request.url).searchParams.get("for") === "manual";
  const client = await getPool().connect();
  try {
    const result = await client.query(
      manualOnly
        ? `SELECT b.id, b.name
           FROM banks b
           WHERE EXISTS (
             SELECT 1
             FROM transactions t
             JOIN gmail_accounts g ON g.id = t.gmail_account_id
             WHERE t.bank_id = b.id AND g.archived_at IS NULL
           )
           ORDER BY b.name ASC`
        : `SELECT id, name FROM banks ORDER BY name ASC`,
    );
    const banks: Bank[] = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
    }));
    return Response.json({ ok: true, banks }, { status: 200 });
  } finally {
    client.release();
  }
}
