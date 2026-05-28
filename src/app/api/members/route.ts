import { NextRequest, NextResponse } from "next/server";
import { listMembers, saveMember, getMember, deleteMember } from "@/lib/db/members";
import { CabinetMember } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/members?userId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  const members = listMembers(userId);
  return NextResponse.json(members);
}

// POST /api/members
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, member } = body as { userId: string; member: CabinetMember };
    if (!userId || !member || !member.id) {
      return NextResponse.json({ error: "Missing userId or member" }, { status: 400 });
    }
    // Validate required fields
    if (!member.nameZh || !member.nameEn || !member.persona) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    member.source = "custom";
    saveMember(userId, member);
    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// PUT /api/members?id=xxx&userId=xxx
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");
    if (!id || !userId) {
      return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });
    }
    const existing = getMember(userId, id);
    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    const body = await req.json();
    const { member } = body as { member: CabinetMember };
    if (!member) {
      return NextResponse.json({ error: "Missing member data" }, { status: 400 });
    }
    const updated: CabinetMember = {
      ...existing,
      ...member,
      id,
      source: "custom",
      // Deep merge persona to avoid wiping out fields not included in the update
      persona: { ...existing.persona, ...member.persona },
    };
    saveMember(userId, updated);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// DELETE /api/members?id=xxx&userId=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const userId = searchParams.get("userId");
  if (!id || !userId) {
    return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });
  }
  deleteMember(userId, id);
  return NextResponse.json({ success: true });
}
