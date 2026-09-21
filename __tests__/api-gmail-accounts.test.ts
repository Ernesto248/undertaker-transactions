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
  const mod = await import("@/app/api/gmail-accounts/route");
  return mod.GET;
}

describe("GET /api/gmail-accounts", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("returns gmail accounts ordered by name", async () => {
    const GET = await loadHandler();

    const client: MockClient = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          { id: "g-lpc", accountName: "LPC INC" },
          { id: "g-tekfer", accountName: "Tekfer" },
        ],
      }),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client);

    const req = new Request("http://localhost/api/gmail-accounts");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.gmailAccounts).toEqual([
      { id: "g-lpc", accountName: "LPC INC" },
      { id: "g-tekfer", accountName: "Tekfer" },
    ]);
  });

  it("returns empty list when there are no accounts", async () => {
    const GET = await loadHandler();

    const client: MockClient = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client);

    const req = new Request("http://localhost/api/gmail-accounts");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.gmailAccounts).toEqual([]);
  });

  it("excludes archived accounts from active manual options", async () => {
    const GET = await loadHandler();
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    connectMock.mockResolvedValue({ query, release: vi.fn() });

    await GET(new Request("http://localhost/api/gmail-accounts?status=active"));

    expect(String(query.mock.calls[0][0])).toContain("WHERE archived_at IS NULL");
  });
});
