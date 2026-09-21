import { z } from "zod";
import { getPool } from "@/lib/db";
import { getOwnerDebtBalance, roundOwnerMoney } from "@/lib/account-owner-debt";
import { loadZelleInventories } from "@/lib/zelle-inventory";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const accountId = z.string().uuid().safeParse((await params).id);
  const url = new URL(request.url);
  const query = z.object({ ownerId:z.string().uuid(), amount:z.coerce.number().finite().positive() }).safeParse({
    ownerId:url.searchParams.get("ownerId"), amount:url.searchParams.get("amount"),
  });
  if (!accountId.success || !query.success) return Response.json({ok:false,error:"validation_error"},{status:400});
  const client = await getPool().connect();
  try {
    const [balance, inventories] = await Promise.all([
      getOwnerDebtBalance(client, accountId.data, query.data.ownerId),
      loadZelleInventories(client, accountId.data),
    ]);
    const available = inventories[0]?.valuation.balanceUsd ?? 0;
    const amount = roundOwnerMoney(query.data.amount);
    return Response.json({ok:true,preview:{balanceBeforeUsd:balance,balanceAfterUsd:roundOwnerMoney(balance-amount),availableZelleUsd:available,zelleAfterUsd:roundOwnerMoney(available-amount),requiresDeficitConfirmation:amount>available}});
  } finally { client.release(); }
}
