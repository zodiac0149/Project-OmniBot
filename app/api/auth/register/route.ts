import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, name, password, organizationId, organizationName, role } = await req.json();

    if (!email || !name || !password || (!organizationId && !organizationName)) {
      return NextResponse.json(
        { error: "Brand, name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    let selectedBrandId = String(organizationId || "");
    let selectedBrandName = String(organizationName || "");

    if (!selectedBrandId) {
      const { data: existingBrand } = await supabase
        .from("brands")
        .select("id,name")
        .ilike("name", selectedBrandName)
        .maybeSingle();

      if (existingBrand) {
        selectedBrandId = existingBrand.id;
        selectedBrandName = existingBrand.name;
      } else {
        const { data: organization, error: organizationError } = await supabase
          .from("brands")
          .insert({ name: selectedBrandName })
          .select("id,name")
          .single();

        if (organizationError || !organization) {
          return NextResponse.json(
            { error: organizationError?.message ?? "Unable to create brand." },
            { status: 500 }
          );
        }

        selectedBrandId = organization.id;
        selectedBrandName = organization.name;
      }
    } else {
      const { data: organization, error: organizationError } = await supabase
        .from("brands")
        .select("id,name")
        .eq("id", selectedBrandId)
        .single();

      if (organizationError || !organization) {
        return NextResponse.json({ error: "Selected brand does not exist." }, { status: 400 });
      }

      selectedBrandName = organization.name;
    }

    const normalizedEmail = String(email).toLowerCase();
    const passwordHash = hashPassword(String(password), normalizedEmail);

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id,email,passwordHash,disabled,lastBrandId")
      .eq("email", normalizedEmail)
      .maybeSingle();

    const { data: customer, error: accountError } = existingCustomer
      ? await supabase
          .from("customers")
          .update({
            passwordHash,
            lastBrandId: selectedBrandId
          })
          .eq("id", existingCustomer.id)
          .select("id,email")
          .single()
      : await supabase
          .from("customers")
          .insert({
            email: normalizedEmail,
            passwordHash,
            lastBrandId: selectedBrandId
          })
          .select("id,email")
          .single();

    if (accountError || !customer) {
      return NextResponse.json(
        { error: accountError?.message ?? "Unable to create customer account." },
        { status: accountError?.code === "23505" ? 409 : 500 }
      );
    }

    const { error: linkError } = await supabase
      .from("customer_brand_links")
      .upsert(
        {
          customerId: customer.id,
          brandId: selectedBrandId
        },
        { onConflict: "customerId,brandId" }
      );

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    return NextResponse.json({
      organization: {
        id: selectedBrandId,
        name: selectedBrandName
      },
      account: {
        id: customer.id,
        email: customer.email,
        name
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected registration error.";
    console.error("Register error:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
