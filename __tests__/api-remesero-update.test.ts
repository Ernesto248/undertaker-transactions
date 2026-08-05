import { beforeEach, describe, expect, it, vi } from "vitest";

type MockClient = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

const connectMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({ connect: connectMock }),
  withRetry: async <T,>(operation: () => Promise<T>) => operation(),
}));

async function loadHandler() {
  const mod = await import("@/app/api/remeseros/[id]/route");
  return mod.PATCH;
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/remeseros/r-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/remeseros/[id]", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it("updates deuda_actual directly and accepts a negative fund balance", async () => {
    const PATCH = await loadHandler();
    const client: MockClient = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ id: "r-1" }] }),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client);

    const response = await PATCH(makeRequest({ deudaActual: -1250.5 }), {
      params: Promise.resolve({ id: "r-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toContain("deuda_actual = $1");
    expect(client.query.mock.calls[0][1]).toEqual([-1250.5, "r-1"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rejects a request without editable fields", async () => {
    const PATCH = await loadHandler();
    const response = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: "r-1" }),
    });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("rejects an empty debt value instead of converting it to zero", async () => {
    const PATCH = await loadHandler();
    const response = await PATCH(makeRequest({ deudaActual: "" }), {
      params: Promise.resolve({ id: "r-1" }),
    });

    expect(response.status).toBe(400);
    expect(connectMock).not.toHaveBeenCalled();
  });
});
