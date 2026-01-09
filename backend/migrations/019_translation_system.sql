-- Translation System Migration
-- Creates tables for translation caching and analytics

-- Translation Cache Table
CREATE TABLE IF NOT EXISTS translation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(255) UNIQUE NOT NULL,
    original_content TEXT NOT NULL,
    translated_content TEXT NOT NULL,
    source_language VARCHAR(5) NOT NULL,
    target_language VARCHAR(5) NOT NULL,
    quality_score DECIMAL(3,2) DEFAULT 0.0,
    translation_time_ms INTEGER DEFAULT 0,
    confidence DECIMAL(3,2) DEFAULT 0.0,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translation Analytics Table
CREATE TABLE IF NOT EXISTS translation_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(255),
    source_language VARCHAR(5) NOT NULL,
    target_language VARCHAR(5) NOT NULL,
    content_type VARCHAR(50) DEFAULT 'general',
    content_length INTEGER DEFAULT 0,
    quality_score DECIMAL(3,2) DEFAULT 0.0,
    translation_time_ms INTEGER DEFAULT 0,
    cached BOOLEAN DEFAULT false,
    confidence DECIMAL(3,2) DEFAULT 0.0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Language Preferences (extend existing user_profiles table)
-- Add language preference to user_profiles.preferences JSON field
-- This will be handled by the translation service

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_translation_cache_request_id ON translation_cache(request_id);
CREATE INDEX IF NOT EXISTS idx_translation_cache_languages ON translation_cache(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_cache_cached_at ON translation_cache(cached_at);

CREATE INDEX IF NOT EXISTS idx_translation_analytics_languages ON translation_analytics(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_analytics_timestamp ON translation_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_translation_analytics_content_type ON translation_analytics(content_type);

-- RLS Policies for translation tables
ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_analytics ENABLE ROW LEVEL SECURITY;

-- Translation cache is accessible to all authenticated users (for shared translations)
CREATE POLICY "translation_cache_select_policy" ON translation_cache
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "translation_cache_insert_policy" ON translation_cache
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Translation analytics is accessible to authenticated users
CREATE POLICY "translation_analytics_select_policy" ON translation_analytics
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "translation_analytics_insert_policy" ON translation_analytics
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Function to clean up expired translation cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_translation_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM translation_cache 
    WHERE cached_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired cache entries (if pg_cron is available)
-- This would typically be set up separately in production
-- SELECT cron.schedule('cleanup-translation-cache', '0 2 * * *', 'SELECT cleanup_expired_translation_cache();');

COMMENT ON TABLE translation_cache IS 'Caches translated content to improve performance and reduce API costs';
COMMENT ON TABLE translation_analytics IS 'Tracks translation usage and quality metrics for system improvement';
COMMENT ON FUNCTION cleanup_expired_translation_cache() IS 'Removes expired translation cache entries older than 7 days';