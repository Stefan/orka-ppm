-- Migration 008: Feedback System Tables
-- Add comprehensive feedback and feature management system

-- Features table for feature requests
CREATE TABLE IF NOT EXISTS features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'in_development', 'completed', 'rejected')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  votes INTEGER DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  submitted_by UUID REFERENCES auth.users(id) NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Feature comments for discussions
CREATE TABLE IF NOT EXISTS feature_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature votes for upvote/downvote functionality
CREATE TABLE IF NOT EXISTS feature_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  vote_type VARCHAR(10) CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(feature_id, user_id)
);

-- Bugs table for bug reports
CREATE TABLE IF NOT EXISTS bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'confirmed', 'in_progress', 'resolved', 'closed', 'duplicate')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  severity VARCHAR(20) DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical', 'blocker')),
  category VARCHAR(50) DEFAULT 'functionality' CHECK (category IN ('ui', 'functionality', 'performance', 'security', 'data', 'integration')),
  submitted_by UUID REFERENCES auth.users(id) NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  duplicate_of UUID REFERENCES bugs(id),
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Bug attachments for file uploads
CREATE TABLE IF NOT EXISTS bug_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID REFERENCES bugs(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications for status changes
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  related_type VARCHAR(20),
  read BOOLEAN DEFAULT FALSE,
  sent_via_email BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);
CREATE INDEX IF NOT EXISTS idx_features_submitted_by ON features(submitted_by);
CREATE INDEX IF NOT EXISTS idx_features_votes ON features(votes DESC);
CREATE INDEX IF NOT EXISTS idx_features_created_at ON features(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_votes_feature_id ON feature_votes(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_votes_user_id ON feature_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_feature_comments_feature_id ON feature_comments(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_comments_created_at ON feature_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
CREATE INDEX IF NOT EXISTS idx_bugs_priority ON bugs(priority);
CREATE INDEX IF NOT EXISTS idx_bugs_submitted_by ON bugs(submitted_by);
CREATE INDEX IF NOT EXISTS idx_bugs_assigned_to ON bugs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bugs_created_at ON bugs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for features
CREATE POLICY "Users can view all features" ON features FOR SELECT USING (true);
CREATE POLICY "Users can create features" ON features FOR INSERT WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Users can update their own features" ON features FOR UPDATE USING (auth.uid() = submitted_by);
CREATE POLICY "Admins can manage all features" ON features FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
);

-- RLS Policies for feature comments
CREATE POLICY "Users can view all feature comments" ON feature_comments FOR SELECT USING (true);
CREATE POLICY "Users can create feature comments" ON feature_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON feature_comments FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for feature votes
CREATE POLICY "Users can view all feature votes" ON feature_votes FOR SELECT USING (true);
CREATE POLICY "Users can manage their own votes" ON feature_votes FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for bugs
CREATE POLICY "Users can view all bugs" ON bugs FOR SELECT USING (true);
CREATE POLICY "Users can create bugs" ON bugs FOR INSERT WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Users can update their own bugs" ON bugs FOR UPDATE USING (auth.uid() = submitted_by OR auth.uid() = assigned_to);
CREATE POLICY "Admins can manage all bugs" ON bugs FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
);

-- RLS Policies for bug attachments
CREATE POLICY "Users can view bug attachments" ON bug_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM bugs WHERE id = bug_id)
);
CREATE POLICY "Users can manage attachments for their bugs" ON bug_attachments FOR ALL USING (
  EXISTS (SELECT 1 FROM bugs WHERE id = bug_id AND (submitted_by = auth.uid() OR assigned_to = auth.uid()))
);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Functions for vote counting
CREATE OR REPLACE FUNCTION update_feature_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE features SET 
      upvotes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = NEW.feature_id AND vote_type = 'upvote'),
      downvotes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = NEW.feature_id AND vote_type = 'downvote'),
      votes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = NEW.feature_id)
    WHERE id = NEW.feature_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE features SET 
      upvotes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = OLD.feature_id AND vote_type = 'upvote'),
      downvotes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = OLD.feature_id AND vote_type = 'downvote'),
      votes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = OLD.feature_id)
    WHERE id = OLD.feature_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE features SET 
      upvotes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = NEW.feature_id AND vote_type = 'upvote'),
      downvotes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = NEW.feature_id AND vote_type = 'downvote'),
      votes = (SELECT COUNT(*) FROM feature_votes WHERE feature_id = NEW.feature_id)
    WHERE id = NEW.feature_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic vote counting
CREATE TRIGGER feature_vote_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON feature_votes
  FOR EACH ROW EXECUTE FUNCTION update_feature_vote_counts();

-- Function to create notifications for status changes
CREATE OR REPLACE FUNCTION create_status_change_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Feature status change notifications
  IF TG_TABLE_NAME = 'features' AND OLD.status != NEW.status THEN
    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
    VALUES (
      NEW.submitted_by,
      'feature_status_change',
      'Feature Status Updated',
      'Your feature request "' || NEW.title || '" status changed from ' || OLD.status || ' to ' || NEW.status,
      NEW.id,
      'feature'
    );
    
    -- Notify assigned user if different from submitter
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.submitted_by THEN
      INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
      VALUES (
        NEW.assigned_to,
        'assignment_change',
        'Feature Assigned',
        'You have been assigned to feature "' || NEW.title || '"',
        NEW.id,
        'feature'
      );
    END IF;
  END IF;
  
  -- Bug status change notifications
  IF TG_TABLE_NAME = 'bugs' AND OLD.status != NEW.status THEN
    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
    VALUES (
      NEW.submitted_by,
      'bug_status_change',
      'Bug Status Updated',
      'Your bug report "' || NEW.title || '" status changed from ' || OLD.status || ' to ' || NEW.status,
      NEW.id,
      'bug'
    );
    
    -- Notify assigned user if different from submitter
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.submitted_by THEN
      INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
      VALUES (
        NEW.assigned_to,
        'assignment_change',
        'Bug Assigned',
        'You have been assigned to bug "' || NEW.title || '"',
        NEW.id,
        'bug'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for status change notifications
CREATE TRIGGER feature_status_change_trigger
  AFTER UPDATE ON features
  FOR EACH ROW EXECUTE FUNCTION create_status_change_notification();

CREATE TRIGGER bug_status_change_trigger
  AFTER UPDATE ON bugs
  FOR EACH ROW EXECUTE FUNCTION create_status_change_notification();

-- Function to get feedback statistics
CREATE OR REPLACE FUNCTION get_feedback_statistics(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_features BIGINT,
  pending_features BIGINT,
  completed_features BIGINT,
  total_bugs BIGINT,
  open_bugs BIGINT,
  resolved_bugs BIGINT,
  total_votes BIGINT,
  active_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM features WHERE created_at >= NOW() - INTERVAL '1 day' * p_days) as total_features,
    (SELECT COUNT(*) FROM features WHERE status IN ('submitted', 'under_review', 'approved', 'in_development') AND created_at >= NOW() - INTERVAL '1 day' * p_days) as pending_features,
    (SELECT COUNT(*) FROM features WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '1 day' * p_days) as completed_features,
    (SELECT COUNT(*) FROM bugs WHERE created_at >= NOW() - INTERVAL '1 day' * p_days) as total_bugs,
    (SELECT COUNT(*) FROM bugs WHERE status IN ('submitted', 'confirmed', 'in_progress') AND created_at >= NOW() - INTERVAL '1 day' * p_days) as open_bugs,
    (SELECT COUNT(*) FROM bugs WHERE status IN ('resolved', 'closed') AND created_at >= NOW() - INTERVAL '1 day' * p_days) as resolved_bugs,
    (SELECT COUNT(*) FROM feature_votes WHERE created_at >= NOW() - INTERVAL '1 day' * p_days) as total_votes,
    (SELECT COUNT(DISTINCT user_id) FROM (
      SELECT submitted_by as user_id FROM features WHERE created_at >= NOW() - INTERVAL '1 day' * p_days
      UNION
      SELECT submitted_by as user_id FROM bugs WHERE created_at >= NOW() - INTERVAL '1 day' * p_days
      UNION
      SELECT user_id FROM feature_votes WHERE created_at >= NOW() - INTERVAL '1 day' * p_days
    ) active_users_subquery) as active_users;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE features IS 'Feature requests submitted by users with voting and status tracking';
COMMENT ON TABLE feature_comments IS 'Comments and discussions on feature requests';
COMMENT ON TABLE feature_votes IS 'User votes (upvote/downvote) on feature requests';
COMMENT ON TABLE bugs IS 'Bug reports with priority, severity, and assignment tracking';
COMMENT ON TABLE bug_attachments IS 'File attachments for bug reports (screenshots, logs, etc.)';
COMMENT ON TABLE notifications IS 'System notifications for status changes and assignments';

COMMENT ON COLUMN features.votes IS 'Total vote count (upvotes + downvotes)';
COMMENT ON COLUMN features.upvotes IS 'Number of upvotes';
COMMENT ON COLUMN features.downvotes IS 'Number of downvotes';
COMMENT ON COLUMN bugs.severity IS 'Technical impact level of the bug';
COMMENT ON COLUMN bugs.priority IS 'Business priority for fixing the bug';
COMMENT ON COLUMN notifications.sent_via_email IS 'Whether notification was sent via email';