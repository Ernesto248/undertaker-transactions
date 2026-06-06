# Remesero Card Payment Modal

**Status:** Design approved
**Date:** 2026-06-06

## Purpose

Allow registering payments to a remesero directly from the remesero list view, without having to open the remesero detail page. The new payment form includes a "Dejar en 0" toggle that liquidates the full debt in one click.

## Scope

In scope:
- New "Pagar" button on each remesero card (collapsed view)
- New modal with payment form triggered by that button
- "Dejar en 0" toggle inside the modal
- Refresh the remeseros list after a successful payment

Out of scope:
- Adding "Dejar en 0" to the existing detail page form (decision: only in the new card modal)
- New endpoint or changes to `POST /api/remeseros/[id]/payments` (the existing endpoint supports both regular and "dejar en 0" via `amountPaid = deudaActual`)
- Bulk payments
- Editing or deleting payments
- Date picker for `paidAt` (defaults to "now" via the endpoint)

## Architecture

- **New file:** `components/dashboard/create-remesero-payment-dialog.tsx`
- **Modified file:** `components/dashboard/remeseros-view.tsx`
- **No backend changes**
- **No changes to the detail page or any other route**

The existing `POST /api/remeseros/[id]/payments` endpoint already handles both cases. Sending `amountPaid = remesero.deudaActual` when `deudaActual > 0` results in `deudaActual = 0` after the update.

## Components

### `CreateRemeseroPaymentDialog`

Props:

```ts
{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remesero: Remesero;
  onCreated: () => Promise<void> | void;
}
```

Internal state:
- `amount: string` — controlled input for the payment amount
- `note: string` — controlled input for the optional note
- `zeroOut: boolean` — toggle state
- `submitState: { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string }`

Behavior:
- When `open` transitions to `false`, the form is reset (amount, note, zeroOut, submitState)
- When `zeroOut` is toggled on:
  - `amount` is set to `String(remesero.deudaActual)`
  - The amount input becomes `readOnly`
  - Visual hint: helper text "Liquidar la deuda completa"
- When `zeroOut` is toggled off:
  - `amount` is cleared
  - The amount input becomes editable again
- The "Dejar en 0" toggle is only rendered when `remesero.deudaActual > 0`
- Submit:
  - Validates client-side: amount is a positive number
  - Sends `POST /api/remeseros/[id]/payments` with `{ amountPaid: Number(amount), note?: string }`
  - On 200: calls `onCreated()`, closes the modal
  - On non-200 or network error: shows a localized error message

Form fields:
- Remesero name + current debt (read-only display, color-coded: amber for debt, emerald for fondo)
- Monto a pagar (Input, type number, min 0, step 0.01, required)
- Nota (Input, optional, max 500 chars)
- "Dejar en 0" (Switch or Checkbox, only when deuda > 0)
- Buttons: Cancelar + Registrar pago

### `remeseros-view.tsx` modifications

State additions:
- `paymentDialogOpen: boolean`
- `payingRemesero: Remesero | null`

UI additions:
- New "Pagar" button in the collapsed card action row (next to existing "Compartir" and "Ver detalle" buttons)
- Icon: `DollarSign` from `lucide-react`
- Click handler: set `payingRemesero` to the card's remesero, open the dialog

Render the modal at the end of the component (alongside other future modals).

## Data Flow

1. User clicks "Pagar" on a remesero card in the remeseros list
2. `payingRemesero` is set, modal opens with that remesero's data
3. User enters amount (or toggles "Dejar en 0")
4. User clicks "Registrar pago"
5. POST to `/api/remeseros/[id]/payments` with `{ amountPaid, note? }`
6. On 200: close modal, call `onCreated` (which triggers `refreshRemeseros` to update the list)
7. On error: display error in the modal, keep it open

## Edge Cases

| Case | Behavior |
|---|---|
| `deudaActual <= 0` (fondo) | "Dejar en 0" toggle is not rendered |
| Toggle on then off | `amount` is cleared, input becomes editable |
| `amount > deudaActual` | Allowed (existing endpoint permits it; result: deuda becomes negative, i.e., fondo) |
| `amount <= 0` | Client-side validation blocks submit; if bypassed, server returns 400 and an error is shown |
| 23505 (should not happen for payments) | Mapped to a generic error message |
| Network error | Generic error message, user can retry |
| Remesero deleted/edited while modal is open | The 404/200 from the endpoint is handled, modal allows close |

## Error Handling

Server errors are mapped to localized messages via a `mapErrorToMessage` helper:

- `validation_error` → "Revisa los datos ingresados"
- `invalid_json` → "La peticion enviada no es valida"
- default → "No se pudo registrar el pago"

The function lives in the modal file alongside other client-side error handling.

## Testing

### `__tests__/create-remesero-payment-dialog.test.tsx` (new)

Test cases:
- Renders remesero name and current debt
- "Dejar en 0" toggle is not rendered when `deudaActual <= 0`
- "Dejar en 0" toggle is rendered when `deudaActual > 0`
- Toggling "Dejar en 0" on sets `amount` to `deudaActual` and makes the input readOnly
- Toggling "Dejar en 0" off clears `amount` and makes the input editable
- Submitting with a manual amount sends `{ amountPaid: <number>, note?: <string> }` to the API
- Submitting with "Dejar en 0" on sends `{ amountPaid: deudaActual }` to the API
- On 200 from the API, `onCreated` is called and the modal closes
- On non-200 from the API, an error message is shown
- Form is reset when the modal is closed and reopened

### Existing tests

No changes to existing tests. The endpoint behavior is already covered.

## Verification

- `npx vitest run` → all tests pass (41 existing + new modal tests)
- `pnpm build` → succeeds
- Manual smoke test:
  - Open remeseros tab
  - Click "Pagar" on a remesero with positive debt → modal opens
  - Submit with a manual amount → list refreshes, deuda decreases
  - Reopen, toggle "Dejar en 0" → monto auto-fills, submit → deuda becomes 0
  - Find a remesero with fondo (e.g., "Jose estevez" with deuda -400321), click "Pagar" → modal opens but no "Dejar en 0" toggle

## Files

- **Create:** `components/dashboard/create-remesero-payment-dialog.tsx`
- **Create:** `__tests__/create-remesero-payment-dialog.test.tsx`
- **Modify:** `components/dashboard/remeseros-view.tsx`
- **No other files modified**
