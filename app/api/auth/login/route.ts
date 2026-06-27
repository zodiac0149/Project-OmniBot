import { NextResponse } from "next/server";

import { hashAdminPassword, hashPassword } from "@/lib/auth/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, organizationId, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase();
    const normalizedUsername = String(email).trim().toLowerCase();
    const isCustomerLogin = normalizedEmail.includes("@");

    // Admin login path: username + password (no brand required)
    if (!organizationId && !isCustomerLogin) {
      const supabase = createSupabaseAdminClient();
      const passwordHash = hashAdminPassword(String(password), normalizedUsername);

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("id,username,passwordHash,disabled")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (adminError || !admin || admin.disabled || admin.passwordHash !== passwordHash) {
        return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
      }

      await supabase
        .from("admins")
        .update({ lastLoginAt: new Date().toISOString() })
        .eq("id", admin.id);

      return NextResponse.json({
        session: {
          role: "admin",
          id: admin.id,
          name: admin.username,
          email: admin.username,
          adminId: admin.id,
          organizationId: null,
          organizationName: "NexusAI Admin"
        }
      });
    }

    const supabase = createSupabaseAdminClient();
    const passwordHash = hashPassword(String(password), normalizedEmail);

    const { data: customer, error } = await supabase
      .from("customers")
      .select("id,email,passwordHash,disabled,lastBrandId,lastAccessAt,createdAt")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error || !customer) {
      return NextResponse.json({ error: "Invalid brand, email, or password." }, { status: 401 });
    }

    if (customer.disabled || customer.passwordHash !== passwordHash) {
      return NextResponse.json({ error: "Invalid brand, email, or password." }, { status: 401 });
    }

    const requestedBrandId = typeof organizationId === "string" && organizationId ? organizationId : null;
    const { data: brandLinks, error: brandLinksError } = await supabase
      .from("customer_brand_links")
      .select("brandId,brands(id,name,disabled)")
      .eq("customerId", customer.id);

    if (brandLinksError || !brandLinks || brandLinks.length === 0) {
      return NextResponse.json({ error: "No active brand is linked to this account." }, { status: 401 });
    }

    const activeLinks = brandLinks.filter((link) => {
      const brand = Array.isArray(link.brands) ? link.brands[0] : link.brands;
      return brand && !brand.disabled;
    });

    if (activeLinks.length === 0) {
      return NextResponse.json({ error: "No active brand is linked to this account." }, { status: 401 });
    }

    const requestedBrandLink = requestedBrandId
      ? activeLinks.find((link) => link.brandId === requestedBrandId)
      : null;

    if (requestedBrandId && !requestedBrandLink) {
      return NextResponse.json(
        { error: "This account is not linked to the selected brand. Ask an admin to link this customer to that brand." },
        { status: 403 }
      );
    }

    const selectedLink =
      requestedBrandLink ??
      activeLinks.find((link) => link.brandId === customer.lastBrandId) ??
      activeLinks[0];

    const selectedBrandId = selectedLink.brandId;
    const linkedBrand = Array.isArray(selectedLink.brands) ? selectedLink.brands[0] : selectedLink.brands;

    if (!linkedBrand) {
      return NextResponse.json({ error: "No active brand is linked to this account." }, { status: 401 });
    }

    await supabase
      .from("customers")
      .update({
        lastBrandId: selectedBrandId,
        lastAccessAt: new Date().toISOString()
      })
      .eq("id", customer.id);

    return NextResponse.json({
      session: {
        role: "customer",
        id: customer.id,
        name: customer.email.split("@")[0],
        email: customer.email,
        organizationId: selectedBrandId,
        organizationName: linkedBrand.name ?? "Selected Brand",
        brandId: selectedBrandId,
        brandName: linkedBrand.name ?? "Selected Brand"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected login error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
