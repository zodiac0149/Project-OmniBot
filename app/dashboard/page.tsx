"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bot,
  Building2,
  Calendar,
  CheckCircle,
  FileText,
  Headphones,
  MessageSquare,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KnowledgeUpload } from "@/components/knowledge/knowledge-upload";

type Brand = {
  id: string;
  name: string;
  policy: string | null;
  instructions: string | null;
  disabled?: boolean;
  createdBy?: string | null;
  createdByUsername?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Customer = {
  id: string;
  email: string;
  name: string;
  brandName: string;
  lastBrandName: string | null;
  lastAccessAt: string | null;
  disabled?: boolean;
};

type BrandAnalytics = {
  totalBrands: number;
  totalCustomers: number;
  totalDocuments: number;
  totalConversations: number;
  escalations: number;
  resolutionRate: number;
};

type EscalationReport = {
  id: string;
  brandName: string;
  customerEmail: string | null;
  customerName: string;
  sentimentScore: number;
  createdAt: string;
  triggerText: string;
  triggerTerms: string[];
  reason: string;
};

const navItems = [
  { icon: BarChart3, label: "Dashboard" },
  { icon: Building2, label: "Brands" },
  { icon: FileText, label: "Documents" },
  { icon: Users, label: "Customers" },
  { icon: MessageSquare, label: "Analytics" },
  { icon: Headphones, label: "Escalations" },
];

const initialAnalytics: BrandAnalytics = {
  totalBrands: 0,
  totalCustomers: 0,
  totalDocuments: 0,
  totalConversations: 0,
  escalations: 0,
  resolutionRate: 0,
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analytics, setAnalytics] = useState<BrandAnalytics>(initialAnalytics);
  const [escalationReports, setEscalationReports] = useState<EscalationReport[]>([]);
  const [brandMessage, setBrandMessage] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [brandPolicy, setBrandPolicy] = useState("");
  const [brandInstructions, setBrandInstructions] = useState("");
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editPolicy, setEditPolicy] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editName, setEditName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteBrandId, setInviteBrandId] = useState("");
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!inviteBrandId && brands.length > 0) {
      const firstActive = brands.find((brand) => !brand.disabled);
      setInviteBrandId(firstActive?.id ?? brands[0].id);
    }
  }, [brands, inviteBrandId]);

  useEffect(() => {
    const sessionText = localStorage.getItem("nexusai.session");
    const session = sessionText ? JSON.parse(sessionText) : null;

    if (!session || (session.role !== "super_admin" && session.role !== "admin" && session.role !== "manager")) {
      router.push("/auth/login");
      return;
    }

    setUser(session);
    loadBrands();
    loadCustomers();
    loadAnalytics();
    loadEscalations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeBrandCount = useMemo(() => brands.filter((brand) => !brand.disabled).length, [brands]);

  async function loadBrands() {
    const response = await fetch("/api/organizations", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setBrands(payload || []);
    }
  }

  async function loadCustomers() {
    const response = await fetch("/api/users", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setCustomers(payload || []);
    }
  }

  async function loadAnalytics() {
    const response = await fetch("/api/analytics", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setAnalytics(payload);
    }
  }

  async function loadEscalations() {
    const response = await fetch("/api/escalations", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setEscalationReports(payload || []);
    }
  }

  async function handleLogout() {
    localStorage.removeItem("nexusai.session");
    router.push("/");
    router.refresh();
  }

  async function createBrand() {
    setBrandMessage(null);

    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: brandName,
        policy: brandPolicy,
        instructions: brandInstructions,
        createdBy: user?.adminId ?? user?.id ?? null,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setBrandMessage(payload.error ?? "Unable to create brand.");
      return;
    }

    setBrandName("");
    setBrandPolicy("");
    setBrandInstructions("");
    setBrandMessage("Brand created.");
    await loadBrands();
    await loadAnalytics();
  }

  function startEditingBrand(brand: Brand) {
    setEditingBrandId(brand.id);
    setEditName(brand.name);
    setEditPolicy(brand.policy ?? "");
    setEditInstructions(brand.instructions ?? "");
  }

  async function saveBrandDetails(id: string) {
    await updateBrand(id, {
      name: editName.trim() || undefined,
      policy: editPolicy,
      instructions: editInstructions,
    });
    setEditingBrandId(null);
  }

  async function inviteCustomer() {
    setCustomerMessage(null);

    if (!inviteEmail || !invitePassword || !inviteBrandId) {
      setCustomerMessage("Email, password, and brand are required.");
      return;
    }

    const response = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inviteEmail.split("@")[0],
        email: inviteEmail,
        password: invitePassword,
        organizationId: inviteBrandId,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setCustomerMessage(payload.error ?? "Unable to invite customer.");
      return;
    }

    setInviteEmail("");
    setInvitePassword("");
    setCustomerMessage("Customer linked to brand.");
    await loadCustomers();
    await loadAnalytics();
  }

  async function updateBrand(id: string, update: Partial<Pick<Brand, "name" | "policy" | "instructions" | "disabled">>) {
    setBrandMessage(null);

    const response = await fetch("/api/organizations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...update }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setBrandMessage(payload.error ?? "Unable to update brand.");
      return;
    }

    setBrandMessage("Brand updated.");
    await loadBrands();
    await loadAnalytics();
  }

  async function deleteBrand(id: string) {
    setBrandMessage(null);

    const response = await fetch(`/api/organizations?id=${id}`, { method: "DELETE" });
    const payload = await response.json();

    if (!response.ok) {
      setBrandMessage(payload.error ?? "Unable to delete brand.");
      return;
    }

    setBrandMessage("Brand deleted.");
    await loadBrands();
    await loadCustomers();
    await loadAnalytics();
  }

  const headerCopy = {
    Dashboard: "Overview of your brand portal",
    Brands: "Manage brand records, policies, and instructions",
    Documents: "Upload RAG content for each brand",
    Customers: "Review Gmail customers and their linked brands",
    Analytics: "Track brands, documents, and conversation health",
    Escalations: "Review customer handoffs and the terms that triggered them",
  }[activeTab];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[15rem_1fr]">
        <aside className="hidden border-r border-slate-800 bg-[#0F172A] text-slate-100 lg:flex lg:flex-col">
          <Link href="/dashboard" className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Bot className="h-4 w-4" />
            </span>
            <span className="font-bold text-white">NexusAI</span>
          </Link>

          <nav className="flex-1 space-y-1 px-3 py-4 text-sm">
            {navItems.map(({ icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => setActiveTab(label)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                  activeTab === label
                    ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          {user && (
            <div className="border-t border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-bold text-white text-sm">
                  {(user.name || user.email || "A")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user.name || "Admin"}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email || "admin"}</p>
                </div>
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
            </div>
          )}
        </aside>

        <section className="flex flex-col">
          <header className="flex min-h-16 flex-col gap-3 border-b border-slate-200 bg-white px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">{activeTab}</h1>
              <p className="text-sm text-slate-500">{headerCopy}</p>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === "Dashboard" && (
                <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 md:flex">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">Brand portal live</span>
                </div>
              )}
              {user && (
                <Button variant="outline" size="sm" onClick={handleLogout} className="border-slate-200 text-slate-600">
                  Log out
                </Button>
              )}
            </div>
          </header>

          <div className="flex-1 p-6 md:p-8">
            {activeTab === "Dashboard" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { label: "Brands", value: analytics.totalBrands || activeBrandCount },
                    { label: "Customers", value: analytics.totalCustomers },
                    { label: "Documents", value: analytics.totalDocuments },
                    { label: "Resolution Rate", value: `${analytics.resolutionRate}%` },
                  ].map((metric) => (
                    <Card key={metric.label} className="border-slate-200 shadow-sm">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{metric.label}</p>
                        <p className="mt-2 text-2xl font-extrabold text-slate-900">{metric.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base font-bold">Brand Coverage</CardTitle>
                      <CardDescription>Active brands, linked customers, and uploaded documents.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                        <span className="text-slate-600">Active brands</span>
                        <span className="font-semibold text-slate-900">{activeBrandCount}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                        <span className="text-slate-600">Linked customers</span>
                        <span className="font-semibold text-slate-900">{customers.length}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                        <span className="text-slate-600">Knowledge chunks</span>
                        <span className="font-semibold text-slate-900">{analytics.totalDocuments}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base font-bold">Last Actions</CardTitle>
                      <CardDescription>Most recent state pulled from the brand portal APIs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="font-semibold text-slate-900">Brands fetched</p>
                        <p className="text-slate-500">{brands.length} records available for upload and login flows.</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="font-semibold text-slate-900">Customers fetched</p>
                        <p className="text-slate-500">{customers.length} Gmail identities linked to one or more brands.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "Brands" && (
              <div className="max-w-5xl space-y-5">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Create Brand</CardTitle>
                    <CardDescription>Add a brand with policy text and detailed instructions for retrieval and chat context.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Brand name" className="h-10" />
                      <Input value={brandPolicy} onChange={(event) => setBrandPolicy(event.target.value)} placeholder="Short policy summary" className="h-10" />
                    </div>
                    <textarea
                      value={brandInstructions}
                      onChange={(event) => setBrandInstructions(event.target.value)}
                      placeholder="Detailed instructions for support agents and retrieval prompts"
                      className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" onClick={createBrand} className="bg-blue-600 hover:bg-blue-700">
                        Create Brand
                      </Button>
                      {brandMessage ? <p className="text-sm font-medium text-slate-600">{brandMessage}</p> : null}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Registered Brands</CardTitle>
                    <CardDescription>Edit, disable, or remove brands that power customer login and RAG search.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {brands.length === 0 ? (
                      <p className="text-sm text-slate-500">No brands have been created yet.</p>
                    ) : (
                      brands.map((brand) => (
                        <div
                          key={brand.id}
                          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_auto]"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">{brand.name}</p>
                              <Badge variant={brand.disabled ? "secondary" : "success"}>
                                {brand.disabled ? "Disabled" : "Active"}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">
                              Policy: {brand.policy || "No policy set"}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-2">
                              Instructions: {brand.instructions || "No instructions set"}
                            </p>
                            <p className="text-xs text-slate-500">
                              Created by {brand.createdByUsername ?? "—"} · Updated {formatDate(brand.updatedAt)}
                            </p>
                            <p className="font-mono text-xs text-slate-400">{brand.id}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (editingBrandId === brand.id) {
                                  setEditingBrandId(null);
                                  return;
                                }
                                startEditingBrand(brand);
                              }}
                            >
                              {editingBrandId === brand.id ? "Cancel" : "Edit policy"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateBrand(brand.id, { disabled: !brand.disabled })}
                            >
                              {brand.disabled ? "Enable" : "Disable"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => {
                                if (window.confirm(`Delete ${brand.name}?`)) {
                                  deleteBrand(brand.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                          {editingBrandId === brand.id ? (
                            <div className="md:col-span-2 space-y-3 border-t border-slate-100 pt-3">
                              <Input
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                                placeholder="Brand name"
                                className="h-10"
                              />
                              <textarea
                                value={editPolicy}
                                onChange={(event) => setEditPolicy(event.target.value)}
                                placeholder="Brand policy text"
                                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              />
                              <textarea
                                value={editInstructions}
                                onChange={(event) => setEditInstructions(event.target.value)}
                                placeholder="Detailed instructions for chat and retrieval"
                                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              />
                              <Button type="button" size="sm" onClick={() => saveBrandDetails(brand.id)} className="bg-blue-600 hover:bg-blue-700">
                                Save policy & instructions
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "Documents" && (
              <div className="max-w-3xl">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Brand Documents</CardTitle>
                    <CardDescription>Upload training and policy documents for the selected brand. Files are chunked and embedded into brand_documents.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <KnowledgeUpload brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))} />
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "Customers" && (
              <div className="max-w-6xl space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: "Customers", value: customers.length },
                    { label: "Brands", value: brands.length },
                    { label: "Active now", value: customers.filter((customer) => customer.lastAccessAt).length },
                  ].map((metric) => (
                    <Card key={metric.label} className="border-slate-200 shadow-sm">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{metric.label}</p>
                        <p className="mt-2 text-2xl font-extrabold text-slate-900">{metric.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Link Customer to Brand</CardTitle>
                    <CardDescription>
                      Create or update a Gmail customer and link them to a brand via customer_brand_links.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Input
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="customer@gmail.com"
                        className="h-10"
                      />
                      <Input
                        type="password"
                        value={invitePassword}
                        onChange={(event) => setInvitePassword(event.target.value)}
                        placeholder="Shared password (8+ chars)"
                        className="h-10"
                      />
                      <select
                        value={inviteBrandId}
                        onChange={(event) => setInviteBrandId(event.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {brands.filter((brand) => !brand.disabled).map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button type="button" onClick={inviteCustomer} className="bg-blue-600 hover:bg-blue-700">
                        Link customer
                      </Button>
                      {customerMessage ? <p className="text-sm font-medium text-slate-600">{customerMessage}</p> : null}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Gmail Customers</CardTitle>
                    <CardDescription>Review linked brands and the most recent brand used at login.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder="Search by email or brand"
                      className="h-10 max-w-md"
                    />
                    {customers.filter((customer) => {
                      const query = customerSearch.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        customer.email.toLowerCase().includes(query) ||
                        customer.brandName.toLowerCase().includes(query) ||
                        customer.lastBrandName?.toLowerCase().includes(query) ||
                        customer.name.toLowerCase().includes(query)
                      );
                    }).length === 0 ? (
                      <p className="text-sm text-slate-500">No matching customers yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Linked brands</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Last brand</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Last access</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {customers
                              .filter((customer) => {
                                const query = customerSearch.trim().toLowerCase();
                                if (!query) return true;
                                return (
                                  customer.email.toLowerCase().includes(query) ||
                                  customer.brandName.toLowerCase().includes(query) ||
                                  customer.name.toLowerCase().includes(query)
                                );
                              })
                              .map((customer) => (
                                <tr key={customer.id} className="hover:bg-slate-50/60">
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-slate-900">{customer.email}</p>
                                    <p className="text-xs text-slate-500">{customer.name}</p>
                                  </td>
                                  <td className="px-4 py-3 text-slate-700">{customer.brandName}</td>
                                  <td className="px-4 py-3 text-slate-700">{customer.lastBrandName ?? "Not set"}</td>
                                  <td className="px-4 py-3 text-slate-500">{formatDate(customer.lastAccessAt)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "Escalations" && (
              <div className="max-w-6xl space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Escalated chats</p>
                      <p className="mt-2 text-2xl font-extrabold text-slate-900">{escalationReports.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Human requests</p>
                      <p className="mt-2 text-2xl font-extrabold text-slate-900">
                        {escalationReports.filter((report) =>
                          report.triggerTerms.some((term) => ["human", "agent", "representative", "person", "manager", "supervisor"].includes(term))
                        ).length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Negative sentiment</p>
                      <p className="mt-2 text-2xl font-extrabold text-slate-900">
                        {escalationReports.filter((report) => report.sentimentScore <= -0.9).length}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Escalation Review</CardTitle>
                    <CardDescription>Customers, brands, and the message terms that triggered human handoff.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {escalationReports.length === 0 ? (
                      <p className="text-sm text-slate-500">No escalations have been recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Brand</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Trigger terms</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Message</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {escalationReports.map((report) => (
                              <tr key={report.id} className="align-top hover:bg-slate-50/60">
                                <td className="px-4 py-3">
                                  <p className="font-semibold capitalize text-slate-900">{report.customerName}</p>
                                  <p className="text-xs text-slate-500">{report.customerEmail ?? "No email captured"}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{report.brandName}</td>
                                <td className="px-4 py-3">
                                  <div className="flex max-w-xs flex-wrap gap-1.5">
                                    {report.triggerTerms.length > 0 ? (
                                      report.triggerTerms.map((term) => (
                                        <Badge key={`${report.id}-${term}`} variant="destructive">
                                          {term}
                                        </Badge>
                                      ))
                                    ) : (
                                      <Badge variant="secondary">status escalated</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/10 capitalize">
                                    {report.reason}
                                  </span>
                                </td>
                                <td className="max-w-md px-4 py-3 text-slate-700">
                                  <p className="line-clamp-3">{report.triggerText || "No user message captured."}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-500">{formatDate(report.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "Analytics" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-5">
                  {[
                    { label: "Brands", value: analytics.totalBrands },
                    { label: "Customers", value: analytics.totalCustomers },
                    { label: "Documents", value: analytics.totalDocuments },
                    { label: "Conversations", value: analytics.totalConversations },
                    { label: "Escalations", value: analytics.escalations },
                  ].map((metric) => (
                    <Card key={metric.label} className="border-slate-200 shadow-sm">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{metric.label}</p>
                        <p className="mt-2 text-2xl font-extrabold text-slate-900">{metric.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Portal Snapshot</CardTitle>
                    <CardDescription>Brand portal health pulled from the live admin APIs.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                      <p className="text-slate-500">Active brand records</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{activeBrandCount}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                      <p className="text-slate-500">Resolution rate</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{analytics.resolutionRate}%</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                      <p className="text-slate-500">Document coverage</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{analytics.totalDocuments} chunks</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
