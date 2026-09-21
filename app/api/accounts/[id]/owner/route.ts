import { z } from "zod";
import { getPool } from "@/lib/db";
import { insertOwnerDebtMovement } from "@/lib/account-owner-debt";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  ownerId: z.string().uuid().nullable(),
  ownerFeePercent: z.number().finite().min(0).max(100),
  monthlySalaryUsd: z.number().finite().min(0).nullable(),
  openingBalanceUsd: z.number().finite().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const accountId = z.string().uuid().safeParse((await params).id);
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!accountId.success || !body.success) return Response.json({ ok: false, error: "validation_error" }, { status: 400 });
  if (body.data.openingBalanceUsd && !body.data.ownerId) {
    return Response.json({ ok: false, error: "owner_required_for_opening_balance" }, { status: 400 });
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT account_owner_id AS "ownerId", owner_fee_percent AS "feePercent",
              owner_monthly_salary_usd AS "salaryUsd"
       FROM gmail_accounts WHERE id = $1 FOR UPDATE`,
      [accountId.data],
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return Response.json({ ok: false, error: "account_not_found" }, { status: 404 });
    }
    if (body.data.ownerId) {
      const owner = await client.query(`SELECT id FROM account_owners WHERE id = $1 AND archived_at IS NULL FOR SHARE`, [body.data.ownerId]);
      if (!owner.rows[0]) {
        await client.query("ROLLBACK");
        return Response.json({ ok: false, error: "owner_not_found" }, { status: 404 });
      }
    }
    const change = await client.query(
      `INSERT INTO gmail_account_owner_changes
         (gmail_account_id, previous_owner_id, new_owner_id, previous_fee_percent,
          new_fee_percent, previous_salary_usd, new_salary_usd, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [accountId.data, current.rows[0].ownerId, body.data.ownerId, current.rows[0].feePercent,
       body.data.ownerFeePercent, current.rows[0].salaryUsd, body.data.monthlySalaryUsd, body.data.note ?? null],
    );
    if (current.rows[0].feePercent !== body.data.ownerFeePercent) {
      await client.query(
        `INSERT INTO gmail_account_owner_fee_changes(gmail_account_id, previous_percent, new_percent, note)
         VALUES ($1,$2,$3,$4)`,
        [accountId.data, current.rows[0].feePercent, body.data.ownerFeePercent, body.data.note ?? null],
      );
    }
    await client.query(
      `UPDATE gmail_accounts SET account_owner_id=$2, owner_fee_percent=$3, owner_monthly_salary_usd=$4 WHERE id=$1`,
      [accountId.data, body.data.ownerId, body.data.ownerFeePercent, body.data.monthlySalaryUsd],
    );
    let openingMovementId: string | null = null;
    if (body.data.ownerId && body.data.openingBalanceUsd && body.data.openingBalanceUsd !== 0) {
      const movement = await insertOwnerDebtMovement(client, {
        accountId: accountId.data,
        ownerId: body.data.ownerId,
        category: "OPENING",
        movementType: "ACCRUAL",
        signedDelta: body.data.openingBalanceUsd,
        note: body.data.note ?? "Saldo inicial del dueño",
        sourceType: "OPENING",
        sourceId: String(change.rows[0].id),
      });
      openingMovementId = movement.id;
    }
    await client.query("COMMIT");
    return Response.json({ ok: true, openingMovementId });
  } catch {
    try { await client.query("ROLLBACK"); } catch {}
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally { client.release(); }
}
