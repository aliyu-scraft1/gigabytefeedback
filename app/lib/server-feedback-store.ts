import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export interface FeedbackDatabaseState {
  conversations: Array<Record<string, unknown>>;
  trash: Array<Record<string, unknown>>;
}

function getSql() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to the feedback database.");
  }

  return neon(connectionString);
}

async function ensureStateRow(sql: NeonQueryFunction<false, false>) {
  await sql`CREATE TABLE IF NOT EXISTS gigabyte_feedback_state (
    id text PRIMARY KEY CHECK (id = 'main'),
    state jsonb NOT NULL DEFAULT '{"conversations": [], "trash": []}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`INSERT INTO gigabyte_feedback_state (id)
    VALUES ('main') ON CONFLICT (id) DO NOTHING`;
  await sql`UPDATE gigabyte_feedback_state
    SET state = jsonb_set(
      state,
      '{trash}',
      COALESCE((
        SELECT jsonb_agg(entry.item ORDER BY entry.ordinality)
        FROM jsonb_array_elements(COALESCE(state->'trash', '[]'::jsonb))
          WITH ORDINALITY AS entry(item, ordinality)
        WHERE CASE
          WHEN entry.item->>'expiresAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
            THEN (entry.item->>'expiresAt')::timestamptz > now()
          ELSE false
        END
      ), '[]'::jsonb),
      true
    ), updated_at = now()
    WHERE id = 'main'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(state->'trash', '[]'::jsonb)) expired_entry
        WHERE CASE
          WHEN expired_entry->>'expiresAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
            THEN (expired_entry->>'expiresAt')::timestamptz <= now()
          ELSE true
        END
      )`;
}

function asFeedbackState(value: unknown): FeedbackDatabaseState {
  if (!value || typeof value !== "object") return { conversations: [], trash: [] };
  const state = value as Partial<FeedbackDatabaseState>;
  return {
    conversations: Array.isArray(state.conversations) ? state.conversations : [],
    trash: Array.isArray(state.trash)
      ? state.trash.filter((entry) => {
          const expiresAt = Date.parse(String(entry.expiresAt ?? ""));
          return Number.isFinite(expiresAt) && expiresAt > Date.now();
        })
      : [],
  };
}

export async function readFeedbackStateFromDatabase(): Promise<FeedbackDatabaseState> {
  const sql = getSql();
  await ensureStateRow(sql);
  const [row] = await sql`SELECT state FROM gigabyte_feedback_state WHERE id = 'main'`;
  const state = asFeedbackState(row?.state);
  const original = row?.state as Partial<FeedbackDatabaseState> | undefined;
  if (Array.isArray(original?.trash) && original.trash.length !== state.trash.length) {
    await sql`UPDATE gigabyte_feedback_state
      SET state = jsonb_set(state, '{trash}', ${JSON.stringify(state.trash)}::jsonb, true), updated_at = now()
      WHERE id = 'main'`;
  }
  return state;
}

export async function replaceFeedbackState(state: FeedbackDatabaseState) {
  const sql = getSql();
  await ensureStateRow(sql);
  const cleanedState = asFeedbackState(state);
  const conversations = JSON.stringify(cleanedState.conversations);
  const trash = JSON.stringify(cleanedState.trash);
  const [row] = await sql`UPDATE gigabyte_feedback_state AS stored
    SET state = jsonb_build_object(
      'conversations',
      ${conversations}::jsonb || COALESCE((
        SELECT jsonb_agg(current_conversation.item ORDER BY current_conversation.ordinality)
        FROM jsonb_array_elements(COALESCE(stored.state->'conversations', '[]'::jsonb))
          WITH ORDINALITY AS current_conversation(item, ordinality)
        WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(${conversations}::jsonb) AS submitted_conversation(item)
          WHERE submitted_conversation.item->>'id' = current_conversation.item->>'id'
        )
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(${trash}::jsonb) AS submitted_trash(item)
            WHERE COALESCE(
              submitted_trash.item->>'conversationId',
              submitted_trash.item->'record'->>'id'
            ) = current_conversation.item->>'id'
          )
      ), '[]'::jsonb),
      'trash',
      ${trash}::jsonb || COALESCE((
        SELECT jsonb_agg(current_trash.item ORDER BY current_trash.ordinality)
        FROM jsonb_array_elements(COALESCE(stored.state->'trash', '[]'::jsonb))
          WITH ORDINALITY AS current_trash(item, ordinality)
        WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(${conversations}::jsonb) AS submitted_conversation(item)
          WHERE submitted_conversation.item->>'id' = COALESCE(
            current_trash.item->>'conversationId',
            current_trash.item->'record'->>'id'
          )
        )
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(${trash}::jsonb) AS submitted_trash(item)
            WHERE submitted_trash.item->>'id' = current_trash.item->>'id'
          )
          AND (current_trash.item->>'expiresAt')::timestamptz > now()
      ), '[]'::jsonb)
    ), updated_at = now()
    WHERE stored.id = 'main'
    RETURNING stored.state`;

  return asFeedbackState(row?.state);
}

export async function saveFeedbackRecord(record: Record<string, unknown>) {
  const sql = getSql();
  await ensureStateRow(sql);
  const [row] = await sql`UPDATE gigabyte_feedback_state
    SET state = jsonb_set(
      state,
      '{conversations}',
      jsonb_build_array(${JSON.stringify(record)}::jsonb) || COALESCE(state->'conversations', '[]'::jsonb),
      true
    ), updated_at = now()
    WHERE id = 'main'
    RETURNING state`;

  return asFeedbackState(row?.state);
}

export async function appendFeedbackMessage(
  recordId: string,
  message: { id: string; sender: "customer" | "agent"; text: string; createdAt: string },
) {
  const sql = getSql();
  await ensureStateRow(sql);
  const serializedMessage = JSON.stringify(message);
  const [row] = await sql`UPDATE gigabyte_feedback_state
    SET state = jsonb_set(
      state,
      '{conversations}',
      (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN conversation->>'id' = ${recordId}
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(conversation->'messages', '[]'::jsonb)) existing_message
                WHERE existing_message->>'id' = ${message.id}
              )
            THEN jsonb_set(
              jsonb_set(
                jsonb_set(
                  conversation,
                  '{messages}',
                  COALESCE(conversation->'messages', '[]'::jsonb) || jsonb_build_array(${serializedMessage}::jsonb),
                  true
                ),
                '{updatedAt}', to_jsonb(${message.createdAt}::text), true
              ),
              '{unread}', to_jsonb(${message.sender === "customer"}), true
            )
            ELSE conversation
          END
        ), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(state->'conversations', '[]'::jsonb)) conversation
      ),
      true
    ), updated_at = now()
    WHERE id = 'main'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(state->'conversations', '[]'::jsonb)) conversation
        WHERE conversation->>'id' = ${recordId}
      )
    RETURNING state`;

  return Boolean(row);
}
