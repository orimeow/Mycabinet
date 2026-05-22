import { CabinetMember } from "@/lib/types";
import fs from "fs";
import path from "path";

const ROOT_DATA_DIR = path.join(process.cwd(), "data", "users");

function getUserMembersDir(userId: string): string {
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
  fs.writeFileSync(getMemberFilePath(userId, member.id), JSON.stringify(member, null, 2));
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
