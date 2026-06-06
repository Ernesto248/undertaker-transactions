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
});
