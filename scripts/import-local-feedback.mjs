import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const backupPath = path.join(process.cwd(), "data", "feedback-store.json");
const dryRun = process.argv.includes("--dry-run");
const backup = JSON.parse(await readFile(backupPath, "utf8"));

if (!backup || !Array.isArray(backup.conversations) || !Array.isArray(backup.trash)) {
  throw new Error("The local feedback backup does not have the expected conversations and trash arrays.");
}

const conversations = backup.conversations.filter((item) =>
  item && typeof item.id === "string" && item.id.length > 0 && Array.isArray(item.messages),
);
const trash = backup.trash.filter((item) =>
  item && typeof item.id === "string" && typeof item.conversationId === "string" && item.record,
);

if (dryRun) {
  console.log(`Local backup is readable: ${conversations.length} conversations and ${trash.length} Trash entries are ready to merge.`);
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Set it in the project root .env before importing the backup.");
}

const sql = neon(connectionString);
await sql`CREATE TABLE IF NOT EXISTS gigabyte_feedback_state (
  id text PRIMARY KEY CHECK (id = 'main'),
  state jsonb NOT NULL DEFAULT '{"conversations": [], "trash": []}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`INSERT INTO gigabyte_feedback_state (id)
  VALUES ('main') ON CONFLICT (id) DO NOTHING`;

const [row] = await sql`SELECT state FROM gigabyte_feedback_state WHERE id = 'main'`;
let currentState = row?.state ?? { conversations: [], trash: [] };
if (typeof currentState === "string") currentState = JSON.parse(currentState);
const existingConversations = Array.isArray(currentState.conversations) ? currentState.conversations : [];
const existingTrash = Array.isArray(currentState.trash) ? currentState.trash : [];
const existingTrashIds = new Set(existingTrash.map((item) => item?.id).filter(Boolean));
const existingTrashConversationIds = new Set(existingTrash.map((item) => item?.conversationId ?? item?.record?.id).filter(Boolean));
const localTrashConversationIds = new Set(trash.map((item) => item.conversationId));

const mergedConversations = existingConversations.filter((item) => !localTrashConversationIds.has(item?.id));
const mergedConversationIds = new Set(mergedConversations.map((item) => item?.id).filter(Boolean));
let importedConversations = 0;
for (const item of conversations) {
  if (mergedConversationIds.has(item.id) || existingTrashConversationIds.has(item.id) || localTrashConversationIds.has(item.id)) continue;
  mergedConversations.push(item);
  mergedConversationIds.add(item.id);
  importedConversations += 1;
}

const mergedTrash = existingTrash.slice();
const mergedTrashIds = new Set(existingTrashIds);
const mergedTrashConversationIds = new Set(existingTrashConversationIds);
let importedTrash = 0;
const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
for (const item of trash) {
  const deletedAt = Date.parse(item.deletedAt ?? "");
  const expiresAt = Number.isFinite(deletedAt) ? new Date(deletedAt + fiveDaysMs).toISOString() : item.expiresAt;
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) continue;
  if (mergedTrashIds.has(item.id) || mergedTrashConversationIds.has(item.conversationId)) continue;
  mergedTrash.push({
    ...item,
    expiresAt,
    record: { ...item.record, trashExpiresAt: expiresAt },
  });
  mergedTrashIds.add(item.id);
  mergedTrashConversationIds.add(item.conversationId);
  importedTrash += 1;
}

await sql`UPDATE gigabyte_feedback_state
  SET state = ${JSON.stringify({ conversations: mergedConversations, trash: mergedTrash })}::jsonb,
      updated_at = now()
  WHERE id = 'main'`;

console.log(`Backup merge complete: added ${importedConversations} conversations and ${importedTrash} Trash entries; existing database records were retained.`);
