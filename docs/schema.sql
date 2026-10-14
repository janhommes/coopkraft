-- Energiegenossenschaft – einfaches SQL-Schema für den eigenen Server
-- Kompatibel mit PostgreSQL (für SQLite: JSONB -> TEXT, TIMESTAMPTZ -> TEXT).
-- Jede Tabelle entspricht einem Datenbereich der App. Die Datensätze werden
-- 1:1 als JSON abgelegt (gleiches Format wie die Sicherungsdatei), damit
-- REST-Schnittstelle und App ohne Umbau zusammenpassen. Häufig gesuchte Felder
-- sind zusätzlich als Spalten herausgezogen.

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  email TEXT,
  status TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX members_email_idx ON members (lower(email));
CREATE INDEX members_status_idx ON members (status);

CREATE TABLE share_lots (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  status TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX share_lots_member_idx ON share_lots (member_id);

CREATE TABLE share_transfers      (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE terminations         (id TEXT PRIMARY KEY, member_id TEXT, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE approvals            (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE payment_confirmations(id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE documents            (id TEXT PRIMARY KEY, member_id TEXT, visibility TEXT, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE document_files       (id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE, content BYTEA NOT NULL, mime_type TEXT);
CREATE TABLE campaigns            (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE dividends            (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE custom_fields        (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE users                (id TEXT PRIMARY KEY, email TEXT, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE audit_log            (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), data JSONB NOT NULL);

-- Singletons: settings ('singleton', 'sso'), workflow_config ('singleton'), meta
CREATE TABLE settings        (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE workflow_config (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE meta            (id TEXT PRIMARY KEY, value JSONB);

-- Zuordnung App-Bereich -> Tabelle (gleiche Namen wie in der Sicherungsdatei):
-- users->users, members->members, shareLots->share_lots, shareTransfers->share_transfers,
-- terminations->terminations, approvals->approvals, paymentConfirmations->payment_confirmations,
-- documents->documents, documentFiles->document_files, campaigns->campaigns, dividends->dividends,
-- settings->settings, customFields->custom_fields, workflowConfig->workflow_config,
-- auditLog->audit_log, meta->meta
