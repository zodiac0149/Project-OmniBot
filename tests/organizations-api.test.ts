import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../app/api/organizations/route";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn()
}));

describe("GET /api/organizations", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: "org-1", name: "Shoe Company" },
          { id: "org-2", name: "Tech Shop" }
        ],
        error: null
      })
    };

    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockSupabase as any);
  });

  it("should return public organizations list successfully", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Shoe Company");
    expect(data[1].name).toBe("Tech Shop");
  });

  it("should return 500 when database select fails", async () => {
    mockSupabase.order.mockResolvedValue({
      data: null,
      error: { message: "Database failure" }
    });

    const response = await GET();
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Database failure");
  });
});
