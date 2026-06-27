import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { name, email, password, organizationId, role } = await req.json();

    if (!name || !email || !password || !organizationId) {
      return NextResponse.json({ error: "Name, email, password, and organization are required." }, { status: 400 });
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase();
    const userRole = role === "manager" || role === "admin" ? role : "customer";
    const supabase = createSupabaseAdminClient();
    const passwordHash = hashPassword(String(password), normalizedEmail);

    const { data: organization, error: organizationError } = await supabase
      .from("brands")
      .select("id,name,disabled")
      .eq("id", organizationId)
      .single();

    if (organizationError || !organization) {
      return NextResponse.json({ error: "Selected brand does not exist." }, { status: 400 });
    }

    if (organization.disabled) {
      return NextResponse.json({ error: "Selected brand is disabled." }, { status: 400 });
    }

    const { data: customer, error: accountError } = await supabase
      .from("customers")
      .upsert(
        {
          email: normalizedEmail,
          passwordHash,
          lastBrandId: organizationId
        },
        { onConflict: "email" }
      )
      .select("id,email,disabled,createdAt")
      .single();

    if (accountError || !customer) {
      return NextResponse.json(
        { error: accountError?.message ?? "Unable to create customer." },
        { status: accountError?.code === "23505" ? 409 : 500 }
      );
    }

    const { error: linkError } = await supabase
      .from("customer_brand_links")
      .upsert(
        {
          customerId: customer.id,
          brandId: organizationId
        },
        { onConflict: "customerId,brandId" }
      );

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    return NextResponse.json({
      user: {
        id: customer.id,
        name,
        email: customer.email,
        role: userRole,
        status: customer.disabled ? "Disabled" : "Active",
        organizationId,
        createdAt: customer.createdAt
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected invite error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}