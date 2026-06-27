import { describe, it, expect } from "vitest";
import { detectEscalation, extractEscalationReason } from "../lib/escalation/detect";

describe("detectEscalation", () => {
  it("should return shouldEscalate: true when the message contains 'human'", () => {
    const result = detectEscalation("I need to speak to a human");
    expect(result.shouldEscalate).toBe(true);
    expect(result.sentimentScore).toBe(-0.45);
  });

  it("should return shouldEscalate: true when the message contains 'agent'", () => {
    const result = detectEscalation("connect me to an agent please");
    expect(result.shouldEscalate).toBe(true);
    expect(result.sentimentScore).toBe(-0.45);
  });

  it("should return shouldEscalate: true when the message is angry/frustrated", () => {
    const result = detectEscalation("This service is terrible and useless!");
    expect(result.shouldEscalate).toBe(true);
    expect(result.sentimentScore).toBe(-0.9);
  });

  it("should return shouldEscalate: false and neutral-positive score for 'hi'", () => {
    const result = detectEscalation("hi");
    expect(result.shouldEscalate).toBe(false);
    expect(result.sentimentScore).toBe(0.2);
  });

  it("should return shouldEscalate: false for normal questions", () => {
    const result = detectEscalation("What is your refund policy?");
    expect(result.shouldEscalate).toBe(false);
    expect(result.sentimentScore).toBe(0.2);
  });
});

describe("extractEscalationReason", () => {
  it("should extract reason from 'angry with'", () => {
    const result = extractEscalationReason("i am very angry with your service");
    expect(result).toBe("your service");
  });

  it("should extract reason from 'angry with' for sales team", () => {
    const result = extractEscalationReason("i am angry with your sales team");
    expect(result).toBe("your sales team");
  });

  it("should extract reason from 'because'", () => {
    const result = extractEscalationReason("I am upset because the shipping is late");
    expect(result).toBe("the shipping is late");
  });

  it("should extract reason from 'due to'", () => {
    const result = extractEscalationReason("I want a refund due to poor customer care");
    expect(result).toBe("poor customer care");
  });

  it("should handle human request fallback", () => {
    const result = extractEscalationReason("Put me through to a manager please");
    expect(result).toBe("Requested a manager");
  });

  it("should return default fallback if no structure matches", () => {
    const result = extractEscalationReason("terrible useless thing");
    expect(result).toBe("General dissatisfaction");
  });
});
