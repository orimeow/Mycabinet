import { NextResponse } from "next/server";
import { getDiscussion, listDiscussions, saveDiscussion, deleteDiscussion } from "@/lib/db/database";
import { Discussion } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const userId = url.searchParams.get("userId");

  if (id) {
    // Require userId for authorization — no fallback that scans all user directories
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const discussion = getDiscussion(userId, id);
    if (!discussion) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(discussion);
  }

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const limit = parseInt(url.searchParams.get("limit") || "50");
  return NextResponse.json(listDiscussions(userId, limit));
}

async function parseJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function DELETE(req: Request) {
  const body = await parseJsonBody<{ id: string; userId: string }>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { id, userId } = body;
  if (!id || !userId) return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });
  deleteDiscussion(userId, id);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const body = await parseJsonBody<{ id: string; userId: string; action: string }>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { id, userId, action } = body;

  if (!id || !userId) return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });

  if (action === "terminate") {
    const discussion = getDiscussion(userId, id);
    if (!discussion) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (discussion.status !== "running") {
      return NextResponse.json({ error: "Discussion not running" }, { status: 400 });
    }
    discussion.status = "terminated";
    discussion.terminatedAt = new Date().toISOString();
    saveDiscussion(discussion);
    return NextResponse.json(discussion);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
