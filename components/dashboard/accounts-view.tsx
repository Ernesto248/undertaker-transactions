"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  AccountBalance,
  AccountMovement,
  AccountMovementType,
} from "@/lib/types";

type AccountsViewProps = {
  accounts: AccountBalance[];
  movementsByAccount: Record<string, AccountMovement[]>;
  loadingAccounts: boolean;
  loadingMovementsByAccount: Record<string, boolean>;
  onRefreshAccounts: () => Promise<void>;
  onLoadMovements: (accountId: string) => Promise<void>;
  onCreateMovement: (
    accountId: string,
    input: { movementType: AccountMovementType; amount: number; note?: string },
  ) => Promise<void>;
  onRevertMovement: (
    accountId: string,
    movementId: string,
    reason?: string,
  ) => Promise<void>;
};

export function AccountsView({
  accounts,
  movementsByAccount,
  loadingAccounts,
  loadingMovementsByAccount,
  onRefreshAccounts,
  onLoadMovements,
  onCreateMovement,
  onRevertMovement,
}: AccountsViewProps) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [loadingByAccount, setLoadingByAccount] = useState<
    Record<string, boolean>
  >({});
  const [revertingByMovement, setRevertingByMovement] = useState<
    Record<string, boolean>
  >({});
  const [draftByAccount, setDraftByAccount] = useState<
    Record<
      string,
      { movementType: AccountMovementType; amount: string; note: string }
    >
  >({});

  const totals = useMemo(() => {
    const totalBalance = accounts.reduce(
      (sum, account) => sum + account.balance,
      0,
    );
    const totalIncoming = accounts.reduce(
      (sum, account) => sum + account.incomingTotal,
      0,
    );
    const totalOutgoing = accounts.reduce(
      (sum, account) => sum + account.outgoingTotal,
      0,
    );
    return { totalBalance, totalIncoming, totalOutgoing };
  }, [accounts]);

  const formatLocal = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("es-DO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const getDraft = (accountId: string) => {
    return (
      draftByAccount[accountId] ?? {
        movementType: "wire",
        amount: "",
        note: "",
      }
    );
  };

  const toggleExpanded = async (accountId: string) => {
    const next = !(expandedById[accountId] === true);
    setExpandedById((prev) => ({ ...prev, [accountId]: next }));

    if (next) {
      await onLoadMovements(accountId);
    }
  };

  const handleCreateMovement = async (accountId: string) => {
    const draft = getDraft(accountId);
    const amount = Number(draft.amount);

    if (!Number.isFinite(amount) || amount <= 0) return;

    setLoadingByAccount((prev) => ({ ...prev, [accountId]: true }));

    try {
      await onCreateMovement(accountId, {
        movementType: draft.movementType,
        amount,
        note: draft.note.trim() || undefined,
      });
      setDraftByAccount((prev) => ({
        ...prev,
        [accountId]: {
          movementType: "wire",
          amount: "",
          note: "",
        },
      }));
    } finally {
      setLoadingByAccount((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const handleRevertMovement = async (
    accountId: string,
    movementId: string,
  ) => {
    setRevertingByMovement((prev) => ({ ...prev, [movementId]: true }));
    try {
      await onRevertMovement(accountId, movementId);
    } finally {
      setRevertingByMovement((prev) => ({ ...prev, [movementId]: false }));
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            Cuentas
          </h2>
          <p className="text-sm text-muted-foreground">
            {accounts.length} cuentas · Saldo total:{" "}
            {formatLocal(totals.totalBalance)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRefreshAccounts}
          disabled={loadingAccounts}
        >
          {loadingAccounts ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="min-w-0 overflow-hidden border-border/70 bg-card/60">
          <CardHeader className="px-2 pb-1 pt-3 sm:px-6 sm:pb-2 sm:pt-6">
            <CardTitle className="truncate text-[11px] text-muted-foreground sm:text-sm">
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 px-2 pb-3 sm:px-6 sm:pb-6">
            <p
              className="truncate text-[clamp(0.75rem,3.6vw,1.25rem)] font-semibold tabular-nums leading-tight text-foreground"
              title={formatLocal(totals.totalBalance)}
            >
              {formatLocal(totals.totalBalance)}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden border-border/70 bg-card/60">
          <CardHeader className="px-2 pb-1 pt-3 sm:px-6 sm:pb-2 sm:pt-6">
            <CardTitle className="truncate text-[11px] text-muted-foreground sm:text-sm">
              Entradas
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 px-2 pb-3 sm:px-6 sm:pb-6">
            <p
              className="truncate text-[clamp(0.75rem,3.6vw,1.25rem)] font-semibold tabular-nums leading-tight text-foreground"
              title={formatLocal(totals.totalIncoming)}
            >
              {formatLocal(totals.totalIncoming)}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden border-border/70 bg-card/60">
          <CardHeader className="px-2 pb-1 pt-3 sm:px-6 sm:pb-2 sm:pt-6">
            <CardTitle className="truncate text-[11px] text-muted-foreground sm:text-sm">
              Salidas
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 px-2 pb-3 sm:px-6 sm:pb-6">
            <p
              className="truncate text-[clamp(0.75rem,3.6vw,1.25rem)] font-semibold tabular-nums leading-tight text-foreground"
              title={formatLocal(totals.totalOutgoing)}
            >
              {formatLocal(totals.totalOutgoing)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {accounts.map((account) => {
          const isExpanded = expandedById[account.id] === true;
          const draft = getDraft(account.id);
          const movements = movementsByAccount[account.id] ?? [];
          const loadingMovements =
            loadingMovementsByAccount[account.id] === true;

          return (
            <Card
              key={account.id}
              className="overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-secondary/20 shadow-sm"
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base md:text-lg">
                      {account.accountName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {account.transactionCount} transferencias · Ultima
                      entrada: {formatDate(account.lastTransactionAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(account.id)}
                  >
                    {isExpanded ? "Contraer" : "Expandir"}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 ml-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Saldo actual
                    </p>
                    <p className="text-sm font-semibold text-primary mt-1">
                      {formatLocal(account.balance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Entradas
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {formatLocal(account.incomingTotal)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Salidas
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {formatLocal(account.outgoingTotal)}
                    </p>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4 pt-0">
                  <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      Registrar salida
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Tipo
                        </Label>
                        <Select
                          value={draft.movementType}
                          onValueChange={(value) =>
                            setDraftByAccount((prev) => ({
                              ...prev,
                              [account.id]: {
                                ...draft,
                                movementType: value as AccountMovementType,
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="wire">WIRE</SelectItem>
                            <SelectItem value="expense">GASTO</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Monto
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={draft.amount}
                          onChange={(event) =>
                            setDraftByAccount((prev) => ({
                              ...prev,
                              [account.id]: {
                                ...draft,
                                amount: event.target.value,
                              },
                            }))
                          }
                          placeholder="0"
                          className="bg-secondary border-border"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs text-muted-foreground">
                          Nota (opcional)
                        </Label>
                        <Input
                          value={draft.note}
                          onChange={(event) =>
                            setDraftByAccount((prev) => ({
                              ...prev,
                              [account.id]: {
                                ...draft,
                                note: event.target.value,
                              },
                            }))
                          }
                          placeholder="Referencia"
                          className="bg-secondary border-border"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleCreateMovement(account.id)}
                      disabled={loadingByAccount[account.id] === true}
                    >
                      {loadingByAccount[account.id] === true
                        ? "Guardando..."
                        : "Registrar"}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        Historial
                      </p>
                      {loadingMovements && (
                        <p className="text-xs text-muted-foreground">
                          Cargando...
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      {movements.map((movement) => (
                        <div
                          key={movement.id}
                          className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                {movement.movementType}
                              </span>
                              <span className="text-sm font-semibold text-foreground">
                                -{formatLocal(movement.amount)}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(movement.createdAt)}
                            </span>
                          </div>

                          {movement.note && (
                            <p className="text-xs text-muted-foreground">
                              {movement.note}
                            </p>
                          )}

                          {movement.revertedAt ? (
                            <p className="text-xs text-amber-500">
                              Revertido {formatDate(movement.revertedAt)}
                            </p>
                          ) : (
                            <div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleRevertMovement(account.id, movement.id)
                                }
                                disabled={
                                  revertingByMovement[movement.id] === true
                                }
                              >
                                {revertingByMovement[movement.id] === true
                                  ? "Revirtiendo..."
                                  : "Revertir"}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}

                      {movements.length === 0 && !loadingMovements && (
                        <p className="text-sm text-muted-foreground">
                          Esta cuenta no tiene movimientos manuales.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {accounts.length === 0 && (
          <Card className="border-border/70 bg-card/60">
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">
                No hay cuentas disponibles.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
