"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Bot, 
  MessageSquare, 
  ChevronDown, 
  User, 
  LogOut, 
  CheckCircle,
  Headphones,
  Plus,
  MessagesSquare,
} from "lucide-react";

import { ChatWidget } from "@/components/chat/chat-widget";

export default function CustomerChatPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "chats" | "profile" | "support">("chat");
  const [chatResetKey, setChatResetKey] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();

  useEffect(() => {
    const sessionText = localStorage.getItem("nexusai.session");
    const session = sessionText ? JSON.parse(sessionText) : null;

    if (!session || session.role !== "customer") {
      router.push("/auth/login");
      return;
    }

    setUser({
      email: session.email,
      user_metadata: {
        customerName: session.name,
        orgId: session.organizationId,
        organizationName: session.organizationName,
        role: session.role
      }
    });
    setOrgName(session.organizationName || "");
    setLoading(false);

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem("nexusai.session");
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Bot className="h-6 w-6 animate-pulse" />
          </span>
          <p className="text-sm font-medium text-slate-500">Initializing customer portal...</p>
        </div>
      </div>
    );
  }

  const customerName = user?.user_metadata?.customerName || "Valued Customer";
  const orgNameDisplay = orgName || "Verified Organization";

  // Get org initial color
  function getOrgColor(): string {
    const name = orgNameDisplay.toLowerCase();
    if (name.startsWith("s")) return "bg-blue-600";
    if (name.startsWith("a")) return "bg-amber-500";
    if (name.startsWith("n")) return "bg-emerald-600";
    return "bg-blue-600";
  }

  const sidebarNavItems = [
    { id: "chats" as const, icon: MessagesSquare, label: "Chats" },
    { id: "profile" as const, icon: User, label: "Profile" },
    { id: "support" as const, icon: Headphones, label: "Support" },
  ];

  return (
    <main className="h-screen overflow-hidden bg-white text-slate-900 font-sans antialiased">
      <div className="flex h-screen overflow-hidden">
        {/* ── Left Sidebar — Org Branded ── */}
        <aside className="hidden md:flex md:flex-col w-56 bg-white border-r border-slate-200">
          {/* Org branding */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${getOrgColor()} text-white text-sm font-bold`}>
              {orgNameDisplay[0].toUpperCase()}
            </div>
            <span className="font-bold text-slate-900 text-sm">{orgNameDisplay}</span>
          </div>

          {/* New Chat button */}
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={() => {
                setChatResetKey((current) => current + 1);
                setActiveTab("chat");
              }}
              className="flex w-full items-center justify-center gap-2 h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-2 space-y-1">
            {sidebarNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-all ${
                  activeTab === item.id
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* User at bottom */}
          <div className="border-t border-slate-100 px-4 py-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex w-full items-center gap-3 rounded-lg hover:bg-slate-50 p-1 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 font-bold text-white text-sm">
                  {customerName[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-slate-900 truncate">{customerName}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-fade-in-up">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
          {/* Top bar with AI Assistant badge */}
          <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 h-14">
            <div className="flex items-center gap-3 md:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Bot className="h-4 w-4" />
              </span>
              <span className="font-bold text-slate-900">{orgNameDisplay}</span>
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-600">AI Assistant Online</span>
            </div>
          </header>

          {/* Chat area */}
          <div className="flex-1 flex flex-col p-6 min-h-0 overflow-hidden">
            <div className={activeTab === "chat" || activeTab === "chats" ? "flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden" : "hidden"}>
                <div className="space-y-1 shrink-0">
                  <h1 className="text-2xl font-extrabold text-slate-900">How can we help you today?</h1>
                  <p className="text-sm text-slate-500">
                    Ask anything about {orgNameDisplay} policies, products, returns, warranty and more.
                  </p>
                </div>
                <ChatWidget key={chatResetKey} orgName={orgNameDisplay} />
            </div>

            {activeTab === "profile" && (
              <div className="space-y-4 overflow-y-auto flex-1 p-1">
                <h1 className="text-2xl font-extrabold text-slate-900">Profile</h1>
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-md">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-xl">
                      {customerName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{customerName}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Organization</span>
                      <span className="font-medium text-slate-900">{orgNameDisplay}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Role</span>
                      <span className="font-medium text-slate-900">Customer</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "support" && (
              <div className="space-y-4 overflow-y-auto flex-1 p-1">
                <h1 className="text-2xl font-extrabold text-slate-900">Support</h1>
                <p className="text-sm text-slate-500">Contact support or escalate your issue to a human agent.</p>
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3 max-w-md">
                  <Headphones className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-sm text-slate-500">Need to speak with a human agent? Use the chat and ask to be connected.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
