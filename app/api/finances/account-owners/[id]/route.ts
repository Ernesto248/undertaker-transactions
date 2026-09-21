import { z } from "zod";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const id = z.string().uuid().safeParse((await params).id);
  const body = z.object({
    name: z.string().trim().min(1).max(160).optional(),
    archived: z.boolean().optional(),
  }).refine((value) => value.name !== undefined || value.archived !== undefined).safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return Response.json({ ok: false, error: "validation_error" }, { status: 400 });
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`SELECT id FROM account_owners WHERE id = $1 FOR UPDATE`, [id.data]);
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "owner_not_found" }, { status: 404 });
    }
    if (body.data.archived) {
      const usage = await client.query(
        `SELECT EXISTS(SELECT 1 FROM gmail_accounts WHERE account_owner_id = $1) AS assigned,
                COALESCE((SELECT SUM(signed_delta) FROM account_owner_debt_movements WHERE owner_id = $1), 0) AS balance`,
        [id.data],
      );
      if (usage.rows[0]?.assigned || Number(usage.rows[0]?.balance ?? 0) !== 0) {
        await client.query("ROLLBACK");
        return Response.json({ ok: false, error: "owner_in_use" }, { status: 409 });
      }
    }
    const result = await client.query(
      `UPDATE account_owners
       SET name = COALESCE($2, name),
           archived_at = CASE WHEN $3::boolean IS NULL THEN archived_at WHEN $3 THEN now() ELSE NULL END,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, archived_at AS "archivedAt"`,
      [id.data, body.data.name ?? null, body.data.archived ?? null],
    );
    await client.query("COMMIT");
    return Response.json({ ok: true, owner: result.rows[0] });
  } catch (error: any) {
    try { await client.query("ROLLBACK"); } catch {}
    if (error?.code === "23505") return Response.json({ ok: false, error: "owner_name_exists" }, { status: 409 });
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally { client.release(); }
}
