-- Defence in depth for business rules 1, 4 and 5 and for append-only notes.
-- The service layer checks these first and returns friendly API errors; the
-- triggers guarantee the database itself can never hold an illegal history,
-- even under concurrent writes or a bug in application code.
--
-- Custom SQLSTATEs (class "RD") let the application map trigger refusals to
-- API error codes:
--   RD001 illegal status transition       RD002 details locked after decision
--   RD003 removed request is read-only    RD004 append-only table
--   RD005 hard delete forbidden           RD006 decision is final

CREATE OR REPLACE FUNCTION return_requests_guard_update() RETURNS trigger AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Request % has been removed and cannot be changed', OLD.reference
      USING ERRCODE = 'RD003';
  END IF;

  IF NEW.reference IS DISTINCT FROM OLD.reference OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Reference and creation time are immutable' USING ERRCODE = 'RD002';
  END IF;

  -- Rule 1: only the documented lifecycle transitions are legal.
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'OPEN'      AND NEW.status = 'IN_REVIEW')
    OR (OLD.status = 'IN_REVIEW' AND NEW.status IN ('APPROVED', 'REJECTED'))
    OR (OLD.status = 'APPROVED'  AND NEW.status = 'COMPLETED')
  ) THEN
    RAISE EXCEPTION 'Illegal status transition % -> %', OLD.status, NEW.status
      USING ERRCODE = 'RD001';
  END IF;

  -- Rule 4: customer and item details are locked once a request is decided.
  IF OLD.status IN ('APPROVED', 'REJECTED', 'COMPLETED') AND (
       NEW.customer_name  IS DISTINCT FROM OLD.customer_name
    OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
    OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
    OR NEW.order_id       IS DISTINCT FROM OLD.order_id
    OR NEW.item_sku       IS DISTINCT FROM OLD.item_sku
    OR NEW.item_name      IS DISTINCT FROM OLD.item_name
    OR NEW.quantity       IS DISTINCT FROM OLD.quantity
    OR NEW.reason         IS DISTINCT FROM OLD.reason
  ) THEN
    RAISE EXCEPTION 'Request % is decided; customer and item details are locked', OLD.reference
      USING ERRCODE = 'RD002';
  END IF;

  -- A recorded decision (resolution / refund amount) cannot be rewritten later.
  IF OLD.status IN ('APPROVED', 'COMPLETED') AND (
       NEW.resolution    IS DISTINCT FROM OLD.resolution
    OR NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
  ) THEN
    RAISE EXCEPTION 'The resolution of request % is final', OLD.reference
      USING ERRCODE = 'RD006';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER return_requests_guard_update
  BEFORE UPDATE ON return_requests
  FOR EACH ROW EXECUTE FUNCTION return_requests_guard_update();
--> statement-breakpoint
-- Rule 5: removal is a soft delete. Physical deletes are refused outright.
CREATE OR REPLACE FUNCTION forbid_hard_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Rows in % are never physically deleted; use soft deletion', TG_TABLE_NAME
    USING ERRCODE = 'RD005';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER return_requests_forbid_delete
  BEFORE DELETE ON return_requests
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
-- Notes and audit events are append-only: never edited, never deleted.
CREATE OR REPLACE FUNCTION forbid_append_only_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; rows cannot be %', TG_TABLE_NAME, lower(TG_OP) || 'd'
    USING ERRCODE = 'RD004';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER notes_append_only
  BEFORE UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION forbid_append_only_change();
--> statement-breakpoint
CREATE TRIGGER request_events_append_only
  BEFORE UPDATE OR DELETE ON request_events
  FOR EACH ROW EXECUTE FUNCTION forbid_append_only_change();
