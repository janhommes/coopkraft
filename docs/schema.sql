-- CoopKraft – SQL-Schema für den eigenen Server (MySQL 8 / MariaDB 10.5+)
-- Jede Tabelle entspricht einem Datenbereich der App. Die Datensätze werden
-- 1:1 als JSON in `data` abgelegt (gleiches Format wie die Sicherungsdatei), damit
-- REST-Schnittstelle und App ohne Umbau zusammenpassen. Häufig gesuchte Felder
-- sind zusätzlich als Spalten herausgezogen; das Backend füllt sie beim Speichern
-- aus `data` (Zuordnung in backend/src/Tables.php).
--
-- Das Backend führt diese Datei nach jeder Änderung automatisch aus. Deshalb nur
-- `CREATE TABLE IF NOT EXISTS` mit Indizes innerhalb der Tabellendefinition.
-- Änderungen an bestehenden Tabellen: backend/migrations/NNN_beschreibung.sql.
-- Bewusst ohne Fremdschlüssel: Wiederherstellen einer Sicherung ist so unabhängig
-- von der Reihenfolge, Löschketten erledigen die Services (z. B. deleteMember).

CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NULL,
  status VARCHAR(32) NULL,
  mitgliedsnummer INT NULL,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY members_nummer_uq (mitgliedsnummer),
  KEY members_email_idx (email),
  KEY members_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS share_lots (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  member_id VARCHAR(64) NULL,
  status VARCHAR(32) NULL,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY share_lots_member_idx (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS share_transfers (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS terminations (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  member_id VARCHAR(64) NULL,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY terminations_member_idx (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approvals (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_confirmations (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  member_id VARCHAR(64) NULL,
  visibility VARCHAR(32) NULL,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY documents_member_idx (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dateiinhalt binär (in der Sicherungsdatei als data-URL)
CREATE TABLE IF NOT EXISTS document_files (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  mime_type VARCHAR(255) NULL,
  content LONGBLOB NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dividends (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_fields (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NULL,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY users_email_idx (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  member_id VARCHAR(64) NULL,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY audit_log_member_idx (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Singletons: settings ('singleton', 'sso'), workflow_config ('singleton'), meta
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflow_config (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meta (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zuordnung App-Bereich -> Tabelle (gleiche Namen wie in der Sicherungsdatei):
-- users->users, members->members, shareLots->share_lots, shareTransfers->share_transfers,
-- terminations->terminations, approvals->approvals, paymentConfirmations->payment_confirmations,
-- documents->documents, documentFiles->document_files, campaigns->campaigns, dividends->dividends,
-- settings->settings, customFields->custom_fields, workflowConfig->workflow_config,
-- auditLog->audit_log, meta->meta
