-- Migration 057: Extend organizations for SaaS tenant management (slug, logo_url, is_active, settings)
-- Spec: .kiro/specs/saas-tenant-management/requirements.md

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'slug') THEN
    ALTER TABLE organizations ADD COLUMN slug TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'logo_url') THEN
    ALTER TABLE organizations ADD COLUMN logo_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'is_active') THEN
    ALTER TABLE organizations ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'settings') THEN
    ALTER TABLE organizations ADD COLUMN settings JSONB DEFAULT '{}';
  END IF;
END $$;

COMMENT ON COLUMN organizations.slug IS 'Unique slug for subdomains/URLs';
COMMENT ON COLUMN organizations.logo_url IS 'Organization logo URL';
COMMENT ON COLUMN organizations.is_active IS 'false = tenant deactivated, no login/access';
COMMENT ON COLUMN organizations.settings IS 'Extensible: plan, limits, billing_id, etc.';
