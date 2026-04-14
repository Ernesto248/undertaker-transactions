"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type {
  RemeseroDetailAssignment,
  RemeseroDetailData,
  RemeseroShareSummary,
} from "@/lib/types";

type RemeseroDetailPageProps = {
  remeseroId: string;
};

function formatLocal(value: number) {
  return new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLocalFlexible(value: number) {
  return new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatThousandsInput(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return "";

  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function buildFilteredSummary(assignments: RemeseroDetailAssignment[]) {
  const totalUsd = assignments.reduce((acc, row) => acc + row.amountUsd, 0);
  const totalCup = assignments.reduce((acc, row) => acc + row.debtAmount, 0);

  const grouped = new Map<
    number,
    {
      txCount: number;
      totalUsd: number;
      totalCup: number;
      amountsUsd: number[];
    }
  >();

  const sorted = [...assignments].sort((a, b) =>
    a.assignedAt.localeCompare(b.assignedAt),
  );

  for (const row of sorted) {
    const current = grouped.get(row.priceApplied) ?? {
      txCount: 0,
      totalUsd: 0,
      totalCup: 0,
      amountsUsd: [],
    };

    current.txCount += 1;
    current.totalUsd += row.amountUsd;
    current.totalCup += row.debtAmount;
    current.amountsUsd.push(row.amountUsd);

    grouped.set(row.priceApplied, current);
  }

  const groups = Array.from(grouped.entries())
    .map(([priceApplied, value]) => ({
      priceApplied,
      txCount: value.txCount,
      totalUsd: value.totalUsd,
      totalCup: value.totalCup,
      amountsUsd: value.amountsUsd,
    }))
    .sort((a, b) => a.priceApplied - b.priceApplied);

  return {
    txCount: assignments.length,
    totalUsd,
    totalCup,
    groups,
  };
}

export function RemeseroDetailPage({ remeseroId }: RemeseroDetailPageProps) {
  const [detail, setDetail] = useState<RemeseroDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRangeId, setSelectedRangeId] = useState("current");
  const [priceFilter, setPriceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [revertingById, setRevertingById] = useState<Record<string, boolean>>(
    {},
  );
  const [sharing, setSharing] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editPrecio, setEditPrecio] = useState("");
  const [savingRemesero, setSavingRemesero] = useState(false);
  const [deletingRemesero, setDeletingRemesero] = useState(false);

  const resolveCurrentRange = useCallback(() => {
    if (!detail)
      return { from: null as string | null, to: null as string | null };

    const option = detail.rangeOptions.find(
      (row) => row.id === selectedRangeId,
    );
    if (option) {
      return { from: option.from, to: option.to };
    }

    return detail.selectedRange;
  }, [detail, selectedRangeId]);

  const loadDetail = useCallback(
    async (
      from?: string | null,
      to?: string | null,
      shouldShowSpinner = true,
    ) => {
      if (shouldShowSpinner) setLoading(true);
      else setReloading(true);

      setError(null);

      try {
        const url = new URL(
          `/api/remeseros/${remeseroId}/detail`,
          window.location.origin,
        );
        if (from) url.searchParams.set("from", from);
        if (to) url.searchParams.set("to", to);

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          setError("No se pudo cargar el detalle del remesero");
          return;
        }

        const data = (await res.json()) as {
          ok?: boolean;
          detail?: RemeseroDetailData;
        };

        if (!data?.ok || !data.detail) {
          setError("No se pudo cargar el detalle del remesero");
          return;
        }

        setDetail(data.detail);

        const matched = data.detail.rangeOptions.find(
          (option) =>
            option.from === data.detail?.selectedRange.from &&
            option.to === data.detail?.selectedRange.to,
        );
        setSelectedRangeId(matched?.id ?? "current");
      } catch {
        setError("No se pudo cargar el detalle del remesero");
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [remeseroId],
  );

  useEffect(() => {
    void loadDetail(undefined, undefined, true);
  }, [loadDetail]);

  useEffect(() => {
    if (!detail) return;
    setEditNombre(detail.remesero.nombre);
    setEditPrecio(String(detail.remesero.precioActual));
  }, [detail]);

  const filteredAssignments = useMemo(() => {
    if (!detail) return [];

    const normalizedSearch = searchQuery.trim().toLowerCase();

    return detail.assignments.filter((row) => {
      const matchesPrice =
        priceFilter === "all" || row.priceApplied === Number(priceFilter);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.senderName.toLowerCase().includes(normalizedSearch) ||
        (row.confirmationCode ?? "").toLowerCase().includes(normalizedSearch);

      return matchesPrice && matchesSearch;
    });
  }, [detail, priceFilter, searchQuery]);

  const filteredSummary = useMemo(
    () => buildFilteredSummary(filteredAssignments),
    [filteredAssignments],
  );

  const priceOptions = useMemo(() => {
    if (!detail) return [] as number[];
    return Array.from(
      new Set(detail.assignments.map((row) => row.priceApplied)),
    ).sort((a, b) => a - b);
  }, [detail]);

  const handleRangeChange = async (rangeId: string) => {
    if (!detail) return;

    const option = detail.rangeOptions.find((row) => row.id === rangeId);
    if (!option) return;

    setSelectedRangeId(rangeId);
    await loadDetail(option.from, option.to, false);
  };

  const handleCreatePayment = async () => {
    const amount = Number(String(paymentAmount).replace(/,/g, "").trim());
    if (!Number.isFinite(amount) || amount <= 0) return;

    setCreatingPayment(true);
    try {
      const res = await fetch(`/api/remeseros/${remeseroId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountPaid: amount,
          note: paymentNote.trim() || undefined,
        }),
      });

      if (!res.ok) return;

      setPaymentAmount("");
      setPaymentNote("");

      const currentRange = resolveCurrentRange();
      await loadDetail(currentRange.from, currentRange.to, false);
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleRevertPayment = async (paymentId: string) => {
    setRevertingById((prev) => ({ ...prev, [paymentId]: true }));

    try {
      const res = await fetch(`/api/remeseros/${remeseroId}/payments`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });

      if (!res.ok) return;

      const currentRange = resolveCurrentRange();
      await loadDetail(currentRange.from, currentRange.to, false);
    } finally {
      setRevertingById((prev) => ({ ...prev, [paymentId]: false }));
    }
  };

  const handleShareWhatsapp = async () => {
    setSharing(true);

    try {
      const res = await fetch(`/api/remeseros/${remeseroId}/share-summary`, {
        cache: "no-store",
      });

      if (!res.ok) return;

      const payload = (await res.json()) as {
        ok?: boolean;
        summary?: RemeseroShareSummary;
      };

      if (!payload?.ok || !payload.summary) return;

      const summary = payload.summary;
      const inicioType = summary.inicioDebt >= 0 ? "deuda" : "fondo";
      const finalType = summary.finalDebtType === "DEUDA" ? "deuda" : "fondo";

      const tiradoLines =
        summary.groups.length === 0
          ? ["Sin asignaciones desde el ultimo pago"]
          : summary.groups.map((group) => {
              const amounts = group.amountsUsd
                .map((amount) => formatLocalFlexible(amount))
                .join(", ");
              return `${formatLocalFlexible(group.priceApplied)} (${amounts}) = ${formatLocalFlexible(group.totalUsd)} USD`;
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
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        window.location.href = appUrl;
        return;
      }

      window.open(webUrl, "_blank", "noopener,noreferrer");
    } finally {
      setSharing(false);
    }
  };

  const handleSaveRemesero = async () => {
    const trimmedName = editNombre.trim();
    const parsedPrice = Number(editPrecio);

    if (!trimmedName) return;
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return;

    setSavingRemesero(true);
    try {
      const res = await fetch(`/api/remeseros/${remeseroId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre: trimmedName,
          precioActual: parsedPrice,
        }),
      });

      if (!res.ok) return;

      const currentRange = resolveCurrentRange();
      await loadDetail(currentRange.from, currentRange.to, false);
    } finally {
      setSavingRemesero(false);
    }
  };

  const handleDeleteRemesero = async () => {
    const confirmed = window.confirm(
      "Seguro que quieres eliminar este remesero? Esta accion no se puede deshacer.",
    );
    if (!confirmed) return;

    setDeletingRemesero(true);
    try {
      const res = await fetch(`/api/remeseros/${remeseroId}`, {
        method: "DELETE",
      });

      if (!res.ok) return;
      window.location.assign("/?tab=remeseros");
    } finally {
      setDeletingRemesero(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full sm:w-48" />
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Skeleton className="h-10 w-full sm:w-32" />
              <Skeleton className="h-10 w-full sm:w-36" />
            </div>
          </div>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-56" />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>

          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  if (!detail || error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 space-y-4">
          <Button asChild variant="outline">
            <Link href="/?tab=remeseros">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver a remeseros
            </Link>
          </Button>
          <p className="text-sm text-destructive">
            {error ?? "No se pudo cargar el detalle"}
          </p>
          <Button
            type="button"
            onClick={() => void loadDetail(undefined, undefined, true)}
          >
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  const balanceType = detail.remesero.deudaActual >= 0 ? "deuda" : "fondo";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline">
            <Link href="/?tab=remeseros">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver a remeseros
            </Link>
          </Button>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void loadDetail(
                  detail.selectedRange.from,
                  detail.selectedRange.to,
                  false,
                )
              }
              disabled={reloading}
              className="w-full sm:w-auto"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              {reloading ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button
              type="button"
              onClick={handleShareWhatsapp}
              disabled={sharing}
              className="w-full sm:w-auto"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {sharing ? "Compartiendo..." : "Compartir"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              Resumen del remesero
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">Nombre</p>
              <p className="text-base font-semibold mt-1 break-words">
                {detail.remesero.nombre}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">
                Precio actual
              </p>
              <p className="text-base font-semibold mt-1">
                {formatLocalFlexible(detail.remesero.precioActual)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">
                Saldo actual
              </p>
              <p className="text-base font-semibold mt-1">
                {formatLocalFlexible(Math.abs(detail.remesero.deudaActual))}{" "}
                {balanceType}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">
                Total USD
              </p>
              <p className="text-base font-semibold mt-1">
                {formatLocalFlexible(filteredSummary.totalUsd)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">
                Total CUP
              </p>
              <p className="text-base font-semibold mt-1">
                {formatLocal(filteredSummary.totalCup)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">
                Asignaciones
              </p>
              <p className="text-base font-semibold mt-1">
                {filteredSummary.txCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Accordion
          type="multiple"
          defaultValue={["payments", "filters", "assignments"]}
          className="space-y-4"
        >
          <AccordionItem value="payments" className="border-none">
            <Card>
              <CardHeader className="pb-2">
                <AccordionTrigger className="py-0 hover:no-underline">
                  <CardTitle className="text-base md:text-lg">
                    Historial de pagos
                  </CardTitle>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="new-payment">Registrar pago</Label>
                      <Input
                        id="new-payment"
                        inputMode="numeric"
                        value={paymentAmount}
                        onChange={(event) =>
                          setPaymentAmount(
                            formatThousandsInput(event.target.value),
                          )
                        }
                        placeholder="1,000"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="new-note">Nota</Label>
                      <Input
                        id="new-note"
                        value={paymentNote}
                        onChange={(event) => setPaymentNote(event.target.value)}
                        placeholder="Transferencia"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleCreatePayment}
                    disabled={creatingPayment}
                    className="w-full sm:w-auto"
                  >
                    {creatingPayment ? "Registrando..." : "Registrar pago"}
                  </Button>

                  <div className="space-y-2">
                    {detail.payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin pagos registrados.
                      </p>
                    ) : (
                      detail.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="rounded-md border border-border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p
                              className={
                                payment.revertedAt
                                  ? "font-medium line-through text-muted-foreground"
                                  : "font-medium"
                              }
                            >
                              $ {formatLocalFlexible(payment.amountPaid)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(payment.paidAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.note ?? "Sin nota"}
                            </p>
                            {payment.revertedAt && (
                              <p className="text-xs text-destructive">
                                Revertido: {formatDateTime(payment.revertedAt)}
                              </p>
                            )}
                          </div>
                          {!payment.revertedAt && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                void handleRevertPayment(payment.id)
                              }
                              disabled={revertingById[payment.id] === true}
                            >
                              {revertingById[payment.id]
                                ? "Revirtiendo..."
                                : "Revertir"}
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="filters" className="border-none">
            <Card>
              <CardHeader className="pb-2">
                <AccordionTrigger className="py-0 hover:no-underline">
                  <CardTitle className="text-base md:text-lg">
                    Tramo y filtros
                  </CardTitle>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="grid gap-3 md:grid-cols-3 pt-0">
                  <div className="space-y-2">
                    <Label htmlFor="range">Tramo entre pagos</Label>
                    <select
                      id="range"
                      title="Tramo entre pagos"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedRangeId}
                      onChange={(event) =>
                        void handleRangeChange(event.target.value)
                      }
                    >
                      {detail.rangeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price-filter">Filtrar por precio</Label>
                    <select
                      id="price-filter"
                      title="Filtrar por precio"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={priceFilter}
                      onChange={(event) => setPriceFilter(event.target.value)}
                    >
                      <option value="all">Todos</option>
                      {priceOptions.map((price) => (
                        <option key={price} value={String(price)}>
                          {formatLocalFlexible(price)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="search">Buscar</Label>
                    <Input
                      id="search"
                      placeholder="Nombre o codigo"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="assignments" className="border-none">
            <Card>
              <CardHeader className="pb-2">
                <AccordionTrigger className="py-0 hover:no-underline">
                  <CardTitle className="text-base md:text-lg">
                    Transacciones asignadas del tramo
                  </CardTitle>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="space-y-2 pt-0">
                  {filteredAssignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay transacciones para este filtro.
                    </p>
                  ) : (
                    filteredAssignments.map((row) => (
                      <div
                        key={row.assignmentId}
                        className="rounded-md border border-border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium break-words">
                            {row.senderName}
                          </p>
                          <p className="text-xs text-muted-foreground break-words">
                            {row.confirmationCode ?? "Sin codigo"} ·{" "}
                            {row.bank ?? "Sin banco"} ·{" "}
                            {row.accountName ?? "Sin cuenta"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Asignada: {formatDateTime(row.assignedAt)}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-semibold">
                            USD {formatLocalFlexible(row.amountUsd)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatLocalFlexible(row.priceApplied)} x{" "}
                            {formatLocalFlexible(row.amountUsd)} ={" "}
                            {formatLocal(row.debtAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.isActive ? "Activa" : "Desasignada"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="price-summary" className="border-none">
            <Card>
              <CardHeader className="pb-2">
                <AccordionTrigger className="py-0 hover:no-underline">
                  <CardTitle className="text-base md:text-lg">
                    Resumen por precio
                  </CardTitle>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="space-y-2 pt-0">
                  {filteredSummary.groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin asignaciones en este tramo.
                    </p>
                  ) : (
                    filteredSummary.groups.map((group) => (
                      <div
                        key={group.priceApplied}
                        className="rounded-md border border-border p-3 text-sm"
                      >
                        <p className="font-medium">
                          {formatLocalFlexible(group.priceApplied)} (
                          {group.amountsUsd
                            .map((amount) => formatLocalFlexible(amount))
                            .join(", ")}
                          )
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {group.txCount} transacciones ·{" "}
                          {formatLocalFlexible(group.totalUsd)} USD ·{" "}
                          {formatLocal(group.totalCup)} CUP
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="settings" className="border-none">
            <Card>
              <CardHeader className="pb-2">
                <AccordionTrigger className="py-0 hover:no-underline">
                  <CardTitle className="text-base md:text-lg">
                    Configuracion del remesero
                  </CardTitle>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="grid gap-3 md:grid-cols-3 pt-0">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Nombre</Label>
                    <Input
                      id="edit-name"
                      value={editNombre}
                      onChange={(event) => setEditNombre(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">Precio actual</Label>
                    <Input
                      id="edit-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPrecio}
                      onChange={(event) => setEditPrecio(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch md:items-end gap-2">
                    <Button
                      type="button"
                      onClick={handleSaveRemesero}
                      disabled={savingRemesero}
                      className="w-full sm:w-auto"
                    >
                      {savingRemesero ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteRemesero}
                      disabled={deletingRemesero}
                      className="w-full sm:w-auto"
                    >
                      {deletingRemesero ? "Eliminando..." : "Eliminar"}
                    </Button>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>
    </main>
  );
}
