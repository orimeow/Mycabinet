import { Discussion, DiscussionMessage } from "@/lib/types";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDiscussionsDir() {
  const dir = path.join(DATA_DIR, "discussions");
  ensureDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDiscussionFilePath(id: string): string {
  return path.join(getDiscussionsDir(), `${id}.json`);
}

export function saveDiscussion(discussion: Discussion): void {
  fs.writeFileSync(getDiscussionFilePath(discussion.id), JSON.stringify(discussion, null, 2));
}

export function saveMessage(message: DiscussionMessage, discussionId: string): void {
  const discussion = getDiscussion(discussionId);
  if (discussion) {
    discussion.messages.push(message);
    saveDiscussion(discussion);
  }
}

export function updateDiscussion(id: string, updates: Partial<Discussion>): void {
  const discussion = getDiscussion(id);
  if (discussion) {
    saveDiscussion({ ...discussion, ...updates });
  }
}

export function appendMessageToDiscussion(discussionId: string, message: DiscussionMessage): void {
  const discussion = getDiscussion(discussionId);
  if (discussion) {
    discussion.messages.push(message);
    saveDiscussion(discussion);
  }
}

export function getDiscussion(id: string): Discussion | null {
  const filePath = getDiscussionFilePath(id);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Discussion;
}

export function listDiscussions(limit: number = 20, offset: number = 0): Discussion[] {
  const dir = getDiscussionsDir();
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

  // Sort by createdAt desc
  discussions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return discussions.slice(offset, offset + limit);
}

export function deleteDiscussion(id: string): void {
  const filePath = getDiscussionFilePath(id);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
