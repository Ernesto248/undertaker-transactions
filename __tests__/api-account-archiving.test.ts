import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({ connect: connectMock }),
}));

describe("PATCH /api/accounts/[id] account archiving", () => {
  beforeEach(() => connectMock.mockReset());

  it("archives an account without deleting its historical data", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ownerFeePercent: 2, archivedAt: null }] })
      .mockResolvedValueOnce({ rows: [{ archivedAt: "2026-09-21T10:00:00.000Z" }] })
      .mockResolvedValueOnce({ rows: [] });
    connectMock.mockResolvedValue({ query, release: vi.fn() });

    const { PATCH } = await import("@/app/api/accounts/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/accounts/11111111-1111-1111-1111-111111111111", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }),
      { params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      accountId: "11111111-1111-1111-1111-111111111111",
      archivedAt: "2026-09-21T10:00:00.000Z",
    });
    const update = query.mock.calls.find(([sql]) => String(sql).includes("SET archived_at"));
    expect(update?.[1]).toEqual(["11111111-1111-1111-1111-111111111111", true]);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });
});

