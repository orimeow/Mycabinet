import { NextResponse } from "next/server";
import { getDiscussion, listDiscussions, deleteDiscussion } from "@/lib/db/database";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const discussion = getDiscussion(id);
    if (!discussion) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(discussion);
  }

  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  return NextResponse.json(listDiscussions(limit, offset));
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  deleteDiscussion(id);
  return NextResponse.json({ ok: true });
}
