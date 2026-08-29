-- =============================================
-- Migration 013 — SMS consent becomes optional
-- =============================================
--
-- Twilio's toll-free review (2026-08-28) required that a person be able to
-- complete the waitlist signup WITHOUT consenting to SMS. The landing page was
-- changed to allow that on 2026-08-28, but this table still had
-- `phone TEXT NOT NULL` and the API still rejected `consent !== true`, so the
-- compliant path failed server-side. The page invited a signup the backend
-- refused.
--
-- phone becomes nullable: an email-only signup is now legitimate.
-- Postgres treats NULLs as distinct in a unique index, so idx_waitlist_phone
-- keeps deduping real numbers while allowing many phone-less rows.
ALTER TABLE waitlist ALTER COLUMN phone DROP NOT NULL;

-- Per-type consent, matching the two opt-ins on the page and the two submitted
-- Twilio use cases (ACCOUNT_NOTIFICATIONS, CUSTOMER_CARE). sms_consent is kept
-- as the roll-up "did they agree to anything" flag that existing code reads.
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS consent_account BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS consent_care    BOOLEAN NOT NULL DEFAULT FALSE;

-- consent_at defaulted to NOW() for every row, which stamped a consent time on
-- people who never consented. It must be NULL unless consent was actually given.
ALTER TABLE waitlist ALTER COLUMN consent_at DROP DEFAULT;

-- Email-only signups have no phone to dedupe on. Dedupe those on email instead;
-- rows WITH a phone keep using idx_waitlist_phone.
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_nophone
  ON waitlist(lower(email)) WHERE phone IS NULL;
