import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { insertOwnerDebtMovement, roundOwnerMoney, type OwnerDebtCategory } from "@/lib/account-owner-debt";
import { loadZelleInventories } from "@/lib/zelle-inventory";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
const Category = z.enum(["COMMISSION","SALARY","OPENING","MANUAL_ADJUSTMENT"]);

export async function POST(request: Request, { params }: Params) {
  const accountId = z.string().uuid().safeParse((await params).id);
  const body = z.object({ownerId:z.string().uuid(),category:Category,amountUsd:z.number().finite().positive(),note:z.string().trim().max(500).optional(),confirmDeficit:z.boolean().optional()}).safeParse(await request.json().catch(()=>null));
  if (!accountId.success || !body.success) return Response.json({ok:false,error:"validation_error"},{status:400});
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const account = await client.query(`SELECT id FROM gmail_accounts WHERE id=$1 FOR UPDATE`,[accountId.data]);
    const owner = await client.query(
      `SELECT o.id FROM account_owners o
       WHERE o.id=$1 AND (
         EXISTS (SELECT 1 FROM gmail_accounts a WHERE a.id=$2 AND a.account_owner_id=o.id)
         OR EXISTS (SELECT 1 FROM gmail_account_owner_changes c WHERE c.gmail_account_id=$2 AND (c.previous_owner_id=o.id OR c.new_owner_id=o.id))
         OR EXISTS (SELECT 1 FROM account_owner_debt_movements m WHERE m.gmail_account_id=$2 AND m.owner_id=o.id)
       ) FOR SHARE`,
      [body.data.ownerId, accountId.data],
    );
    if(!account.rows[0]||!owner.rows[0]){await client.query("ROLLBACK");return Response.json({ok:false,error:"account_or_owner_not_found"},{status:404});}
    const inventories=await loadZelleInventories(client,accountId.data);
    const available=inventories[0]?.valuation.balanceUsd??0;
    const amount=roundOwnerMoney(body.data.amountUsd);
    if(amount>available&&!body.data.confirmDeficit){await client.query("ROLLBACK");return Response.json({ok:false,error:"deficit_confirmation_required",availableZelleUsd:available},{status:409});}
    const outflowId=randomUUID();
    const debt=await insertOwnerDebtMovement(client,{accountId:accountId.data,ownerId:body.data.ownerId,category:body.data.category as OwnerDebtCategory,movementType:"PAYMENT",signedDelta:-amount,note:body.data.note??"Pago al dueño",sourceType:"PAYMENT",sourceId:outflowId});
    await client.query(`INSERT INTO account_outflow_movements(id,gmail_account_id,movement_type,amount,note,account_owner_debt_movement_id) VALUES($1,$2,'owner_payment',$3,$4,$5)`,[outflowId,accountId.data,amount,body.data.note??"Pago al dueño",debt.id]);
    await client.query("COMMIT");
    return Response.json({ok:true,paymentId:outflowId,debtMovementId:debt.id,balanceAfterUsd:debt.balanceAfter},{status:201});
  }catch{try{await client.query("ROLLBACK");}catch{}return Response.json({ok:false,error:"server_error"},{status:500});}finally{client.release();}
}
