import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../app/api/chat/route";
import { detectEscalation } from "@/lib/escalation/detect";
import { findRelevantKnowledge } from "@/lib/vectorStore";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { streamText } from "ai";

// Mock the dependencies using absolute alias paths matching the source imports
vi.mock("@/lib/escalation/detect", () => ({
  detectEscalation: vi.fn()
}));

vi.mock("@/lib/vectorStore", () => ({
  findRelevantKnowledge: vi.fn(),
  isVolatileKnowledgeQuery: vi.fn(() => false)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn()
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...actual,
    streamText: vi.fn()
  };
});

describe("POST /api/chat - Hand-off Escalation and Fallback Scenarios", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(function() {
        return Promise.resolve({ data: { id: "test-conv-id" }, error: null });
      }),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation(function(onFulfilled) {
        return Promise.resolve({ data: { id: "test-conv-id" }, error: null }).then(onFulfilled);
      })
    };

    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockSupabase as any);
  });

  it("should handle escalation when user requests human/agent", async () => {
    // 1. Setup mock values
    vi.mocked(detectEscalation).mockReturnValue({
      shouldEscalate: true,
      sentimentScore: -0.45
    });
    vi.mocked(findRelevantKnowledge).mockResolvedValue("No relevant uploaded company documents were found.");
    
    // Mock the Vercel AI streamText response
    const mockToTextStreamResponse = vi.fn().mockImplementation((init) => {
      return new Response("Let me connect you with a human agent.", {
        headers: init?.headers
      });
    });
    vi.mocked(streamText).mockReturnValue({
      toTextStreamResponse: mockToTextStreamResponse
    } as any);

    // 2. Build mock request
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        orgId: "00000000-0000-0000-0000-000000000000",
        messages: [{ role: "user", content: "connect to human agent" }]
      })
    });

    // 3. Execute
    const response = await POST(req);

    // 4. Assertions
    expect(detectEscalation).toHaveBeenCalledWith("connect to human agent");
    expect(response.headers.get("X-Conversation-Status")).toBe("Escalated");
    expect(response.status).toBe(200);

    const bodyText = await response.text();
    expect(bodyText).toContain("Let me connect you with a human agent.");
  });

  it("should handle fallback to human agent when prompt query has no matching context", async () => {
    // 1. Setup mock values
    vi.mocked(detectEscalation).mockReturnValue({
      shouldEscalate: false,
      sentimentScore: 0.2
    });
    // Context is empty because it's an unrelated question
    vi.mocked(findRelevantKnowledge).mockResolvedValue("");
    
    // Mock the streamText response
    const mockToTextStreamResponse = vi.fn().mockImplementation((init) => {
      return new Response("Let me connect you with a human agent.", {
        headers: init?.headers
      });
    });
    vi.mocked(streamText).mockReturnValue({
      toTextStreamResponse: mockToTextStreamResponse
    } as any);

    // 2. Build mock request
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        orgId: "00000000-0000-0000-0000-000000000000",
        messages: [{ role: "user", content: "unrelated query" }]
      })
    });

    // 3. Execute
    const response = await POST(req);

    // 4. Assertions
    expect(detectEscalation).toHaveBeenCalledWith("unrelated query");
    expect(findRelevantKnowledge).toHaveBeenCalledWith("unrelated query", "00000000-0000-0000-0000-000000000000");
    expect(response.headers.get("X-Conversation-Status")).toBe("Open");
    expect(response.status).toBe(200);

    const bodyText = await response.text();
    expect(bodyText).toContain("Let me connect you with a human agent.");
  });

  it("should respond to multi-step complaint queries by initiating interactive guidance", async () => {
    // 1. Setup mock values
    vi.mocked(detectEscalation).mockReturnValue({
      shouldEscalate: false,
      sentimentScore: 0.2
    });
    vi.mocked(findRelevantKnowledge).mockResolvedValue("Complaint Procedure: 1. Gather invoices. 2. Contact support.");
    
    const mockToTextStreamResponse = vi.fn().mockImplementation((init) => {
      // Mock the LLM outputting only Step 1 for interactive flow
      return new Response("Step 1: Gather your invoices. Do you have these ready?", {
        headers: init?.headers
      });
    });
    vi.mocked(streamText).mockReturnValue({
      toTextStreamResponse: mockToTextStreamResponse
    } as any);

    // 2. Build mock request
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        orgId: "00000000-0000-0000-0000-000000000000",
        messages: [{ role: "user", content: "how do I lodge a complaint?" }]
      })
    });

    // 3. Execute
    const response = await POST(req);

    // 4. Assertions
    expect(detectEscalation).toHaveBeenCalledWith("how do I lodge a complaint?");
    expect(findRelevantKnowledge).toHaveBeenCalledWith("how do I lodge a complaint?", "00000000-0000-0000-0000-000000000000");
    expect(response.headers.get("X-Conversation-Status")).toBe("Open");
    expect(response.status).toBe(200);

    const bodyText = await response.text();
    expect(bodyText).toContain("Step 1: Gather your invoices. Do you have these ready?");
  });
});
