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
  const mod = await import("@/app/api/remeseros/[id]/detail/route");
  return mod.GET;
}

describe("GET /api/remeseros/[id]/detail", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("returns detail with current tramo and grouped summary", async () => {
    const GET = await loadHandler();

    const client: MockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "r-1",
            nombre: "Osmel",
            precioActual: 510,
            deudaActual: 235148,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-04-13T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "p-2",
            remeseroId: "r-1",
            amountPaid: 2100000,
            debtBeforePayment: 585848,
            debtAfterPayment: -1514152,
            note: null,
            paidAt: "2026-04-13T11:40:06.000Z",
            revertedAt: null,
            revertedReason: null,
          },
          {
            id: "p-1",
            remeseroId: "r-1",
            amountPaid: 100000,
            debtBeforePayment: 100000,
            debtAfterPayment: 0,
            note: null,
            paidAt: "2026-04-10T09:00:00.000Z",
            revertedAt: null,
            revertedReason: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            assignmentId: "a-1",
            transactionId: "t-1",
            senderName: "Juan",
            bank: "BOA",
            accountName: "Main",
            confirmationCode: "BOA-1",
            transactionAmount: 100,
            amountUsd: 100,
            priceApplied: 510,
            debtAmount: 51000,
            assignedAt: "2026-04-13T12:00:00.000Z",
            unassignedAt: null,
          },
          {
            assignmentId: "a-2",
            transactionId: "t-2",
            senderName: "Luis",
            bank: "WF",
            accountName: "Main",
            confirmationCode: "WF-2",
            transactionAmount: 50,
            amountUsd: 50,
            priceApplied: 510,
            debtAmount: 25500,
            assignedAt: "2026-04-13T13:00:00.000Z",
            unassignedAt: null,
          },
        ],
      });

    connectMock.mockResolvedValue(client);

    const req = new Request("http://localhost/api/remeseros/r-1/detail");
    const res = await GET(req, { params: Promise.resolve({ id: "r-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.detail.remesero.nombre).toBe("Osmel");
    expect(json.detail.summary.txCount).toBe(2);
    expect(json.detail.summary.totalUsd).toBe(150);
    expect(json.detail.summary.totalCup).toBe(76500);
    expect(json.detail.rangeOptions[0].id).toBe("current");
  });

  it("returns 400 for invalid range", async () => {
    const GET = await loadHandler();

    const req = new Request(
      "http://localhost/api/remeseros/r-1/detail?from=2026-04-13T10:00:00.000Z&to=2026-04-13T10:00:00.000Z",
    );

    const res = await GET(req, { params: Promise.resolve({ id: "r-1" }) });
    expect(res.status).toBe(400);
  });
});
