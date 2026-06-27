import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, policy, instructions, disabled, createdBy, createdAt, updatedAt, admins:createdBy(username)")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map((row) => mapBrandRow(row as Record<string, unknown>)));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error fetching brands." },
      { status: 500 }
    );
  }
}

function mapBrandRow(row: Record<string, unknown>) {
  const admin = Array.isArray(row.admins) ? row.admins[0] : row.admins;
  return {
    id: row.id,
    name: row.name,
    policy: row.policy,
    instructions: row.instructions,
    disabled: row.disabled,
    createdBy: row.createdBy,
    createdByUsername: admin && typeof admin === "object" && "username" in admin ? admin.username : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function POST(req: Request) {
  try {
    const { name, policy, instructions, createdBy } = await req.json();

    if (!name || String(name).trim().length < 2) {
      return NextResponse.json({ error: "Brand name is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const insertRow: {
      name: string;
      policy: string | null;
      instructions: string | null;
      createdBy?: string;
    } = {
      name: String(name).trim(),
      policy: typeof policy === "string" ? policy : null,
      instructions: typeof instructions === "string" ? instructions : null
    };

    if (typeof createdBy === "string" && createdBy) {
      insertRow.createdBy = createdBy;
    }

    const { data, error } = await supabase
      .from("brands")
      .insert(insertRow)
      .select("id, name, policy, instructions, disabled, createdBy, createdAt, updatedAt, admins:createdBy(username)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === "23505" ? 409 : 500 });
    }

    return NextResponse.json(mapBrandRow(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error creating organization." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, name, policy, instructions, disabled } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Brand id is required." }, { status: 400 });
    }

    const update: { name?: string; policy?: string | null; instructions?: string | null; disabled?: boolean } = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof policy === "string") update.policy = policy;
    if (policy === null) update.policy = null;
    if (typeof instructions === "string") update.instructions = instructions;
    if (instructions === null) update.instructions = null;
    if (typeof disabled === "boolean") update.disabled = disabled;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("brands")
      .update(update)
      .eq("id", id)
      .select("id, name, policy, instructions, disabled, createdBy, createdAt, updatedAt, admins:createdBy(username)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapBrandRow(data as Record<string, unknown>));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error updating organization." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Brand id is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("brands").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error deleting organization." },
      { status: 500 }
    );
  }
}
