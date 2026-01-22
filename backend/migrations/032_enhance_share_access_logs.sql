-- Enhancement to share_access_logs table for comprehensive analytics
-- Adds user agent parsing fields and geolocation details

-- Add user agent parsing fields
ALTER TABLE share_access_logs 
ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
ADD COLUMN IF NOT EXISTS browser_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS os VARCHAR(100),
ADD COLUMN IF NOT EXISTS os_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_brand VARCHAR(100),
ADD COLUMN IF NOT EXISTS device_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;

-- Add additional geolocation fields
ALTER TABLE share_access_logs 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS region VARCHAR(100),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_share_access_logs_device_type ON share_access_logs(device_type);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_browser ON share_access_logs(browser);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_os ON share_access_logs(os);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_is_bot ON share_access_logs(is_bot) WHERE is_bot = true;

-- Add comments for new columns
COMMENT ON COLUMN share_access_logs.browser IS 'Browser name extracted from user agent';
COMMENT ON COLUMN share_access_logs.browser_version IS 'Browser version extracted from user agent';
COMMENT ON COLUMN share_access_logs.os IS 'Operating system name extracted from user agent';
COMMENT ON COLUMN share_access_logs.os_version IS 'Operating system version extracted from user agent';
COMMENT ON COLUMN share_access_logs.device_type IS 'Device type: Mobile, Tablet, Desktop, Bot, Unknown';
COMMENT ON COLUMN share_access_logs.device_brand IS 'Device brand (e.g., Apple, Samsung)';
COMMENT ON COLUMN share_access_logs.device_model IS 'Device model (e.g., iPhone 12, Galaxy S21)';
COMMENT ON COLUMN share_access_logs.is_bot IS 'Whether the access was from a bot/crawler';
COMMENT ON COLUMN share_access_logs.latitude IS 'Latitude coordinate from IP geolocation';
COMMENT ON COLUMN share_access_logs.longitude IS 'Longitude coordinate from IP geolocation';
COMMENT ON COLUMN share_access_logs.region IS 'Region/state from IP geolocation';
COMMENT ON COLUMN share_access_logs.timezone IS 'Timezone from IP geolocation';

-- Update table statistics
ANALYZE share_access_logs;

COMMIT;
