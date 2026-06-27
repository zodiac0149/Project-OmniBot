"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Building2, FileText, Headphones, Lock, MessageSquare } from "lucide-react";

type AppSession = {
  role: "super_admin" | "customer";
  organizationName?: string;
};

export default function HomePage() {
  const [session, setSession] = useState<AppSession | null>(null);

  useEffect(() => {
    const sessionText = localStorage.getItem("nexusai.session");
    setSession(sessionText ? JSON.parse(sessionText) : null);
  }, []);

  const portalHref = session?.role === "super_admin" ? "/dashboard" : "/customer/chat";

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white">
              <Bot className="h-4 w-4" />
            </span>
            NexusAI
          </Link>
          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href={portalHref}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Open Portal
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[1fr_28rem] lg:items-start">
        <div className="space-y-7">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#2563EB]">Enterprise AI Support Platform</p>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-[#0F172A] md:text-5xl">
              NexusAI
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Organization-specific support portals for customers, knowledge uploads for admins, and AI answers grounded in the selected organization&apos;s documents.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Building2, label: "Organization isolation", detail: "Each account is tied to a selected organization." },
              { icon: FileText, label: "Knowledge base", detail: "Documents are stored and retrieved by organization." },
              { icon: MessageSquare, label: "Customer chat", detail: "Chat history and answers stay tenant-specific." },
              { icon: Headphones, label: "Human escalation", detail: "Customers can ask to talk to a human agent." },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <item.icon className="h-5 w-5 text-[#2563EB]" />
                <h2 className="mt-3 text-sm font-bold text-[#0F172A]">{item.label}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">Unified Access</h2>
              <p className="text-sm text-slate-500">Select organization, then sign in.</p>
            </div>
          </div>

          <div className="space-y-3 py-5 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Identity key</span>
              <span className="font-mono text-xs text-slate-900">organization_id + email</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Admin username</span>
              <span className="font-mono text-xs text-slate-900">admin</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Customer portal</span>
              <span className="font-semibold text-emerald-700">Enabled</span>
            </div>
          </div>

          <Link
            href="/auth/login"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#2563EB] text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Login
          </Link>
        </aside>
      </section>
    </main>
  );
}
