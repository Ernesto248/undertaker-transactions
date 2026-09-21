import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { insertOwnerDebtMovement, roundOwnerMoney } from "@/lib/account-owner-debt";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const accountId = z.string().uuid().safeParse((await params).id);
  const body = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    amountUsd: z.number().finite().positive(),
    note: z.string().trim().max(500).optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!accountId.success || !body.success) return Response.json({ ok: false, error: "validation_error" }, { status: 400 });
  const month = `${body.data.month}-01`;
  const currentParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const currentMonth = `${currentParts.find((part) => part.type === "year")?.value}-${currentParts.find((part) => part.type === "month")?.value}`;
  if (body.data.month > currentMonth) return Response.json({ ok: false, error: "future_salary_month" }, { status: 400 });

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const account = await client.query(
      `SELECT account_owner_id AS "ownerId", owner_monthly_salary_usd AS "defaultSalary"
       FROM gmail_accounts WHERE id=$1 FOR UPDATE`, [accountId.data],
    );
    if (!account.rows[0]) { await client.query("ROLLBACK"); return Response.json({ ok:false,error:"account_not_found"},{status:404}); }
    if (!account.rows[0].ownerId) { await client.query("ROLLBACK"); return Response.json({ ok:false,error:"account_owner_required"},{status:409}); }
    const amount = roundOwnerMoney(body.data.amountUsd);
    const defaultSalary = account.rows[0].defaultSalary == null ? null : Number(account.rows[0].defaultSalary);
    if ((defaultSalary === null || amount !== roundOwnerMoney(defaultSalary)) && !body.data.note) {
      await client.query("ROLLBACK");
      return Response.json({ ok:false,error:"note_required_for_salary_override"},{status:400});
    }
    const salaryId = randomUUID();
    await client.query(
      `INSERT INTO account_owner_salaries(id,gmail_account_id,owner_id,salary_month,amount_usd,note)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [salaryId, accountId.data, account.rows[0].ownerId, month, amount, body.data.note ?? null],
    );
    let movementId: string | null = null;
    if (amount > 0) {
      const movement = await insertOwnerDebtMovement(client, {
        accountId: accountId.data, ownerId: String(account.rows[0].ownerId), category: "SALARY",
        movementType: "ACCRUAL", signedDelta: amount, note: body.data.note ?? `Salario ${body.data.month}`,
        sourceType: "SALARY", sourceId: salaryId,
      });
      movementId = movement.id;
      await client.query(`UPDATE account_owner_salaries SET debt_movement_id=$2 WHERE id=$1`, [salaryId, movementId]);
    }
    await client.query("COMMIT");
    return Response.json({ ok:true,salaryId,movementId }, { status:201 });
  } catch (error:any) {
    try { await client.query("ROLLBACK"); } catch {}
    if (error?.code === "23505") return Response.json({ ok:false,error:"salary_month_exists"},{status:409});
    return Response.json({ ok:false,error:"server_error"},{status:500});
  } finally { client.release(); }
}
