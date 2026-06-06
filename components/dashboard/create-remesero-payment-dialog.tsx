"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Remesero } from "@/lib/types";

type CreateRemeseroPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remesero: Remesero;
  onCreated: () => Promise<void> | void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CreateRemeseroPaymentDialog({
  open,
  onOpenChange,
  remesero,
  onCreated,
}: CreateRemeseroPaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [zeroOut, setZeroOut] = useState(false);
  const [submitState, setSubmitState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  useEffect(() => {
    if (zeroOut && remesero.deudaActual > 0) {
      setAmount(String(remesero.deudaActual));
    } else {
      setAmount("");
    }
  }, [zeroOut, remesero.deudaActual]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSubmitState({ kind: "error", message: "El monto debe ser mayor a 0" });
      return;
    }

    setSubmitState({ kind: "submitting" });

    const body: Record<string, unknown> = { amountPaid: parsed };
    if (note.trim()) body.note = note.trim();

    try {
      const res = await fetch(`/api/remeseros/${remesero.id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        setSubmitState({
          kind: "error",
          message: "No se pudo registrar el pago",
        });
        return;
      }
      await onCreated();
      onOpenChange(false);
    } catch {
      setSubmitState({
        kind: "error",
        message: "No se pudo registrar el pago",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{remesero.nombre}</span>
            {" - Deuda actual: "}
            <span>{formatCurrency(remesero.deudaActual)}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Monto a pagar</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              readOnly={zeroOut}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-note">Nota (opcional)</Label>
            <Input
              id="payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Transferencia"
              maxLength={500}
            />
          </div>

          {remesero.deudaActual > 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="zero-out" className="text-sm font-medium">
                  Dejar en 0
                </Label>
                <p className="text-xs text-muted-foreground">
                  Liquidar la deuda completa
                </p>
              </div>
              <Switch
                id="zero-out"
                checked={zeroOut}
                onCheckedChange={setZeroOut}
              />
            </div>
          ) : null}

          {submitState.kind === "error" ? (
            <p className="text-sm text-destructive">{submitState.message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitState.kind === "submitting"}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitState.kind === "submitting"}>
              {submitState.kind === "submitting"
                ? "Registrando..."
                : "Registrar pago"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
