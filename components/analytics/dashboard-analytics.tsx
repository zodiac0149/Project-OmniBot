"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Building2, FileText, MessageSquare, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ConversationRow = {
  id: string;
  customerEmail: string | null;
  customerName: string | null;
  status: "Open" | "Resolved" | "Escalated";
  sentimentScore: number;
  createdAt: string;
};

type AnalyticsPayload = {
  totalChats: number;
  resolutionRate: number;
  escalationCount: number;
  conversations: ConversationRow[];
};

const fallbackAnalytics: AnalyticsPayload = {
  totalChats: 0,
  resolutionRate: 0,
  escalationCount: 0,
  conversations: []
};

function getPriorityLabel(score: number): { label: string; variant: "destructive" | "warning" | "success" } {
  if (score < 0.3) return { label: "High", variant: "destructive" };
  if (score < 0.6) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "success" };
}

function getStatusVariant(status: string): "info" | "success" | "warning" {
  if (status === "Open") return "info";
  if (status === "Resolved") return "success";
  return "warning";
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function DashboardAnalytics() {
  const [orgId, setOrgId] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsPayload>(fallbackAnalytics);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrgId() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getUser();
        const metadataOrgId = data.user?.user_metadata?.orgId;
        if (typeof metadataOrgId === "string") setOrgId(metadataOrgId);
      } catch { setOrgId(""); }
    }
    loadOrgId();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    async function loadAnalytics() {
      const response = await fetch(`/api/analytics?orgId=${encodeURIComponent(orgId)}`);
      const payload = await response.json();
      if (!response.ok) { setError(payload.error ?? "Unable to load analytics."); return; }
      setError(null);
      setAnalytics(payload);
    }
    loadAnalytics();
    window.addEventListener("nexusai:conversation-updated", loadAnalytics);
    return () => window.removeEventListener("nexusai:conversation-updated", loadAnalytics);
  }, [orgId]);

  const metrics = [
    {
      label: "Organizations", value: "—", trend: "", trendUp: true,
      icon: Building2, iconColor: "text-blue-600", iconBg: "bg-blue-50",
    },
    {
      label: "Total Users", value: "—", trend: "", trendUp: true,
      icon: Users, iconColor: "text-emerald-600", iconBg: "bg-emerald-50",
    },
    {
      label: "Conversations (Today)", value: analytics.totalChats > 0 ? String(analytics.totalChats) : "—", trend: "", trendUp: true,
      icon: MessageSquare, iconColor: "text-blue-600", iconBg: "bg-blue-50",
    },
    {
      label: "Escalations (Today)", value: analytics.escalationCount > 0 ? String(analytics.escalationCount) : "—", trend: "", trendUp: false,
      icon: AlertTriangle, iconColor: "text-red-500", iconBg: "bg-red-50",
    },
    {
      label: "Documents", value: analytics.conversations.length > 0 ? String(analytics.conversations.length) : "—", trend: "", trendUp: true,
      icon: FileText, iconColor: "text-blue-600", iconBg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 font-medium">{error}</p>
      )}

      {/* ── Recent Escalations Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h4 className="text-sm font-bold text-slate-900">Recent Escalations</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {analytics.conversations.length > 0 ? (
                analytics.conversations.map((conversation) => {
                  const priority = getPriorityLabel(conversation.sentimentScore);
                  return (
                    <tr key={conversation.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900 text-blue-600">
                        {conversation.customerEmail ?? "visitor@example.com"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">—</td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-[200px] truncate">
                        {conversation.customerName ? `${conversation.customerName} inquiry` : "Support inquiry"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={priority.variant}>{priority.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={getStatusVariant(conversation.status)}>{conversation.status}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{timeAgo(conversation.createdAt)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">No escalation data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30">
          <button className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
            View all escalations →
          </button>
        </div>
      </div>
    </div>
  );
}
