const HUMAN_HANDOFF_PATTERNS = [
  { term: "human", pattern: /\bhuman\b/i },
  { term: "agent", pattern: /\bagent\b/i },
  { term: "representative", pattern: /\brepresentative\b/i },
  { term: "person", pattern: /\bperson\b/i },
  { term: "manager", pattern: /\bmanager\b/i },
  { term: "supervisor", pattern: /\bsupervisor\b/i }
];

const ANGRY_PATTERNS = [
  { term: "angry", pattern: /\bangry\b/i },
  { term: "furious", pattern: /\bfurious\b/i },
  { term: "mad", pattern: /\bmad\b/i },
  { term: "upset", pattern: /\bupset\b/i },
  { term: "frustrated", pattern: /\bfrustrated\b/i },
  { term: "terrible", pattern: /\bterrible\b/i },
  { term: "awful", pattern: /\bawful\b/i },
  { term: "horrible", pattern: /\bhorrible\b/i },
  { term: "useless", pattern: /\buseless\b/i },
  { term: "scam", pattern: /\bscam\b/i },
  { term: "refund now", pattern: /\brefund now\b/i },
  { term: "cancel", pattern: /\bcancel\b/i },
  { term: "complain", pattern: /\bcomplain/i }
];

export function getEscalationTerms(message: string) {
  return [...HUMAN_HANDOFF_PATTERNS, ...ANGRY_PATTERNS]
    .filter(({ pattern }) => pattern.test(message))
    .map(({ term }) => term);
}

export function detectEscalation(message: string) {
  const wantsHuman = HUMAN_HANDOFF_PATTERNS.some(({ pattern }) => pattern.test(message));
  const isAngry = ANGRY_PATTERNS.some(({ pattern }) => pattern.test(message));

  return {
    shouldEscalate: wantsHuman || isAngry,
    sentimentScore: isAngry ? -0.9 : wantsHuman ? -0.45 : 0.2
  };
}

export function extractEscalationReason(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "None specified";
  }

  // 1. Match "because of" or "because"
  const becauseMatch = message.match(/\bbecause\s+(?:of\s+)?([^.!?]+)/i);
  if (becauseMatch && becauseMatch[1].trim()) {
    return becauseMatch[1].trim();
  }

  // 2. Match "due to"
  const dueToMatch = message.match(/\bdue\s+to\s+([^.!?]+)/i);
  if (dueToMatch && dueToMatch[1].trim()) {
    return dueToMatch[1].trim();
  }

  // 3. Match "angry/frustrated/upset/mad/complain with/at/about/over"
  const prepMatch = message.match(/\b(?:angry|frustrated|upset|mad|complain)\s+(?:with|at|about|over)\s+([^.!?]+)/i);
  if (prepMatch && prepMatch[1].trim()) {
    return prepMatch[1].trim();
  }

  // 4. Check if they explicitly asked for a human/agent
  const HUMAN_HANDOFF_PATTERNS = /\b(human|agent|representative|person|manager|supervisor)\b/i;
  const humanMatch = message.match(HUMAN_HANDOFF_PATTERNS);
  if (humanMatch) {
    return `Requested a ${humanMatch[1].toLowerCase()}`;
  }

  // 5. Default fallback
  return "General dissatisfaction";
}
