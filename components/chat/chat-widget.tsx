"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, FileText, Loader2, Send, ThumbsDown, ThumbsUp, UserRound, Lock, Headphones } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  source?: string;
  section?: string;
};

const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Ask a question about the documents you uploaded. I will answer only from that knowledge base."
  }
];

const suggestionChips = [
  "Warranty Information",
  "Return Policy",
  "Order & Delivery",
  "Product Support",
];

interface ChatWidgetProps {
  orgName?: string;
}

function renderMessageContent(content: string, isUser: boolean) {
  if (!content) return null;

  const lines = content.split("\n");
  
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        let trimmed = line.trim();
        
        // Match bullet items
        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
        if (isBullet) {
          trimmed = trimmed.substring(2);
        }

        // Match bold text
        const parts: (string | JSX.Element)[] = [];
        let cursor = 0;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;

        while ((match = boldRegex.exec(trimmed)) !== null) {
          const matchIndex = match.index;
          if (matchIndex > cursor) {
            parts.push(trimmed.substring(cursor, matchIndex));
          }
          parts.push(
            <strong 
              key={matchIndex} 
              className={cn(isUser ? "text-white font-bold" : "font-bold text-slate-900")}
            >
              {match[1]}
            </strong>
          );
          cursor = boldRegex.lastIndex;
        }

        if (cursor < trimmed.length) {
          parts.push(trimmed.substring(cursor));
        }

        if (isBullet) {
          return (
            <div key={index} className="flex items-start gap-1.5 pl-1.5">
              <span className={cn("select-none mt-1 text-[10px]", isUser ? "text-blue-200" : "text-blue-600")}>•</span>
              <span className="flex-1">{parts}</span>
            </div>
          );
        }

        return <p key={index} className={cn("min-h-[1.25rem]", isUser ? "text-white" : "text-slate-700")}>{parts}</p>;
      })}
    </div>
  );
}

export function ChatWidget({ orgName }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [orgId, setOrgId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadOrgId() {
      try {
        const sessionText = localStorage.getItem("nexusai.session");
        const session = sessionText ? JSON.parse(sessionText) : null;

        if (session) {
          setCustomerEmail(session.email || "");
          setOrgId(session.organizationId || "");
          setUserRole(session.role || "");
          setCustomerName(session.name || "");
        }
      } catch {
        setOrgId("");
      }
    }

    loadOrgId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [messages, isLoading]);

  function handleChipClick(chip: string) {
    setInput(chip);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) {
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orgId || orgId === "null" || orgId === "undefined" || !uuidRegex.test(orgId)) {
      setError("A valid Organization UUID is required. Please sign out and register a new customer account selecting a valid brand.");
      return;
    }

    setError(null);
    setInput("");
    setIsLoading(true);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedInput,
      timestamp: now
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: now
    };
    const requestMessages = [...messages.filter((message) => message.id !== "welcome"), userMessage].map(
      ({ role, content }) => ({ role, content })
    );

    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId,
          conversationId: conversationId || undefined,
          customerEmail: customerEmail || undefined,
          customerName: customerName || undefined,
          messages: requestMessages
        })
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to stream chat response.");
      }

      const returnedConversationId = response.headers.get("X-Conversation-Id");
      if (returnedConversationId) {
        setConversationId(returnedConversationId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id ? { ...message, content: message.content + chunk } : message
          )
        );
      }

      window.dispatchEvent(new Event("nexusai:conversation-updated"));
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to chat with NexusAI.");
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: "Let me connect you with a human agent." }
            : message
        )
      );
      window.dispatchEvent(new Event("nexusai:conversation-updated"));
    } finally {
      setIsLoading(false);
    }
  }

  const isCustomer = userRole === "customer";
  const orgDisplayName = orgName || "Grounded Brand";
  const hasActiveChat = messages.length > 1 || (messages.length === 1 && messages[0].id !== "welcome");

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
      {/* Organization badge or admin input */}
      {isCustomer ? (
        <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
            <Lock className="h-12 w-12 text-blue-600" />
          </div>
          <div className="relative z-10 space-y-1 pr-12">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
              Connected Organization
            </p>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{orgDisplayName}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Active
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="chatOrgId">
            Admin/Test Organization ID
          </label>
          <Input
            id="chatOrgId"
            value={orgId}
            onChange={(event) => setOrgId(event.target.value)}
            className="h-9 text-xs font-mono"
            placeholder="Paste organization UUID to simulate RAG grounding"
          />
        </div>
      )}

      {/* Suggestion Chips */}
      {!hasActiveChat && (
        <div className="flex flex-wrap gap-2">
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/30 shadow-sm overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 scrollbar-thin">
          {/* Empty State */}
          {messages.length <= 1 && messages[0]?.id === "welcome" && (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-3 animate-fade-in-up">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Bot className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">How can we help you today?</h3>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                Ask anything or choose a suggestion to get started.
              </p>
            </div>
          )}

          {/* Render Messages */}
          {messages.length > 0 && messages.map((message) => {
            if (message.id === "welcome") return null;

            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 animate-fade-in-up", 
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                {/* Assistant Icon */}
                {!isUser && (
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 border border-blue-100 text-blue-600 shadow-sm">
                    <Bot className="h-4 w-4" />
                  </span>
                )}

                {/* Bubble */}
                <div className="flex flex-col max-w-[75%] space-y-1.5">
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                      isUser 
                        ? "bg-blue-600 text-white rounded-tr-md font-medium" 
                        : "bg-white text-slate-700 rounded-tl-md border border-slate-100"
                    )}
                  >
                    {message.content ? (
                      <>
                        {renderMessageContent(message.content, isUser)}
                        {/* Source citation for assistant messages */}
                        {!isUser && message.content.length > 50 && (
                          <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">
                            <FileText className="h-3 w-3" />
                            <span>Source: <span className="text-blue-600 font-medium">Knowledge Base</span></span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-slate-500 font-medium animate-pulse text-xs">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                        Searching documents...
                      </span>
                    )}
                  </div>

                  {/* Timestamp + feedback */}
                  <div className={cn(
                    "flex items-center gap-2 px-1",
                    isUser ? "justify-end" : "justify-start"
                  )}>
                    {message.timestamp && (
                      <span className="text-[10px] font-medium text-slate-400">
                        {message.timestamp}
                      </span>
                    )}
                    {!isUser && message.content && (
                      <div className="flex items-center gap-1">
                        <button className="p-0.5 text-slate-300 hover:text-emerald-500 transition-colors">
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button className="p-0.5 text-slate-300 hover:text-rose-500 transition-colors">
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {isUser && message.content && (
                      <span className="text-blue-400">
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>

                {/* User Icon */}
                {isUser && (
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 border border-blue-100 text-blue-700 shadow-sm">
                    <UserRound className="h-4 w-4" />
                  </span>
                )}
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>


        {/* Form Container */}
        <form className="flex gap-2 border-t border-slate-100 bg-white p-3 rounded-b-xl" onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="flex-1 h-11 px-4 text-sm rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="default"
            disabled={isLoading || !input.trim()} 
            className="h-11 w-11 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-sm flex items-center justify-center transition-all active:scale-[0.95] disabled:opacity-50 disabled:cursor-not-allowed p-0"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
