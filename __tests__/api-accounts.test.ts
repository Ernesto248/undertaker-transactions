import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({ connect: connectMock }),
}));

async function loadPostHandler() {
  const mod = await import("@/app/api/accounts/route");
  return mod.POST;
}

function createClient(rowsByCall: unknown[][]) {
  const query = vi.fn();
  for (const rows of rowsByCall) query.mockResolvedValueOnce({ rows });
  const release = vi.fn();
  connectMock.mockResolvedValue({ query, release });
  return { query, release };
}

describe("POST /api/accounts", () => {
  beforeEach(() => connectMock.mockReset());

  it("preserves decimal expense amounts", async () => {
    const { query, release } = createClient([[], [], []]);
    const POST = await loadPostHandler();
    const response = await POST(new Request("http://localhost/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: "2cfc4038-0f11-4f22-a7dd-cd7ec1597120",
        movementType: "expense",
        amount: 125.75,
      }),
    }));

    expect(response.status).toBe(201);
    const insertCall = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO account_outflow_movements"));
    expect(insertCall?.[1]).toEqual(expect.arrayContaining([
      "2cfc4038-0f11-4f22-a7dd-cd7ec1597120",
      "expense",
      125.75,
    ]));
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("creates a CUP receivable linked to a wire", async () => {
    const { query } = createClient([
      [],
      [{ id: "c-1" }],
      [{ balance: 1000 }],
      [{ id: "d-1" }],
      [],
      [],
    ]);
    const POST = await loadPostHandler();
    const response = await POST(new Request("http://localhost/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: "2cfc4038-0f11-4f22-a7dd-cd7ec1597120",
        movementType: "wire",
        amount: 10000,
        counterpartyId: "78de4fc2-ea93-49ac-a52f-b1ce22c0dded",
        settlementCurrency: "CUP",
        conversionRate: 700,
      }),
    }));

    expect(response.status).toBe(201);
    expect((await response.json()).debtAmount).toBe(7000000);
    const debtCall = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO finance_debt_movements"));
    expect(debtCall?.[1]).toEqual(expect.arrayContaining([7000000, 1000, 7001000]));
    const accountCall = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO account_outflow_movements"));
    expect(accountCall?.[1]).toEqual(expect.arrayContaining(["CUP", 700, 7000000, "d-1"]));
  });

  it("requires finance metadata for new wires", async () => {
    const POST = await loadPostHandler();
    const response = await POST(new Request("http://localhost/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: "2cfc4038-0f11-4f22-a7dd-cd7ec1597120",
        movementType: "wire",
        amount: 10,
      }),
    }));
    expect(response.status).toBe(400);
  });
});
