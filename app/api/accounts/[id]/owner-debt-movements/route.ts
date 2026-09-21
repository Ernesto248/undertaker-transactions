import { z } from "zod";
import { getPool } from "@/lib/db";
import { getOwnerDebtBalance, insertOwnerDebtMovement } from "@/lib/account-owner-debt";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const accountId=z.string().uuid().safeParse((await params).id);
  const ownerId=z.string().uuid().safeParse(new URL(request.url).searchParams.get("ownerId"));
  if(!accountId.success||!ownerId.success)return Response.json({ok:false,error:"validation_error"},{status:400});
  const result=await getPool().query(
    `SELECT id,category,movement_type AS "movementType",amount,signed_delta AS "signedDelta",
            balance_before AS "balanceBefore",balance_after AS "balanceAfter",note,
            source_type AS "sourceType",source_id AS "sourceId",reversal_of_id AS "reversalOfId",
            reversed_at AS "reversedAt",reversed_reason AS "reversedReason",occurred_at AS "occurredAt"
     FROM account_owner_debt_movements
     WHERE gmail_account_id=$1 AND owner_id=$2
     ORDER BY occurred_at DESC,id DESC LIMIT 100`,[accountId.data,ownerId.data]);
  return Response.json({ok:true,movements:result.rows});
}

export async function DELETE(request: Request, { params }: Params) {
  const accountId=z.string().uuid().safeParse((await params).id);
  const body=z.object({movementId:z.string().uuid(),reason:z.string().trim().min(1).max(500)}).safeParse(await request.json().catch(()=>null));
  if(!accountId.success||!body.success)return Response.json({ok:false,error:"validation_error"},{status:400});
  const client=await getPool().connect();
  try{
    await client.query("BEGIN");
    await client.query(`SELECT id FROM gmail_accounts WHERE id=$1 FOR UPDATE`,[accountId.data]);
    const current=await client.query(
      `SELECT * FROM account_owner_debt_movements
       WHERE id=$1 AND gmail_account_id=$2 AND reversed_at IS NULL AND reversal_of_id IS NULL FOR UPDATE`,
      [body.data.movementId,accountId.data]);
    const movement=current.rows[0];
    if(!movement){await client.query("ROLLBACK");return Response.json({ok:false,error:"movement_not_found_or_reversed"},{status:404});}
    if(movement.source_type==='WIRE'||movement.source_type==='PAYMENT'){
      await client.query("ROLLBACK");
      return Response.json({ok:false,error:movement.source_type==='WIRE'?"reverse_from_accounts":"reverse_payment_from_accounts"},{status:409});
    }
    const balance=await getOwnerDebtBalance(client,accountId.data,String(movement.owner_id));
    await client.query(`UPDATE account_owner_debt_movements SET reversed_at=now(),reversed_reason=$2,updated_at=now() WHERE id=$1`,[movement.id,body.data.reason]);
    const reversal=await insertOwnerDebtMovement(client,{accountId:accountId.data,ownerId:String(movement.owner_id),category:movement.category,movementType:"REVERSAL",signedDelta:-Number(movement.signed_delta),note:body.data.reason,reversalOfId:String(movement.id)});
    if(movement.source_type==='SALARY')await client.query(`UPDATE account_owner_salaries SET reverted_at=now(),reverted_reason=$2,updated_at=now() WHERE id=$1`,[movement.source_id,body.data.reason]);
    await client.query("COMMIT");
    return Response.json({ok:true,reversalMovementId:reversal.id,balanceBeforeUsd:balance,balanceAfterUsd:reversal.balanceAfter});
  }catch{try{await client.query("ROLLBACK");}catch{}return Response.json({ok:false,error:"server_error"},{status:500});}finally{client.release();}
}
