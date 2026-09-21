import { getPool } from "@/lib/db";
import type { GmailAccountOption } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const activeOnly = new URL(request.url).searchParams.get("status") === "active";
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT id, account_name as "accountName"
       FROM gmail_accounts
       ${activeOnly ? "WHERE archived_at IS NULL" : ""}
       ORDER BY account_name ASC`,
    );
    const gmailAccounts: GmailAccountOption[] = result.rows.map((row) => ({
      id: String(row.id),
      accountName: String(row.accountName),
    }));
    return Response.json({ ok: true, gmailAccounts }, { status: 200 });
  } finally {
    client.release();
  }
}
