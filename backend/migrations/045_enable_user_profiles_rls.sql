-- Migration: Ensure RLS is enabled on user_profiles
-- Security: "Policy Exists RLS Disabled" – policies (e.g. authenticated_all_access) exist but RLS was not enabled.
-- This enables RLS; safe to run multiple times (idempotent).

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_profiles IS 'Extended user profile information; RLS enabled for policy enforcement';
