CREATE TABLE IF NOT EXISTS gigabyte_feedback_state (
  id text PRIMARY KEY CHECK (id = 'main'),
  state jsonb NOT NULL DEFAULT '{"conversations": [], "trash": []}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO gigabyte_feedback_state (id)
VALUES ('main')
ON CONFLICT (id) DO NOTHING;
