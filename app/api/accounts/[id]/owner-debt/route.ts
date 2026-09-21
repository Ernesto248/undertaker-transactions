import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getOwnerDebtBalance, insertOwnerDebtMovement, roundOwnerMoney } from "@/lib/account-owner-debt";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const accountId = z.string().uuid().safeParse((await params).id);
  const body = z.object({
    ownerId: z.string().uuid(),
    targetBalanceUsd: z.number().finite(),
    note: z.string().trim().min(1).max(500),
  }).safeParse(await request.json().catch(() => null));
  if (!accountId.success || !body.success) return Response.json({ ok:false,error:"validation_error"},{status:400});
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const account = await client.query(`SELECT id FROM gmail_accounts WHERE id=$1 FOR UPDATE`, [accountId.data]);
    const owner = await client.query(
      `SELECT o.id FROM account_owners o
       WHERE o.id=$1 AND (
         EXISTS (SELECT 1 FROM gmail_accounts a WHERE a.id=$2 AND a.account_owner_id=o.id)
         OR EXISTS (SELECT 1 FROM gmail_account_owner_changes c WHERE c.gmail_account_id=$2 AND (c.previous_owner_id=o.id OR c.new_owner_id=o.id))
         OR EXISTS (SELECT 1 FROM account_owner_debt_movements m WHERE m.gmail_account_id=$2 AND m.owner_id=o.id)
       ) FOR SHARE`,
      [body.data.ownerId, accountId.data],
    );
    if (!account.rows[0] || !owner.rows[0]) { await client.query("ROLLBACK"); return Response.json({ok:false,error:"account_or_owner_not_found"},{status:404}); }
    const current = await getOwnerDebtBalance(client, accountId.data, body.data.ownerId);
    const target = roundOwnerMoney(body.data.targetBalanceUsd);
    const delta = roundOwnerMoney(target - current);
    if (delta === 0) { await client.query("COMMIT"); return Response.json({ok:true,movementId:null,balance:current}); }
    const movement = await insertOwnerDebtMovement(client, {
      accountId: accountId.data, ownerId: body.data.ownerId, category:"MANUAL_ADJUSTMENT",
      movementType:"ADJUSTMENT", signedDelta:delta, note:body.data.note,
      sourceType:"MANUAL", sourceId:randomUUID(),
    });
    await client.query("COMMIT");
    return Response.json({ok:true,movementId:movement.id,balance:movement.balanceAfter});
  } catch { try { await client.query("ROLLBACK"); } catch {} return Response.json({ok:false,error:"server_error"},{status:500}); }
  finally { client.release(); }
}
