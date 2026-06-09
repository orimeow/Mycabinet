import { Discussion } from "@/lib/types";
import fs from "fs";
import path from "path";

// DATA_DIR env var lets Railway / Docker point to a persistent volume.
// Fallback: project-local `data/` for local dev.
const ROOT_DATA_DIR = path.join(
  process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
  "users"
);
const MAX_MESSAGES_PER_DISCUSSION = 300;

/** Whitelist validator for userId and discussion IDs — prevents path traversal */
const SAFE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

function validateId(value: string, label: string): void {
  if (!SAFE_ID_RE.test(value)) {
    throw new Error(`Invalid ${label}: must be alphanumeric with dots, hyphens, or underscores`);
  }
}

function getUserDir(userId: string): string {
  validateId(userId, "userId");
  const dir = path.join(ROOT_DATA_DIR, userId, "discussions");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDiscussionFilePath(userId: string, id: string): string {
  validateId(id, "discussionId");
  return path.join(getUserDir(userId), `${id}.json`);
}

export function saveDiscussion(discussion: Discussion): void {
  if (!discussion.userId) throw new Error("Discussion must have a userId");
  // Trim oldest messages if exceeding limit
  const trimmed = {
    ...discussion,
    messages: discussion.messages.length > MAX_MESSAGES_PER_DISCUSSION
      ? discussion.messages.slice(-MAX_MESSAGES_PER_DISCUSSION)
      : discussion.messages,
  };
  const filePath = getDiscussionFilePath(trimmed.userId, trimmed.id);

  // Atomic write: write to temp file first, then rename to prevent corruption on crash
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(trimmed, null, 2));
  fs.renameSync(tmpPath, filePath);
}

export function getDiscussion(userId: string, id: string): Discussion | null {
  const filePath = getDiscussionFilePath(userId, id);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Discussion;
}

export function listDiscussions(userId: string, limit: number = 50): Discussion[] {
  const dir = getUserDir(userId);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  const discussions: Discussion[] = [];
  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(dir, file), "utf-8");
      discussions.push(JSON.parse(data) as Discussion);
    } catch {
      // Skip corrupted files
    }
  }

  discussions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return discussions.slice(0, limit);
}

export function deleteDiscussion(userId: string, id: string): void {
  const filePath = getDiscussionFilePath(userId, id);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
