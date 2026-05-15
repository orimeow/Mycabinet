import { NextResponse } from "next/server";
import { getDiscussion, listDiscussions, saveDiscussion, deleteDiscussion } from "@/lib/db/database";
import { Discussion } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const userId = url.searchParams.get("userId");

  if (id) {
    // For single discussion fetch, userId is optional (backwards compat)
    const discussion = userId
      ? getDiscussion(userId, id)
      : getDiscussionFallback(id);
    if (!discussion) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(discussion);
  }

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const limit = parseInt(url.searchParams.get("limit") || "50");
  return NextResponse.json(listDiscussions(userId, limit));
}

export async function DELETE(req: Request) {
  const { id, userId } = await req.json();
  if (!id || !userId) return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });
  deleteDiscussion(userId, id);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const body = await req.json();
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

// Backwards compat for fetching without userId
function getDiscussionFallback(id: string): Discussion | null {
  const fs = require("fs");
  const path = require("path");
  const rootDir = path.join(process.cwd(), "data", "users");
  if (!fs.existsSync(rootDir)) return null;

  for (const userDir of fs.readdirSync(rootDir)) {
    const filePath = path.join(rootDir, userDir, "discussions", `${id}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Discussion;
    }
  }
  return null;
}
