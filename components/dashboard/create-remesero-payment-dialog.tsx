"use client";

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
      </DialogContent>
    </Dialog>
  );
}
