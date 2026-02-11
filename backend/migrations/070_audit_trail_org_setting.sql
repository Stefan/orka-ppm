-- Migration 070: Make audit trail for actuals/commitments configurable per organization.
-- When organizations.settings.audit.actuals_commitments is false, the audit_entity_change
-- trigger skips writing to audit_logs for actuals and commitments (improves import performance).
-- Default is true (audit on). UI: Settings → Organization → Compliance section.
-- Only org_admin / super_admin can change this setting.

CREATE OR REPLACE FUNCTION public.audit_entity_change()
RETURNS TRIGGER AS $$
DECLARE
  uid UUID;
  ent TEXT;
  oid UUID;
  audit_actuals_commitments TEXT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  ent := TG_TABLE_NAME;
  IF TG_OP = 'INSERT' THEN oid := NEW.organization_id; ELSIF TG_OP = 'DELETE' THEN oid := OLD.organization_id; ELSE oid := COALESCE(NEW.organization_id, OLD.organization_id); END IF;

  -- For actuals/commitments, respect org setting: audit.actuals_commitments = false → skip
  IF ent IN ('actuals', 'commitments') AND oid IS NOT NULL THEN
    SELECT COALESCE(settings->'audit'->>'actuals_commitments', 'true') INTO audit_actuals_commitments
    FROM public.organizations WHERE id = oid LIMIT 1;
    IF audit_actuals_commitments = 'false' THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, organization_id)
    VALUES (uid, 'CREATE', ent, NEW.id, NULL, left(to_jsonb(NEW)::text, 10000), oid);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, organization_id)
    VALUES (uid, 'UPDATE', ent, NEW.id, left(to_jsonb(OLD)::text, 10000), left(to_jsonb(NEW)::text, 10000), oid);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, organization_id)
    VALUES (uid, 'DELETE', ent, OLD.id, left(to_jsonb(OLD)::text, 10000), NULL, oid);
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.audit_entity_change() IS 'Writes to audit_logs on entity change. For actuals/commitments, skips when organizations.settings.audit.actuals_commitments is false.';
