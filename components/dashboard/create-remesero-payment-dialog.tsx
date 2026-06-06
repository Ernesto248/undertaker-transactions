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
  useEffect(() => {
    if (zeroOut && remesero.deudaActual > 0) {
      setAmount(String(remesero.deudaActual));
    } else {
      setAmount("");
    }
  }, [zeroOut, remesero.deudaActual]);
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

        <div className="space-y-4">
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

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Registrar pago</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
