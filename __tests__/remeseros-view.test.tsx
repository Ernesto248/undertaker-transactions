import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemeserosView } from "@/components/dashboard/remeseros-view";
import type { Remesero } from "@/lib/types";

const remesero: Remesero = {
  id: "r-1",
  nombre: "Miguel",
  precioActual: 510,
  deudaActual: 2500,
  createdAt: "2026-08-05T12:00:00.000Z",
  updatedAt: "2026-08-05T12:00:00.000Z",
};

describe("RemeserosView debt editor", () => {
  it("opens from the card and saves a direct debt adjustment", async () => {
    const onUpdateRemesero = vi.fn().mockResolvedValue(true);

    render(
      <RemeserosView
        remeseros={[remesero]}
        paymentsByRemesero={{}}
        loadingRemeseros={false}
        loadingPaymentsByRemesero={{}}
        onRefreshRemeseros={vi.fn().mockResolvedValue(undefined)}
        onCreateRemesero={vi.fn().mockResolvedValue(undefined)}
        onUpdateRemesero={onUpdateRemesero}
        onDeleteRemesero={vi.fn().mockResolvedValue(undefined)}
        onLoadPayments={vi.fn().mockResolvedValue(undefined)}
        onCreatePayment={vi.fn().mockResolvedValue(undefined)}
        onRevertPayment={vi.fn().mockResolvedValue(undefined)}
        onGetShareSummary={vi.fn().mockResolvedValue(null)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar deuda" }));

    const debtInput = screen.getByLabelText("Deuda actual");
    expect((debtInput as HTMLInputElement).value).toBe("2500");

    fireEvent.change(debtInput, { target: { value: "-750.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar deuda" }));

    await waitFor(() => {
      expect(onUpdateRemesero).toHaveBeenCalledWith("r-1", {
        deudaActual: -750.25,
      });
    });
  });
});
