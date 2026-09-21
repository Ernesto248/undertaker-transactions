import { z } from "zod";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

const NameSchema = z.string().trim().min(1).max(160);

export async function GET() {
  const result = await getPool().query(
    `SELECT o.id, o.name, o.archived_at AS "archivedAt",
            COUNT(a.id)::int AS "accountCount"
     FROM account_owners o
     LEFT JOIN gmail_accounts a ON a.account_owner_id = o.id
     GROUP BY o.id
     ORDER BY o.archived_at NULLS FIRST, lower(o.name)`,
  );
  return Response.json({ ok: true, owners: result.rows });
}

export async function POST(request: Request) {
  const parsed = z.object({ name: NameSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "validation_error" }, { status: 400 });
  try {
    const result = await getPool().query(
      `INSERT INTO account_owners(name) VALUES ($1)
       RETURNING id, name, archived_at AS "archivedAt"`,
      [parsed.data.name],
    );
    return Response.json({ ok: true, owner: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "23505") return Response.json({ ok: false, error: "owner_name_exists" }, { status: 409 });
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
