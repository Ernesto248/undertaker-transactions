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
