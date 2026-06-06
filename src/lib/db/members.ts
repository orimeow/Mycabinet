import { CabinetMember } from "@/lib/types";
import fs from "fs";
import path from "path";

const ROOT_DATA_DIR = path.join(process.cwd(), "data", "users");

/** Whitelist validator for userId and member IDs — prevents path traversal */
const SAFE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

function validateId(value: string, label: string): void {
  if (!SAFE_ID_RE.test(value)) {
    throw new Error(`Invalid ${label}: must be alphanumeric with dots, hyphens, or underscores`);
  }
}

function getUserMembersDir(userId: string): string {
  validateId(userId, "userId");
  const dir = path.join(ROOT_DATA_DIR, userId, "members");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getMemberFilePath(userId: string, id: string): string {
  return path.join(getUserMembersDir(userId), `${id}.json`);
}

export function saveMember(userId: string, member: CabinetMember): void {
  const filePath = getMemberFilePath(userId, member.id);
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(member, null, 2));
  fs.renameSync(tmpPath, filePath);
}

export function getMember(userId: string, id: string): CabinetMember | null {
  const filePath = getMemberFilePath(userId, id);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as CabinetMember;
}

export function listMembers(userId: string): CabinetMember[] {
  const dir = getUserMembersDir(userId);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const members: CabinetMember[] = [];
  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(dir, file), "utf-8");
      members.push(JSON.parse(data) as CabinetMember);
    } catch {
      // Skip corrupted files
    }
  }
  return members;
}

export function deleteMember(userId: string, id: string): boolean {
  const filePath = getMemberFilePath(userId, id);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
