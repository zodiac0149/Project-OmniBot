"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useRef } from "react";
import { Bot, Building2, ChevronDown, Eye, EyeOff, Lock, Mail, Search, Shield, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Organization = {
  id: string;
  name: string;
};

export default function CustomerRegisterPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch("/api/organizations", { cache: "no-store" });
        const data = await response.json();
        if (response.ok) setOrganizations(data || []);
      } catch {}
    }
    fetchOrganizations();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOrgDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(orgSearch.toLowerCase())
  );

  function getOrgColor(index: number): string {
    const colors = ["bg-blue-600", "bg-amber-500", "bg-emerald-600", "bg-orange-500", "bg-red-500", "bg-purple-600"];
    return colors[index % colors.length];
  }

  function getOrgCode(name: string, index: number): string {
    return `ORG_${String(index + 1).padStart(3, "0")}`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const customerName = String(formData.get("name"));
    const orgId = selectedOrg?.id;

    if (!orgId) {
      setError("Please select the organization you want to chat with.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "customer",
            customerName,
            orgId
          }
        }
      });

      if (signUpError) { setError(signUpError.message); return; }
      router.push("/auth/customer/login?registered=true");
    } catch (clientError) {
      setError(clientError instanceof Error ? clientError.message : "Unable to register.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
              <Bot className="h-8 w-8" />
            </div>
          </div>
          <Link href="/" className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            NexusAI
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">Create Account</h1>
          <p className="text-sm text-slate-500">Register to chat with your organization&apos;s support</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Organization Selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Organization</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  {selectedOrg ? (
                    <span className="font-medium text-slate-900">{selectedOrg.name}</span>
                  ) : (
                    <span className="text-slate-400">Search organization...</span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${orgDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {orgDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-fade-in-up">
                  <div className="p-2 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type="text" value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} placeholder="Search organization..." className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto py-1">
                    {filteredOrgs.length > 0 ? filteredOrgs.map((org, index) => (
                      <button key={org.id} type="button" onClick={() => { setSelectedOrg(org); setOrgDropdownOpen(false); setOrgSearch(""); }}
                        className={`flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-50 ${selectedOrg?.id === org.id ? "bg-blue-50" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${getOrgColor(index)} text-white text-xs font-bold`}>{org.name[0].toUpperCase()}</div>
                          <span className="font-medium text-slate-900">{org.name}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{getOrgCode(org.name, index)}</span>
                      </button>
                    )) : <div className="px-3 py-4 text-center text-sm text-slate-400">No organizations found</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="name">Full Name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="name" name="name" type="text" className="pl-10 h-11 border-slate-200" placeholder="Enter your full name" required />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="email">Email Address</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="email" name="email" type="email" className="pl-10 h-11 border-slate-200" placeholder="Enter your email" required />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="password" name="password" type={showPassword ? "text" : "password"} className="pl-10 pr-10 h-11 border-slate-200" placeholder="At least 8 characters" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 font-medium">{error}</p>}

          <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm" type="submit" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
          <div className="relative flex justify-center"><span className="bg-slate-50 px-3 text-sm text-slate-400">or</span></div>
        </div>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/auth/customer/login" className="font-semibold text-blue-600 hover:text-blue-700">Log in here</Link>
        </p>

        <div className="flex items-center justify-center gap-2 pt-4 text-xs text-slate-400">
          <Shield className="h-4 w-4" />
          <div><span className="font-semibold text-slate-500">Secure. Private. Reliable.</span><br /><span>Your conversations and data are protected.</span></div>
        </div>
      </div>
    </main>
  );
}
