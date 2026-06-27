import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customers")
      .select("id,email,lastBrandId,lastAccessAt,createdAt,disabled,customer_brand_links(brandId,brands(id,name))")
      .order("email");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data || []).map((user) => {
      const brandLinks = Array.isArray(user.customer_brand_links) ? user.customer_brand_links : [];
      const linkedBrands = brandLinks
        .map((link: any) => (Array.isArray(link.brands) ? link.brands[0] : link.brands))
        .filter(Boolean);
      const lastBrand = linkedBrands.find((brand: any) => brand.id === user.lastBrandId) ?? linkedBrands[0];

      return {
        id: user.id,
        email: user.email,
        name: user.email.split("@")[0],
        brandName: linkedBrands.map((brand: any) => brand.name).join(", ") || "No linked brands",
        lastBrandName: lastBrand?.name ?? null,
        lastAccessAt: user.lastAccessAt ?? user.createdAt,
        disabled: user.disabled
      };
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error fetching users." },
      { status: 500 }
    );
  }
}