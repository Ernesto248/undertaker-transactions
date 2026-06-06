# Remesero Card Payment Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Pagar" button on each remesero card that opens a modal with a payment form, including a "Dejar en 0" toggle that liquidates the full debt.

**Architecture:** A new `CreateRemeseroPaymentDialog` modal component is triggered by a "Pagar" button added to each remesero card. The modal calls the existing `POST /api/remeseros/[id]/payments` endpoint. The "Dejar en 0" toggle is implemented client-side by auto-filling the amount with `remesero.deudaActual` and making the input readOnly.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui (Dialog, Input, Label, Button, Switch, Checkbox), Vitest, @testing-library/react, Zod (server-side only).

---

## File Structure

- **Create:** `components/dashboard/create-remesero-payment-dialog.tsx`
  - New modal component with payment form and "Dejar en 0" toggle
- **Create:** `__tests__/create-remesero-payment-dialog.test.tsx`
  - Component tests using @testing-library/react
- **Modify:** `components/dashboard/remeseros-view.tsx`
  - Add `paymentDialogOpen` and `payingRemesero` state
  - Add "Pagar" button in the collapsed card action row
  - Render the new modal at the end of the component

No backend changes. No changes to the detail page or any other route.

---

## Reference: Existing patterns to follow

- The new transaction modal at `components/dashboard/create-transaction-dialog.tsx` is the closest reference for structure, imports, and form state patterns
- The existing remesero payment endpoint at `app/api/remeseros/[id]/payments/route.ts` accepts `{ amountPaid, note?, paidAt? }` and returns `{ ok: true, payment }` on 201
- The remeseros view at `components/dashboard/remeseros-view.tsx` already imports `DollarSign` is not yet imported, and uses shadcn `Button`, `Dialog`, `Input`, `Label`
- The `Switch` component from `@/components/ui/switch` is used in `components/dashboard/settings-view.tsx`
- The remesero type is `Remesero` from `@/lib/types`: `{ id, nombre, precioActual, deudaActual, createdAt, updatedAt }`

---

## Task 1: Modal scaffold + display test

**Files:**
- Create: `__tests__/create-remesero-payment-dialog.test.tsx`
- Create: `components/dashboard/create-remesero-payment-dialog.tsx`

- [ ] **Step 1: Write the failing test for basic render**

```tsx
// __tests__/create-remesero-payment-dialog.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateRemeseroPaymentDialog } from "@/components/dashboard/create-remesero-payment-dialog";
import type { Remesero } from "@/lib/types";

const baseRemesero: Remesero = {
  id: "r-1",
  nombre: "Osmel",
  precioActual: 615,
  deudaActual: 1360422,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-04-13T00:00:00.000Z",
};

describe("CreateRemeseroPaymentDialog", () => {
  beforeEach(() => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, payment: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the remesero name and current debt in the header", () => {
    render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={() => {}}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );
    expect(screen.getByText("Osmel")).toBeDefined();
    expect(screen.getByText(/1,360,422/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: FAIL with "Cannot find module '@/components/dashboard/create-remesero-payment-dialog'"

- [ ] **Step 3: Create the modal scaffold**

```tsx
// components/dashboard/create-remesero-payment-dialog.tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add __tests__/create-remesero-payment-dialog.test.tsx components/dashboard/create-remesero-payment-dialog.tsx
git -c user.email=dev@local -c user.name=dev commit -m "feat(remeseros): scaffold payment dialog with header"
```

---

## Task 2: Amount and note input fields

**Files:**
- Modify: `__tests__/create-remesero-payment-dialog.test.tsx`
- Modify: `components/dashboard/create-remesero-payment-dialog.tsx`

- [ ] **Step 1: Add the failing test for amount and note inputs**

Append to the `describe` block in `__tests__/create-remesero-payment-dialog.test.tsx`:

```tsx
  it("renders the amount and note inputs", () => {
    render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={() => {}}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );
    expect(screen.getByLabelText(/monto a pagar/i)).toBeDefined();
    expect(screen.getByLabelText(/nota/i)).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: FAIL — no inputs found

- [ ] **Step 3: Add the amount and note fields**

Replace the contents of the `<DialogContent>` in `components/dashboard/create-remesero-payment-dialog.tsx` (keeping the existing header):

```tsx
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
```

And add the state declarations at the top of the component body:

```tsx
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
```

And the import at the top:

```tsx
import { useState } from "react";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add __tests__/create-remesero-payment-dialog.test.tsx components/dashboard/create-remesero-payment-dialog.tsx
git -c user.email=dev@local -c user.name=dev commit -m "feat(remeseros): add amount and note fields to payment dialog"
```

---

## Task 3: "Dejar en 0" toggle (visible only when deuda > 0)

**Files:**
- Modify: `__tests__/create-remesero-payment-dialog.test.tsx`
- Modify: `components/dashboard/create-remesero-payment-dialog.tsx`

- [ ] **Step 1: Add failing tests for toggle visibility**

Append to the `describe` block in `__tests__/create-remesero-payment-dialog.test.tsx`:

```tsx
  it("shows the 'Dejar en 0' toggle when deudaActual > 0", () => {
    render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={() => {}}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );
    expect(screen.getByRole("switch", { name: /dejar en 0/i })).toBeDefined();
  });

  it("hides the 'Dejar en 0' toggle when deudaActual <= 0", () => {
    const remeseroFondo: Remesero = { ...baseRemesero, deudaActual: -100 };
    render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={() => {}}
        remesero={remeseroFondo}
        onCreated={() => {}}
      />,
    );
    expect(screen.queryByRole("switch", { name: /dejar en 0/i })).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: 2 FAILs — no switch found

- [ ] **Step 3: Add the toggle (and its state)**

Add a new state at the top of the component body:

```tsx
  const [zeroOut, setZeroOut] = useState(false);
```

Add the import at the top of the file:

```tsx
import { Switch } from "@/components/ui/switch";
```

Add the toggle UI between the note input and the action buttons (inside the `<div className="space-y-4">` block):

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add __tests__/create-remesero-payment-dialog.test.tsx components/dashboard/create-remesero-payment-dialog.tsx
git -c user.email=dev@local -c user.name=dev commit -m "feat(remeseros): add Dejar en 0 toggle to payment dialog"
```

---

## Task 4: Toggle on/off wires amount

**Files:**
- Modify: `__tests__/create-remesero-payment-dialog.test.tsx`
- Modify: `components/dashboard/create-remesero-payment-dialog.tsx`

- [ ] **Step 1: Add failing tests for toggle on/off wiring**

Append to the `describe` block in `__tests__/create-remesero-payment-dialog.test.tsx`:

```tsx
  it("fills amount and locks the input when 'Dejar en 0' is toggled on", () => {
    render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={() => {}}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );
    const toggle = screen.getByRole("switch", { name: /dejar en 0/i });
    toggle.click();
    const amountInput = screen.getByLabelText(/monto a pagar/i) as HTMLInputElement;
    expect(amountInput.value).toBe("1360422");
    expect(amountInput.readOnly).toBe(true);
  });

  it("clears amount and unlocks the input when 'Dejar en 0' is toggled off", () => {
    render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={() => {}}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );
    const toggle = screen.getByRole("switch", { name: /dejar en 0/i });
    toggle.click();
    toggle.click();
    const amountInput = screen.getByLabelText(/monto a pagar/i) as HTMLInputElement;
    expect(amountInput.value).toBe("");
    expect(amountInput.readOnly).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: 2 FAILs — value and readOnly unchanged

- [ ] **Step 3: Wire the toggle to amount state**

Replace the `<Input id="payment-amount" ... />` element in the dialog with:

```tsx
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
```

Add an effect right after the state declarations to sync amount when `zeroOut` changes:

```tsx
  useEffect(() => {
    if (zeroOut && remesero.deudaActual > 0) {
      setAmount(String(remesero.deudaActual));
    } else {
      setAmount("");
    }
  }, [zeroOut, remesero.deudaActual]);
```

Add the `useEffect` import:

```tsx
import { useEffect, useState } from "react";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add __tests__/create-remesero-payment-dialog.test.tsx components/dashboard/create-remesero-payment-dialog.tsx
git -c user.email=dev@local -c user.name=dev commit -m "feat(remeseros): wire Dejar en 0 toggle to amount input"
```

---

## Task 5: Submit handler with API call

**Files:**
- Modify: `__tests__/create-remesero-payment-dialog.test.tsx`
- Modify: `components/dashboard/create-remesero-payment-dialog.tsx`

- [ ] **Step 1: Add failing test for submit with manual amount**

Append to the `describe` block in `__tests__/create-remesero-payment-dialog.test.tsx`:

```tsx
  it("submits the payment with the entered amount and calls onCreated on success", async () => {
    const onCreated = vi.fn();
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, payment: { id: "p-1" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const onOpenChange = vi.fn();
    render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        remesero={baseRemesero}
        onCreated={onCreated}
      />,
    );

    const amountInput = screen.getByLabelText(/monto a pagar/i);
    const noteInput = screen.getByLabelText(/nota/i);
    amountInput.focus();
    // Simulate a controlled input change
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      amountInput,
      "500",
    );
    amountInput.dispatchEvent(new Event("input", { bubbles: true }));
    noteInput.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      noteInput,
      "transfer",
    );
    noteInput.dispatchEvent(new Event("input", { bubbles: true }));

    const submitButton = screen.getByRole("button", { name: /registrar pago/i });
    submitButton.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/remeseros/r-1/payments",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountPaid: 500, note: "transfer" }),
      }),
    );
    expect(onCreated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: FAIL — submit does nothing

- [ ] **Step 3: Wrap form, add submit handler, and submit state**

Add the imports at the top of the file:

```tsx
import { useEffect, useState } from "react";
```

(already imported from Task 4, so this is a no-op if already there)

Add submit state next to the other state hooks at the top of the component body:

```tsx
  const [submitState, setSubmitState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
```

Add the submit handler in the component body (between state and JSX):

```tsx
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
```

Wrap the existing `<div className="space-y-4">` and its contents in a `<form onSubmit={handleSubmit}>`, and replace the "Registrar pago" button with a submit button that is disabled while submitting. Replace the existing buttons block with:

```tsx
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
```

Also add an error message display above the buttons (inside the form, before the action buttons):

```tsx
          {submitState.kind === "error" ? (
            <p className="text-sm text-destructive">{submitState.message}</p>
          ) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add __tests__/create-remesero-payment-dialog.test.tsx components/dashboard/create-remesero-payment-dialog.tsx
git -c user.email=dev@local -c user.name=dev commit -m "feat(remeseros): submit handler for payment dialog"
```

---

## Task 6: Submit with "Dejar en 0" sends deudaActual

**Files:**
- Modify: `__tests__/create-remesero-payment-dialog.test.tsx`

- [ ] **Step 1: Add the failing test for submit with toggle on**

Append to the `describe` block in `__tests__/create-remesero-payment-dialog.test.tsx`:

```tsx
  it("submits with deudaActual when 'Dejar en 0' is on", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, payment: { id: "p-1" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={() => {}}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );

    const toggle = screen.getByRole("switch", { name: /dejar en 0/i });
    toggle.click();

    const submitButton = screen.getByRole("button", { name: /registrar pago/i });
    submitButton.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/remeseros/r-1/payments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amountPaid: 1360422 }),
      }),
    );
  });
```

- [ ] **Step 2: Run test to verify it passes immediately**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: PASS (the implementation from Task 5 already wires amount to the deudaActual value when zeroOut is on)

If it does not pass, debug: verify that the `useEffect` from Task 4 sets `amount` synchronously enough for the submit handler to read it. The test's `await new Promise((resolve) => setTimeout(resolve, 0))` should be sufficient; if it isn't, increase the timeout to a few milliseconds.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add __tests__/create-remesero-payment-dialog.test.tsx
git -c user.email=dev@local -c user.name=dev commit -m "test(remeseros): submit with Dejar en 0 sends deudaActual"
```

---

## Task 7: Form reset on close

**Files:**
- Modify: `__tests__/create-remesero-payment-dialog.test.tsx`
- Modify: `components/dashboard/create-remesero-payment-dialog.tsx`

- [ ] **Step 1: Add the failing test for reset on close**

Append to the `describe` block in `__tests__/create-remesero-payment-dialog.test.tsx`:

```tsx
  it("resets the form when the modal is closed", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );

    const amountInput = screen.getByLabelText(/monto a pagar/i) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      amountInput,
      "999",
    );
    amountInput.dispatchEvent(new Event("input", { bubbles: true }));
    const toggle = screen.getByRole("switch", { name: /dejar en 0/i });
    toggle.click();

    rerender(
      <CreateRemeseroPaymentDialog
        open={false}
        onOpenChange={onOpenChange}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );
    rerender(
      <CreateRemeseroPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        remesero={baseRemesero}
        onCreated={() => {}}
      />,
    );

    const amountAfter = screen.getByLabelText(/monto a pagar/i) as HTMLInputElement;
    const toggleAfter = screen.getByRole("switch", { name: /dejar en 0/i }) as HTMLInputElement;
    expect(amountAfter.value).toBe("");
    expect(toggleAfter.getAttribute("data-state")).toBe("unchecked");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: FAIL — amount and toggle state persist

- [ ] **Step 3: Add the reset effect**

Add the effect right after the state declarations:

```tsx
  useEffect(() => {
    if (!open) {
      setAmount("");
      setNote("");
      setZeroOut(false);
      setSubmitState({ kind: "idle" });
    }
  }, [open]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/create-remesero-payment-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add __tests__/create-remesero-payment-dialog.test.tsx components/dashboard/create-remesero-payment-dialog.tsx
git -c user.email=dev@local -c user.name=dev commit -m "feat(remeseros): reset payment form when modal closes"
```

---

## Task 8: Add "Pagar" button to remeseros-view cards

**Files:**
- Modify: `components/dashboard/remeseros-view.tsx`

- [ ] **Step 1: Add the imports and state**

Add the new imports at the top of `components/dashboard/remeseros-view.tsx`:

```tsx
import { CreateRemeseroPaymentDialog } from "./create-remesero-payment-dialog";
```

Add to the lucide-react import (find the existing import line and add `DollarSign`):

```tsx
import { ChevronDown, ChevronUp, DollarSign, MessageCircle, Plus } from "lucide-react";
```

Add two new state hooks alongside the other `useState` calls in the component body:

```tsx
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payingRemesero, setPayingRemesero] = useState<Remesero | null>(null);
```

- [ ] **Step 2: Add the "Pagar" button in the collapsed card action row**

Find the existing collapsed-view action row in the `map((remesero) => ...)` callback — it currently has "Compartir" and "Ver detalle" buttons. Replace the entire `<div className="flex justify-center gap-2">` block (the one shown when `!isExpanded`) with:

```tsx
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
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleOpenPayment(remesero)}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Pagar
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                    >
                      <Link href={`/remeseros/${remesero.id}`}>
                        Ver detalle <ChevronDown className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                )}
```

- [ ] **Step 3: Add the handler alongside the other handlers**

Add a new callback near the other handler functions (e.g., right after `handleRevertPayment`):

```tsx
  const handleOpenPayment = (remesero: Remesero) => {
    setPayingRemesero(remesero);
    setPaymentDialogOpen(true);
  };
```

- [ ] **Step 4: Render the modal at the end of the component**

Add this JSX at the end of the `RemeserosView` component, after the existing create-remesero `<Dialog>` (search for `</Dialog>` followed by the component's closing `)`):

```tsx
      <CreateRemeseroPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) setPayingRemesero(null);
        }}
        remesero={
          payingRemesero ?? {
            id: "",
            nombre: "",
            precioActual: 0,
            deudaActual: 0,
            createdAt: "",
            updatedAt: "",
          }
        }
        onCreated={() => {
          void refreshRemeseros();
        }}
      />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors. (Pre-existing errors in `dashboard.tsx`, `dashboard.test.tsx`, and `filter-bar.tsx` are unrelated and may remain; they were documented in earlier context gathering.)

- [ ] **Step 6: Commit**

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add components/dashboard/remeseros-view.tsx
git -c user.email=dev@local -c user.name=dev commit -m "feat(remeseros): add Pagar button to remesero cards"
```

---

## Task 9: Final verification

**Files:** none modified

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (existing 41 + new modal tests)

- [ ] **Step 2: Run the build**

Run: `pnpm build`
Expected: "Compiled successfully" and all routes including `/api/remeseros` family registered

- [ ] **Step 3: Manual smoke test**

1. Start the dev server: `pnpm dev`
2. Open the dashboard, navigate to the "Remeseros" tab
3. Find a remesero with positive deuda (e.g., "Osmel" with deuda 1,360,422). Click "Pagar" — the modal opens, header shows the name and current debt
4. Enter an amount manually, click "Registrar pago" — the modal closes, the list refreshes, the deuda decreases by the amount entered
5. Click "Pagar" again, toggle "Dejar en 0" — the amount auto-fills with the new deuda, the input is readOnly. Click "Registrar pago" — the modal closes, the deuda becomes 0
6. Find a remesero with negative deuda (e.g., "Jose estevez" with deuda -400,321). Click "Pagar" — the modal opens but the "Dejar en 0" toggle is not rendered
7. Kill the dev server when done

- [ ] **Step 4: Commit (if any fixups were needed)**

If the smoke test surfaced any issues, fix them, then:

```bash
cd C:\Users\mleon\code\zelle-handler\dashboard-transaction
git add -A
git -c user.email=dev@local -c user.name=dev commit -m "fix(remeseros): smoke test fixups"
```

If no fixups were needed, skip this step.

---

## Self-Review Notes

- **Spec coverage:** every section in `docs/superpowers/specs/2026-06-06-remesero-card-payment-design.md` maps to one or more tasks:
  - New modal → Task 1
  - Form fields → Task 2
  - Toggle visibility rule → Task 3
  - Toggle on/off wiring → Task 4
  - Submit logic → Task 5
  - Submit with toggle on → Task 6
  - Reset on close → Task 7
  - Card integration → Task 8
  - Verification → Task 9

- **Placeholder scan:** no TBD, TODO, or "implement later" patterns. Every step has the actual code.

- **Type consistency:** `Remesero` type used throughout matches the import from `@/lib/types`. Method names (`onCreated`, `onOpenChange`, `setPayingRemesero`, `handleOpenPayment`) are used consistently across tasks.
