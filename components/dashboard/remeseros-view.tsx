"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, MessageCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Remesero,
  RemeseroPayment,
  RemeseroShareSummary,
} from "@/lib/types";

type RemeserosViewProps = {
  remeseros: Remesero[];
  paymentsByRemesero: Record<string, RemeseroPayment[]>;
  loadingRemeseros: boolean;
  loadingPaymentsByRemesero: Record<string, boolean>;
  onRefreshRemeseros: () => Promise<void>;
  onCreateRemesero: (input: {
    nombre: string;
    precioActual: number;
  }) => Promise<void>;
  onUpdateRemesero: (
    id: string,
    input: { nombre?: string; precioActual?: number },
  ) => Promise<void>;
  onDeleteRemesero: (id: string) => Promise<void>;
  onLoadPayments: (id: string) => Promise<void>;
  onCreatePayment: (
    id: string,
    input: { amountPaid: number; note?: string },
  ) => Promise<void>;
  onRevertPayment: (
    remeseroId: string,
    paymentId: string,
    reason?: string,
  ) => Promise<void>;
  onGetShareSummary: (id: string) => Promise<RemeseroShareSummary | null>;
};

export function RemeserosView({
  remeseros,
  paymentsByRemesero,
  loadingRemeseros,
  loadingPaymentsByRemesero,
  onRefreshRemeseros,
  onCreateRemesero,
  onUpdateRemesero,
  onDeleteRemesero,
  onLoadPayments,
  onCreatePayment,
  onRevertPayment,
  onGetShareSummary,
}: RemeserosViewProps) {
  const [newNombre, setNewNombre] = useState("");
  const [newPrecio, setNewPrecio] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [showPaymentsByRemesero, setShowPaymentsByRemesero] = useState<
    Record<string, boolean>
  >({});
  const [editingById, setEditingById] = useState<
    Record<string, { nombre: string; precioActual: string }>
  >({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});
  const [paymentDraftById, setPaymentDraftById] = useState<
    Record<string, { amountPaid: string; note: string }>
  >({});
  const [creatingPaymentById, setCreatingPaymentById] = useState<
    Record<string, boolean>
  >({});
  const [revertingPaymentById, setRevertingPaymentById] = useState<
    Record<string, boolean>
  >({});
  const [sharingById, setSharingById] = useState<Record<string, boolean>>({});

  const totals = useMemo(() => {
    const deudaTotal = remeseros.reduce(
      (acc, remesero) => acc + remesero.deudaActual,
      0,
    );
    return { deudaTotal };
  }, [remeseros]);

  const formatUsd = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatLocal = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatLocalFlexible = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDateTime = (value: string) => {
    return new Date(value).toLocaleString("es-DO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatThousandsInput = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    if (!digitsOnly) return "";

    return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const parseThousandsInput = (value: string) => {
    const normalized = value.replace(/,/g, "").trim();
    return Number(normalized);
  };

  const ensureEditing = (remesero: Remesero) => {
    const current = editingById[remesero.id];
    if (current) return current;
    return {
      nombre: remesero.nombre,
      precioActual: String(remesero.precioActual),
    };
  };

  const handleCreate = async () => {
    if (!newNombre.trim()) return;
    const parsedPrice = Number(newPrecio);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return;

    setCreating(true);
    try {
      await onCreateRemesero({
        nombre: newNombre.trim(),
        precioActual: parsedPrice,
      });
      setNewNombre("");
      setNewPrecio("");
      setCreateModalOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePayments = async (id: string) => {
    const nextVisible = !(showPaymentsByRemesero[id] === true);
    setShowPaymentsByRemesero((prev) => ({ ...prev, [id]: nextVisible }));

    if (nextVisible) {
      await onLoadPayments(id);
    }
  };

  const handleSave = async (id: string) => {
    const draft = editingById[id];
    if (!draft) return;

    const payload: { nombre?: string; precioActual?: number } = {};

    if (draft.nombre.trim()) {
      payload.nombre = draft.nombre.trim();
    }

    if (draft.precioActual.trim() !== "") {
      const parsedPrice = Number(draft.precioActual);
      if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
        payload.precioActual = parsedPrice;
      }
    }

    if (Object.keys(payload).length === 0) return;

    setSavingById((prev) => ({ ...prev, [id]: true }));
    try {
      await onUpdateRemesero(id, payload);
    } finally {
      setSavingById((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingById((prev) => ({ ...prev, [id]: true }));
    try {
      await onDeleteRemesero(id);
    } finally {
      setDeletingById((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCreatePayment = async (id: string) => {
    const draft = paymentDraftById[id] ?? { amountPaid: "", note: "" };
    const amountPaid = parseThousandsInput(draft.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) return;

    setCreatingPaymentById((prev) => ({ ...prev, [id]: true }));
    try {
      await onCreatePayment(id, {
        amountPaid,
        note: draft.note.trim() || undefined,
      });
      setPaymentDraftById((prev) => ({
        ...prev,
        [id]: { amountPaid: "", note: "" },
      }));
    } finally {
      setCreatingPaymentById((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleShareWhatsapp = async (remesero: Remesero) => {
    // iOS Safari bloquea window.open si ocurre despues de awaits.
    const pendingWindow = window.open("about:blank", "_blank");

    setSharingById((prev) => ({ ...prev, [remesero.id]: true }));
    try {
      const summary = await onGetShareSummary(remesero.id);
      if (!summary) {
        if (pendingWindow && !pendingWindow.closed) {
          pendingWindow.close();
        }
        return;
      }

      const inicioType = summary.inicioDebt >= 0 ? "deuda" : "fondo";
      const finalType = summary.finalDebtType === "DEUDA" ? "deuda" : "fondo";

      const tiradoLines =
        summary.groups.length === 0
          ? ["Sin asignaciones desde el ultimo pago"]
          : summary.groups.map((group) => {
              const price = formatPrice(group.priceApplied);
              const amounts = group.amountsUsd
                .map((amount) => formatLocalFlexible(amount))
                .join(", ");
              return `${price} (${amounts}) = ${formatLocalFlexible(group.totalUsd)} USD`;
            });

      const lastPaymentLines =
        summary.hasPaymentCut &&
        summary.lastPaymentAmount !== null &&
        summary.cutAt
          ? [
              `💳 Monto: $ ${formatLocalFlexible(summary.lastPaymentAmount)}`,
              `🕒 Fecha y hora: ${formatDateTime(summary.cutAt)}`,
            ]
          : ["⚠️ Sin pagos registrados"];

      const message = [
        `*👤 GESTOR:* ${summary.remeseroNombre}`,
        "",
        "*🧾 ULTIMO PAGO*",
        ...lastPaymentLines,
        "",
        "*🚩 INICIO*",
        `💰 $ ${formatLocalFlexible(Math.abs(summary.inicioDebt))} ${inicioType}`,
        "",
        "*📤 ZELLE TIRADO*",
        ...tiradoLines,
        `🧮 Total USD: ${formatLocalFlexible(summary.totalTiradoUsd)} USD`,
        "",
        "*📊 TOTAL TIRADO*",
        `💵 $ ${formatLocalFlexible(summary.totalTiradoCup)}`,
        "",
        "*🏁 FINAL*",
        `💸 $ ${formatLocalFlexible(Math.abs(summary.finalDebt))} ${finalType}`,
      ].join("\n");

      const encodedMessage = encodeURIComponent(message);
      const appUrl = `whatsapp://send?text=${encodedMessage}`;
      const webUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
      const isMobile =
        typeof navigator !== "undefined" &&
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const targetUrl = isMobile ? appUrl : webUrl;

      if (pendingWindow && !pendingWindow.closed) {
        pendingWindow.location.href = targetUrl;
        return;
      }

      window.location.assign(targetUrl);
    } finally {
      setSharingById((prev) => ({ ...prev, [remesero.id]: false }));
    }
  };

  const handleRevertPayment = async (remeseroId: string, paymentId: string) => {
    setRevertingPaymentById((prev) => ({ ...prev, [paymentId]: true }));
    try {
      await onRevertPayment(remeseroId, paymentId);
    } finally {
      setRevertingPaymentById((prev) => ({ ...prev, [paymentId]: false }));
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            Remeseros
          </h2>
          <p className="text-sm text-muted-foreground">
            {remeseros.length} remeseros · Deuda total:{" "}
            {formatLocal(totals.deudaTotal)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRefreshRemeseros}
          disabled={loadingRemeseros}
        >
          {loadingRemeseros ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      <div className="grid gap-4">
        {remeseros.map((remesero) => {
          const editing = ensureEditing(remesero);
          const payments = paymentsByRemesero[remesero.id] ?? [];
          const isExpanded = expandedById[remesero.id] === true;
          const paymentsVisible = showPaymentsByRemesero[remesero.id] === true;
          const paymentDraft = paymentDraftById[remesero.id] ?? {
            amountPaid: "",
            note: "",
          };
          const loadingPayments =
            loadingPaymentsByRemesero[remesero.id] === true;

          return (
            <Card
              key={remesero.id}
              className="overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-secondary/20 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <CardHeader className="pb-2 space-y-3">
                {isExpanded && (
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleShareWhatsapp(remesero)}
                      disabled={sharingById[remesero.id] === true}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {sharingById[remesero.id]
                        ? "Compartiendo..."
                        : "Compartir"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => toggleExpanded(remesero.id)}
                    >
                      Contraer <ChevronUp className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
                <div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border bg-background/80 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Nombre
                      </p>
                      <CardTitle className="text-sm md:text-base truncate mt-1">
                        {remesero.nombre}
                      </CardTitle>
                    </div>
                    <div className="rounded-xl border border-border bg-background/80 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Precio
                      </p>
                      <p className="text-sm md:text-base font-semibold text-foreground mt-1">
                        {formatPrice(remesero.precioActual)}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "rounded-xl px-3 py-2",
                        remesero.deudaActual < 0
                          ? "border border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/10"
                          : "border border-primary/20 bg-primary/10",
                      )}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Deuda actual
                      </p>
                      <p
                        className={cn(
                          "text-sm md:text-base font-semibold mt-1",
                          remesero.deudaActual < 0
                            ? "text-[hsl(var(--success))]"
                            : "text-primary",
                        )}
                      >
                        {formatLocal(remesero.deudaActual)}
                      </p>
                    </div>
                  </div>
                </div>
                {!isExpanded && (
                  <div className="flex justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleShareWhatsapp(remesero)}
                      disabled={sharingById[remesero.id] === true}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {sharingById[remesero.id]
                        ? "Compartiendo..."
                        : "Compartir"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => toggleExpanded(remesero.id)}
                    >
                      Expandir <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Deuda actual
                      </p>
                      <p className="text-2xl font-semibold text-foreground">
                        {formatLocal(remesero.deudaActual)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`nombre-${remesero.id}`}>Nombre</Label>
                      <Input
                        id={`nombre-${remesero.id}`}
                        value={editing.nombre}
                        onChange={(event) =>
                          setEditingById((prev) => ({
                            ...prev,
                            [remesero.id]: {
                              ...editing,
                              nombre: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`precio-${remesero.id}`}>
                        Precio actual
                      </Label>
                      <Input
                        id={`precio-${remesero.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={editing.precioActual}
                        onChange={(event) =>
                          setEditingById((prev) => ({
                            ...prev,
                            [remesero.id]: {
                              ...editing,
                              precioActual: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => handleSave(remesero.id)}
                      disabled={savingById[remesero.id] === true}
                    >
                      {savingById[remesero.id]
                        ? "Guardando..."
                        : "Guardar cambios"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDelete(remesero.id)}
                      disabled={deletingById[remesero.id] === true}
                    >
                      {deletingById[remesero.id] ? "Eliminando..." : "Eliminar"}
                    </Button>
                  </div>

                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium">Historial de pagos</h3>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => togglePayments(remesero.id)}
                        disabled={loadingPayments}
                      >
                        {loadingPayments
                          ? "Cargando..."
                          : paymentsVisible
                            ? "Ocultar pagos"
                            : "Ver pagos"}
                      </Button>
                    </div>

                    {paymentsVisible && (
                      <>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor={`payment-amount-${remesero.id}`}>
                              Monto pagado
                            </Label>
                            <Input
                              id={`payment-amount-${remesero.id}`}
                              type="text"
                              inputMode="numeric"
                              value={paymentDraft.amountPaid}
                              onChange={(event) =>
                                setPaymentDraftById((prev) => ({
                                  ...prev,
                                  [remesero.id]: {
                                    ...paymentDraft,
                                    amountPaid: formatThousandsInput(
                                      event.target.value,
                                    ),
                                  },
                                }))
                              }
                              placeholder="1,000"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`payment-note-${remesero.id}`}>
                              Nota (opcional)
                            </Label>
                            <Input
                              id={`payment-note-${remesero.id}`}
                              value={paymentDraft.note}
                              onChange={(event) =>
                                setPaymentDraftById((prev) => ({
                                  ...prev,
                                  [remesero.id]: {
                                    ...paymentDraft,
                                    note: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Transferencia, efectivo, etc"
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={() => handleCreatePayment(remesero.id)}
                          disabled={creatingPaymentById[remesero.id] === true}
                        >
                          {creatingPaymentById[remesero.id]
                            ? "Registrando..."
                            : "Registrar pago"}
                        </Button>

                        <div className="space-y-2">
                          {payments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Sin pagos registrados
                            </p>
                          ) : (
                            payments.map((payment) => (
                              <div
                                key={payment.id}
                                className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm md:flex-row md:items-center md:justify-between"
                              >
                                <div>
                                  <p
                                    className={
                                      payment.revertedAt
                                        ? "font-medium line-through text-muted-foreground"
                                        : "font-medium"
                                    }
                                  >
                                    {formatUsd(payment.amountPaid)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(payment.paidAt).toLocaleString(
                                      "es-DO",
                                    )}
                                  </p>
                                  {payment.revertedAt && (
                                    <p className="text-xs text-destructive mt-1">
                                      Revertido:{" "}
                                      {new Date(
                                        payment.revertedAt,
                                      ).toLocaleString("es-DO")}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-start gap-2 md:items-end">
                                  <p className="text-xs text-muted-foreground">
                                    {payment.note ?? "Sin nota"}
                                  </p>
                                  {!payment.revertedAt && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleRevertPayment(
                                          remesero.id,
                                          payment.id,
                                        )
                                      }
                                      disabled={
                                        revertingPaymentById[payment.id] ===
                                        true
                                      }
                                    >
                                      {revertingPaymentById[payment.id] === true
                                        ? "Revirtiendo..."
                                        : "Revertir"}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {remeseros.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Aun no hay remeseros creados
            </p>
          </div>
        )}
      </div>

      <Button
        type="button"
        className="fixed right-6 bottom-28 md:bottom-8 h-14 w-14 rounded-full p-0 shadow-lg z-40"
        onClick={() => setCreateModalOpen(true)}
        aria-label="Crear remesero"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear remesero</DialogTitle>
            <DialogDescription>
              Ingresa el nombre y precio inicial del remesero.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="nuevo-remesero-nombre">Nombre</Label>
              <Input
                id="nuevo-remesero-nombre"
                value={newNombre}
                onChange={(event) => setNewNombre(event.target.value)}
                placeholder="Ejemplo: Miguel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nuevo-remesero-precio">Precio</Label>
              <Input
                id="nuevo-remesero-precio"
                type="number"
                min="0"
                step="0.01"
                value={newPrecio}
                onChange={(event) => setNewPrecio(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Guardando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
