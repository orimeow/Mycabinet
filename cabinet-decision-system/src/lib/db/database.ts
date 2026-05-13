import { Discussion } from "@/lib/types";
import fs from "fs";
import path from "path";

const ROOT_DATA_DIR = path.join(process.cwd(), "data", "users");

function getUserDir(userId: string): string {
  const dir = path.join(ROOT_DATA_DIR, userId, "discussions");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDiscussionFilePath(userId: string, id: string): string {
  return path.join(getUserDir(userId), `${id}.json`);
}

export function saveDiscussion(discussion: Discussion): void {
  if (!discussion.userId) throw new Error("Discussion must have a userId");
  fs.writeFileSync(getDiscussionFilePath(discussion.userId, discussion.id), JSON.stringify(discussion, null, 2));
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
