"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFinanceNumberInput, parseFinanceNumberInput } from "@/lib/finances";
import type { AccountOwnerDebt, AccountOwnerDebtCategory, AccountOwnerDebtMovement } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryLabels: Record<AccountOwnerDebtCategory, string> = {
  COMMISSION: "Comisiones",
  SALARY: "Salario",
  OPENING: "Saldo inicial",
  MANUAL_ADJUSTMENT: "Ajustes",
};

function money(value: number) {
  return new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(value);
}

function currentNewYorkMonth() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export function AccountOwnerDebtsPanel({ debts, totals, onChanged }: {
  debts: AccountOwnerDebt[];
  totals: { payableUsd: number; creditUsd: number; netPayableUsd: number };
  onChanged: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [movements, setMovements] = useState<Record<string, AccountOwnerDebtMovement[]>>({});
  const [mode, setMode] = useState<Record<string, "salary" | "edit" | "pay" | null>>({});
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [month, setMonth] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<Record<string, AccountOwnerDebtCategory>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const keyOf = (debt: AccountOwnerDebt) => `${debt.accountId}:${debt.ownerId}`;
  const loadHistory = async (debt: AccountOwnerDebt) => {
    const key = keyOf(debt);
    const response = await fetch(`/api/accounts/${debt.accountId}/owner-debt-movements?ownerId=${debt.ownerId}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.ok) setMovements((current) => ({ ...current, [key]: payload.movements }));
  };
  const toggle = async (debt: AccountOwnerDebt) => {
    const key = keyOf(debt);
    const next = !expanded[key];
    setExpanded((current) => ({ ...current, [key]: next }));
    if (next) await loadHistory(debt);
  };
  const submit = async (debt: AccountOwnerDebt) => {
    const key = keyOf(debt);
    const selectedMode = mode[key];
    const parsedAmount = parseFinanceNumberInput(amount[key] ?? "");
    if (!selectedMode || !Number.isFinite(parsedAmount) || (selectedMode !== "edit" && parsedAmount <= 0) || !(note[key] ?? "").trim() && selectedMode === "edit") return;
    setSaving((current) => ({ ...current, [key]: true }));
    try {
      let response: Response;
      if (selectedMode === "salary") {
        response = await fetch(`/api/accounts/${debt.accountId}/owner-salaries`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({month:month[key] ?? currentNewYorkMonth(),amountUsd:parsedAmount,note:(note[key] ?? "").trim() || undefined}) });
      } else if (selectedMode === "edit") {
        response = await fetch(`/api/accounts/${debt.accountId}/owner-debt`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ownerId:debt.ownerId,targetBalanceUsd:parsedAmount,note:(note[key] ?? "").trim()}) });
      } else {
        const body = {ownerId:debt.ownerId,category:category[key] ?? "COMMISSION",amountUsd:parsedAmount,note:(note[key] ?? "").trim() || undefined};
        response = await fetch(`/api/accounts/${debt.accountId}/owner-payments`, { method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body) });
        if (response.status === 409) {
          const payload = await response.json().catch(() => null);
          if (payload?.error === "deficit_confirmation_required" && window.confirm(`El pago supera el Zelle disponible (${money(payload.availableZelleUsd)} USD). ¿Continuar y dejar déficit?`)) {
            response = await fetch(`/api/accounts/${debt.accountId}/owner-payments`, { method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,confirmDeficit:true}) });
          }
        }
      }
      if (!response.ok) return;
      setMode((current) => ({ ...current, [key]: null }));
      setAmount((current) => ({ ...current, [key]: "" }));
      setNote((current) => ({ ...current, [key]: "" }));
      await onChanged();
    } finally { setSaving((current) => ({ ...current, [key]: false })); }
  };

  return (
    <Card className="border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-card to-card">
      <CardHeader><CardTitle>Deuda con dueños de cuentas</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-background/60 p-3"><p className="text-xs text-muted-foreground">Por pagar</p><strong>{money(totals.payableUsd)} USD</strong></div>
          <div className="rounded-xl bg-background/60 p-3"><p className="text-xs text-muted-foreground">Crédito</p><strong>{money(totals.creditUsd)} USD</strong></div>
          <div className="rounded-xl bg-background/60 p-3"><p className="text-xs text-muted-foreground">Neto</p><strong>{money(totals.netPayableUsd)} USD</strong></div>
        </div>
        {debts.length === 0 ? <p className="text-sm text-muted-foreground">Configura un dueño desde la tarjeta de una cuenta.</p> : debts.map((debt) => {
          const key=keyOf(debt); const isExpanded=expanded[key]; const selectedMode=mode[key];
          return <div key={key} className="rounded-2xl border border-border/70 bg-background/45 p-4">
            <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => void toggle(debt)}>
              <div><p className="font-semibold">{debt.accountName} · {debt.ownerName}</p><p className="text-xs text-muted-foreground">{debt.isCurrentOwner ? "Dueño actual" : "Dueño anterior"} · {debt.balanceUsd >= 0 ? "Por pagar" : "Crédito"}</p></div>
              <div className="flex items-center gap-2"><strong className={debt.balanceUsd < 0 ? "text-emerald-400" : "text-amber-300"}>{money(Math.abs(debt.balanceUsd))} USD</strong><ChevronDown className={cn("h-4 w-4 transition-transform",isExpanded&&"rotate-180")} /></div>
            </button>
            {isExpanded ? <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{(["COMMISSION","SALARY","OPENING","MANUAL_ADJUSTMENT"] as const).map((item)=><div key={item} className="rounded-lg bg-secondary/35 p-2"><p className="text-muted-foreground">{categoryLabels[item]}</p><strong>{money(debt[item === "COMMISSION" ? "commissionUsd" : item === "SALARY" ? "salaryUsd" : item === "OPENING" ? "openingUsd" : "manualAdjustmentUsd"])} USD</strong></div>)}</div>
              <div className="flex flex-wrap gap-2">
                {debt.isCurrentOwner ? <Button size="sm" variant="outline" onClick={()=>{setMode(c=>({...c,[key]:"salary"}));setAmount(c=>({...c,[key]:formatFinanceNumberInput(debt.monthlySalaryUsd??0)}));setMonth(c=>({...c,[key]:currentNewYorkMonth()}));}}>Generar salario</Button> : null}
                <Button size="sm" variant="outline" onClick={()=>{setMode(c=>({...c,[key]:"edit"}));setAmount(c=>({...c,[key]:formatFinanceNumberInput(debt.balanceUsd)}));}}>Fijar deuda</Button>
                <Button size="sm" onClick={()=>{setMode(c=>({...c,[key]:"pay"}));setAmount(c=>({...c,[key]:""}));}}>Registrar pago</Button>
              </div>
              {selectedMode ? <div className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
                {selectedMode==="salary"?<div><Label>Mes</Label><Input type="month" max={currentNewYorkMonth()} value={month[key]??currentNewYorkMonth()} onChange={e=>setMonth(c=>({...c,[key]:e.target.value}))}/></div>:null}
                {selectedMode==="pay"?<div><Label>Concepto</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3" value={category[key]??"COMMISSION"} onChange={e=>setCategory(c=>({...c,[key]:e.target.value as AccountOwnerDebtCategory}))}>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>:null}
                <div><Label>{selectedMode==="edit"?"Saldo final USD":"Monto USD"}</Label><Input inputMode="decimal" value={amount[key]??""} onChange={e=>setAmount(c=>({...c,[key]:formatFinanceNumberInput(e.target.value)}))}/></div>
                <div><Label>Nota {selectedMode==="edit"?"(obligatoria)":""}</Label><Input value={note[key]??""} onChange={e=>setNote(c=>({...c,[key]:e.target.value}))}/></div>
                <div className="flex items-end gap-2"><Button disabled={saving[key]} onClick={()=>void submit(debt)}>{saving[key]?"Guardando...":"Confirmar"}</Button><Button variant="ghost" onClick={()=>setMode(c=>({...c,[key]:null}))}>Cancelar</Button></div>
              </div>:null}
              <div className="space-y-2">{(movements[key]??[]).map((movement)=><div key={movement.id} className={cn("flex items-center justify-between rounded-lg border border-border/50 p-2 text-xs",movement.reversedAt&&"opacity-50")}><div><strong>{categoryLabels[movement.category]} · {movement.signedDelta>0?"+":""}{money(movement.signedDelta)} USD</strong><p className="text-muted-foreground">{new Date(movement.occurredAt).toLocaleString("es-DO")}{movement.note?` · ${movement.note}`:""}</p></div>{!movement.reversedAt&&movement.sourceType!=="WIRE"&&movement.sourceType!=="PAYMENT"?<Button size="icon" variant="ghost" onClick={async()=>{const response=await fetch(`/api/accounts/${debt.accountId}/owner-debt-movements`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({movementId:movement.id,reason:"Revertido desde Finanzas"})});if(response.ok){await loadHistory(debt);await onChanged();}}}><RotateCcw className="h-4 w-4"/></Button>:null}</div>)}</div>
            </div>:null}
          </div>;
        })}
      </CardContent>
    </Card>
  );
}
