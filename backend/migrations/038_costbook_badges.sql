-- Costbook Gamification Badges (Task 48)
-- Stores user badges for Costbook achievements.

CREATE TABLE IF NOT EXISTS costbook_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_type VARCHAR(64) NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criteria_met JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_costbook_badges_user_id ON costbook_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_costbook_badges_badge_type ON costbook_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_costbook_badges_earned_at ON costbook_badges(earned_at);

ALTER TABLE costbook_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY costbook_badges_select_own ON costbook_badges
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY costbook_badges_insert_own ON costbook_badges
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE costbook_badges IS 'Gamification badges for Costbook (Phase 3)';
