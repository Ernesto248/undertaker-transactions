"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  Transaction,
  TransactionLifecycleAction,
  TransactionLifecyclePreview,
} from "@/lib/types";

type Props = {
  transaction: Transaction;
  action: TransactionLifecycleAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (action: TransactionLifecycleAction) => Promise<void> | void;
};

const blockerMessages: Record<string, string> = {
  active_assignment: "Primero debes desasignar esta transacción del remesero.",
  non_positive_transaction: "Solo se pueden eliminar entradas positivas.",
  fifo_partially_consumed:
    "Una parte de esta entrada ya fue consumida por wires o gastos.",
  fifo_fully_consumed:
    "Esta entrada ya fue consumida completamente por wires o gastos.",
  account_would_be_negative:
    "La eliminación dejaría la cuenta con saldo negativo.",
  already_deleted: "La transacción ya está en la papelera.",
  not_deleted: "La transacción ya se encuentra activa.",
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPrice(value: number | null) {
  if (value == null) return "Sin precio";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} CUP/USD`;
}

export function TransactionLifecycleDialog({
  transaction,
  action,
  open,
  onOpenChange,
  onCompleted,
}: Props) {
  const [preview, setPreview] = useState<TransactionLifecyclePreview | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDelete = action === "delete";
  const previewUrl = isDelete
    ? `/api/transactions/${transaction.id}/deletion-preview`
    : `/api/transactions/${transaction.id}/restore`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    setError(null);
    setReason("");

    void fetch(previewUrl, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
          preview?: TransactionLifecyclePreview;
        };
        if (!response.ok || !data.ok || !data.preview) {
          throw new Error(data.error ?? "preview_failed");
        }
        if (!cancelled) setPreview(data.preview);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo comprobar el efecto de la operación.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, previewUrl]);

  const submit = async () => {
    if (!preview?.canProceed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        isDelete
          ? `/api/transactions/${transaction.id}`
          : `/api/transactions/${transaction.id}/restore`,
        {
          method: isDelete ? "DELETE" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        preview?: TransactionLifecyclePreview;
      };
      if (!response.ok || !data.ok) {
        if (data.preview) setPreview(data.preview);
        setError(
          data.error && blockerMessages[data.error]
            ? blockerMessages[data.error]
            : "No se pudo completar la operación.",
        );
        return;
      }

      await onCompleted(action);
      onOpenChange(false);
    } catch {
      setError("No se pudo completar la operación.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isDelete ? "Eliminar transacción" : "Restaurar transacción"}
          </DialogTitle>
          <DialogDescription>
            {isDelete
              ? "Se retirará de los cálculos y pasará a la papelera."
              : "Volverá a incluirse en el saldo y en la valoración del Zelle."}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Comprobando saldo e inventario...
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Monto</p>
                <p className="font-semibold">{formatUsd(preview.amountUsd)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cuenta</p>
                <p className="font-semibold break-words">{preview.accountName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo actual</p>
                <p className="font-semibold">{formatUsd(preview.balanceBeforeUsd)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo resultante</p>
                <p className="font-semibold">{formatUsd(preview.balanceAfterUsd)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">Valoración del Zelle</p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Promedio actual</p>
                  <p>{formatPrice(preview.valuationBefore.averagePrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Promedio resultante</p>
                  <p>{formatPrice(preview.valuationAfter.averagePrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">USD valorados</p>
                  <p>{formatUsd(preview.valuationAfter.pricedUsd)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">USD sin precio</p>
                  <p>{formatUsd(preview.valuationAfter.unpricedUsd)}</p>
                </div>
              </div>
            </div>

            {preview.assignmentHistoryCount > 0 && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Tiene {preview.assignmentHistoryCount} asignación histórica. El
                historial se conservará y ninguna asignación será reactivada.
              </p>
            )}

            {!preview.canProceed && preview.blocker && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {blockerMessages[preview.blocker] ?? "La operación está bloqueada."}
                {preview.blocker.includes("fifo") && (
                  <> Disponible del lote: {formatUsd(preview.availableFromLotUsd)}.</>
                )}
              </p>
            )}

            <div className="space-y-2">
              <label htmlFor={`transaction-${action}-reason`} className="text-sm font-medium">
                Motivo (opcional)
              </label>
              <Input
                id={`transaction-${action}-reason`}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={isDelete ? "Ej. transacción duplicada" : "Ej. eliminación por error"}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={isDelete ? "outline" : "default"}
            className={
              isDelete
                ? "border-amber-500/40 bg-amber-500 text-slate-950 hover:bg-amber-500/90 hover:text-slate-950"
                : undefined
            }
            disabled={!preview?.canProceed || loading || submitting}
            onClick={submit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting
              ? isDelete
                ? "Eliminando..."
                : "Restaurando..."
              : isDelete
                ? "Eliminar"
                : "Restaurar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
