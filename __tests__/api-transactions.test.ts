import { describe, expect, it, vi, beforeEach } from "vitest";

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
  const mod = await import("@/app/api/transactions/route");
  return mod.POST;
}

async function loadGetHandler() {
  const mod = await import("@/app/api/transactions/route");
  return mod.GET;
}

describe("GET /api/transactions", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("returns active transactions by default", async () => {
    const client: MockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client);
    const GET = await loadGetHandler();

    const response = await GET(new Request("http://localhost/api/transactions"));

    expect(response.status).toBe(200);
    expect(String(client.query.mock.calls[0][0])).toContain("t.deleted_at IS NULL");
  });

  it("returns the trash with additive deletion metadata", async () => {
    const client: MockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "tx-1",
            bank: "TD Bank",
            accountName: "BDR",
            senderName: "Cliente",
            amount: "100",
            confirmationCode: "123",
            createdAt: "2026-08-11T12:00:00.000Z",
            deletedAt: "2026-08-11T13:00:00.000Z",
            deletionReason: "Duplicada",
            assignmentHistoryCount: "2",
          },
        ],
      }),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client);
    const GET = await loadGetHandler();

    const response = await GET(
      new Request("http://localhost/api/transactions?status=deleted"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(String(client.query.mock.calls[0][0])).toContain("t.deleted_at IS NOT NULL");
    expect(body.transactions[0]).toMatchObject({
      deletedAt: "2026-08-11T13:00:00.000Z",
      deletionReason: "Duplicada",
      assignmentHistoryCount: 2,
    });
  });

  it("rejects an unknown status", async () => {
    const GET = await loadGetHandler();
    const response = await GET(
      new Request("http://localhost/api/transactions?status=unknown"),
    );
    expect(response.status).toBe(400);
  });

  it("returns a cursor page with global summary and filter options", async () => {
    const client: MockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{
          transaction_rows: [{
            id: "11111111-1111-4111-8111-111111111111",
            bank: "TD Bank",
            accountName: "BDR",
            senderName: "Primero",
            amount: "100",
            confirmationCode: "1",
            createdAt: "2026-08-12T14:00:00.000Z",
            sort_at: "2026-08-12T14:00:00.000Z",
            assignmentHistoryCount: "0",
          }, {
            id: "22222222-2222-4222-8222-222222222222",
            bank: "TD Bank",
            accountName: "BDR",
            senderName: "Segundo",
            amount: "50",
            confirmationCode: "2",
            createdAt: "2026-08-12T14:00:00.000Z",
            sort_at: "2026-08-12T14:00:00.000Z",
            assignmentHistoryCount: "1",
          }],
          total_transactions: 25,
          total_amount: "2500",
          avg_transaction: "100",
          today_transactions: 5,
          yesterday_transactions: 4,
          today_amount: "500",
          yesterday_amount: "400",
          bank_totals: [{ name: "TD Bank", value: 2500 }],
          bank_distribution: [{ name: "TD Bank", value: 2500 }],
          account_distribution: [{ name: "BDR", value: 2500 }],
          chart_points: [],
          filter_banks: ["TD Bank"],
          filter_accounts: ["BDR"],
          filter_remeseros: ["Ernesto"],
        }] }),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client);
    const GET = await loadGetHandler();

    const response = await GET(new Request(
      "http://localhost/api/transactions?view=page&limit=1&bank=TD%20Bank",
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.transactions).toHaveLength(1);
    expect(body.pageInfo).toMatchObject({ hasMore: true });
    expect(body.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(body.summary).toMatchObject({ totalTransactions: 25, totalAmount: 2500 });
    expect(body.filterOptions.banks).toEqual(["TD Bank"]);
    expect(String(client.query.mock.calls[0][0])).toContain("page AS (");
    expect(String(client.query.mock.calls[0][0])).not.toContain("LEFT JOIN LATERAL");
  });

  it("rejects an invalid transaction cursor", async () => {
    const client: MockClient = { query: vi.fn(), release: vi.fn() };
    connectMock.mockResolvedValue(client);
    const GET = await loadGetHandler();
    const response = await GET(new Request(
      "http://localhost/api/transactions?view=page&cursor=invalid",
    ));
    expect(response.status).toBe(400);
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe("POST /api/transactions", () => {
  beforeEach(() => {
    process.env.N8N_INGEST_API_KEY = "test-token";
    connectMock.mockReset();
  });

  it("returns 401 when missing auth", async () => {
    const POST = await loadHandler();
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid json", async () => {
    const POST = await loadHandler();
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: "{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("inserts transaction and returns 200", async () => {
    const POST = await loadHandler();

    const client: MockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "bank-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "gmail-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "txn-1" }] })
      .mockResolvedValueOnce({ rows: [] });

    connectMock.mockResolvedValue(client);

    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        bankName: "Wells Fargo",
        accountName: "Personal",
        senderName: "John Doe",
        amount: 150,
        currency: "USD",
        confirmationCode: "WF-123",
        occurredAt: "2026-02-05T12:00:00Z",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.inserted).toBe(true);
    expect(json.id).toBe("txn-1");
  });

  it("persists email_id when provided in payload", async () => {
    const POST = await loadHandler();

    const client: MockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "bank-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "gmail-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "txn-2" }] })
      .mockResolvedValueOnce({ rows: [] });

    connectMock.mockResolvedValue(client);

    const emailId = "11111111-1111-1111-1111-111111111111";

    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email_id: emailId,
        bankName: "Wells Fargo",
        accountName: "Personal",
        senderName: "John Doe",
        amount: 150,
        currency: "USD",
        confirmationCode: "WF-456",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const insertCall = client.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO transactions"),
    );

    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]?.[0]).toBe(emailId);
  });

  it("stores non-uuid emailId directly", async () => {
    const POST = await loadHandler();

    const client: MockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "bank-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "gmail-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "txn-3" }] })
      .mockResolvedValueOnce({ rows: [] });

    connectMock.mockResolvedValue(client);

    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        emailId: "19d1be88ceba10ca",
        bankName: "Wells Fargo",
        accountName: "Personal",
        senderName: "John Doe",
        amount: 150,
        currency: "USD",
        confirmationCode: "WF-789",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const insertCall = client.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO transactions"),
    );

    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]?.[0]).toBe("19d1be88ceba10ca");
  });

  it("returns 409 when inserting a duplicate transaction", async () => {
    const POST = await loadHandler();

    const client: MockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "bank-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "gmail-1" }] })
      .mockRejectedValueOnce({ code: "23505" })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ deleted_at: "2026-08-11T13:00:00.000Z" }],
      });

    connectMock.mockResolvedValue(client);

    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        bankName: "Wells Fargo",
        accountName: "Personal",
        amount: "150",
        confirmationCode: "WF-123",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("duplicate_transaction");
    expect(json.deleted).toBe(true);
  });
});
