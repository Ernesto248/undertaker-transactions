import { beforeEach, describe, expect, it, vi } from "vitest";

type MockClient = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

const connectMock = vi.fn();

vi.mock("@/lib/db", () => {
  return {
    getPool: () => ({
      connect: connectMock,
    }),
  };
});

async function loadHandler() {
  const mod = await import("@/app/api/remeseros/[id]/share-summary/route");
  return mod.GET;
}

describe("GET /api/remeseros/[id]/share-summary", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("returns summary using debt-after-payment as inicio", async () => {
    const GET = await loadHandler();

    const client: MockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    client.query
      .mockResolvedValueOnce({
        rows: [{ id: "r-1", nombre: "Osmel", deudaActual: 203000 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "p-1",
            amountPaid: 50000,
            debtAfterPayment: 50000,
            paidAt: "2026-04-13T10:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            priceApplied: 510,
            amountsUsd: [100, 200],
            txCount: 2,
            totalUsd: 300,
            totalCup: 153000,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    connectMock.mockResolvedValue(client);

    const req = new Request("http://localhost/api/remeseros/r-1/share-summary");
    const res = await GET(req, { params: Promise.resolve({ id: "r-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.summary.inicioDebt).toBe(50000);
    expect(json.summary.totalTiradoCup).toBe(153000);
    expect(json.summary.finalDebt).toBe(203000);
    expect(json.summary.groups[0].priceApplied).toBe(510);
    expect(json.summary.groups[0].amountsUsd).toEqual([100, 200]);
    expect(json.summary.removedGroups).toEqual([]);
  });

  it("starts from zero when there is no payment", async () => {
    const GET = await loadHandler();

    const client: MockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    client.query
      .mockResolvedValueOnce({
        rows: [{ id: "r-2", nombre: "Luisi vecino", deudaActual: 51000 }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            priceApplied: 510,
            amountsUsd: [100],
            txCount: 1,
            totalUsd: 100,
            totalCup: 51000,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    connectMock.mockResolvedValue(client);

    const req = new Request("http://localhost/api/remeseros/r-2/share-summary");
    const res = await GET(req, { params: Promise.resolve({ id: "r-2" }) });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.summary.hasPaymentCut).toBe(false);
    expect(json.summary.inicioDebt).toBe(0);
    expect(json.summary.finalDebt).toBe(51000);
    expect(json.summary.removedGroups).toEqual([]);
  });

  it("subtracts unassigned transactions from totals after payment cutoff", async () => {
    const GET = await loadHandler();

    const client: MockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    client.query
      .mockResolvedValueOnce({
        rows: [{ id: "r-3", nombre: "Jesus", deudaActual: 152000 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "p-3",
            amountPaid: 50000,
            debtAfterPayment: 50000,
            paidAt: "2026-05-10T10:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            priceApplied: 510,
            amountsUsd: [100, 100, 100],
            txCount: 3,
            totalUsd: 300,
            totalCup: 153000,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            priceApplied: 510,
            amountsUsd: [100],
            txCount: 1,
            totalUsd: 100,
            totalCup: 51000,
          },
        ],
      });

    connectMock.mockResolvedValue(client);

    const req = new Request(
      "http://localhost/api/remeseros/r-3/share-summary",
    );
    const res = await GET(req, { params: Promise.resolve({ id: "r-3" }) });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.summary.inicioDebt).toBe(50000);
    expect(json.summary.totalTiradoUsd).toBe(200);
    expect(json.summary.totalTiradoCup).toBe(102000);
    expect(json.summary.finalDebt).toBe(152000);
    expect(json.summary.finalDebtType).toBe("DEUDA");
    expect(json.summary.groups).toHaveLength(1);
    expect(json.summary.groups[0].totalCup).toBe(153000);
    expect(json.summary.removedGroups).toHaveLength(1);
    expect(json.summary.removedGroups[0].totalCup).toBe(51000);
  });
});
