import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({ connect: connectMock }),
}));

async function loadPostHandler() {
  const mod = await import("@/app/api/accounts/route");
  return mod.POST;
}

describe("POST /api/accounts", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it.each(["wire", "expense"] as const)(
    "preserves decimal amounts for %s movements",
    async (movementType) => {
      const query = vi.fn().mockResolvedValue({
        rows: [{ id: `movement-${movementType}` }],
      });
      const release = vi.fn();
      connectMock.mockResolvedValue({ query, release });

      const POST = await loadPostHandler();
      const request = new Request("http://localhost/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: "2cfc4038-0f11-4f22-a7dd-cd7ec1597120",
          movementType,
          amount: 125.75,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(query).toHaveBeenCalledWith(expect.any(String), [
        "2cfc4038-0f11-4f22-a7dd-cd7ec1597120",
        movementType,
        125.75,
        null,
      ]);
      expect(release).toHaveBeenCalledOnce();
    },
  );
});
