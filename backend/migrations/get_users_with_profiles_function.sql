-- RPC function to efficiently join auth.users and user_profiles
-- This function provides complete user information by joining both tables

CREATE OR REPLACE FUNCTION get_users_with_profiles(
    page_num INTEGER DEFAULT 1,
    page_size INTEGER DEFAULT 20,
    search_email TEXT DEFAULT NULL,
    filter_active BOOLEAN DEFAULT NULL,
    filter_deactivated BOOLEAN DEFAULT NULL,
    filter_role TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    total_count INTEGER;
    offset_val INTEGER;
BEGIN
    -- Calculate offset
    offset_val := (page_num - 1) * page_size;
    
    -- Get total count with filters
    SELECT COUNT(*)
    INTO total_count
    FROM auth.users au
    LEFT JOIN user_profiles up ON au.id = up.user_id
    WHERE 
        (search_email IS NULL OR LOWER(au.email) LIKE '%' || LOWER(search_email) || '%')
        AND (filter_active IS NULL OR up.is_active = filter_active OR (up.is_active IS NULL AND filter_active = true))
        AND (filter_deactivated IS NULL OR (filter_deactivated = true AND up.deactivated_at IS NOT NULL) OR (filter_deactivated = false AND up.deactivated_at IS NULL))
        AND (filter_role IS NULL OR up.role = filter_role OR (up.role IS NULL AND filter_role = 'user'));
    
    -- Get paginated results with complete user data
    WITH paginated_users AS (
        SELECT 
            au.id as auth_id,
            au.email as auth_email,
            au.created_at as auth_created_at,
            au.updated_at as auth_updated_at,
            au.last_sign_in_at as auth_last_sign_in_at,
            au.email_confirmed_at as auth_email_confirmed_at,
            up.id as profile_id,
            up.user_id as profile_user_id,
            up.role as profile_role,
            up.is_active as profile_is_active,
            up.last_login as profile_last_login,
            up.deactivated_at as profile_deactivated_at,
            up.deactivated_by as profile_deactivated_by,
            up.deactivation_reason as profile_deactivation_reason,
            up.sso_provider as profile_sso_provider,
            up.sso_user_id as profile_sso_user_id,
            up.created_at as profile_created_at,
            up.updated_at as profile_updated_at
        FROM auth.users au
        LEFT JOIN user_profiles up ON au.id = up.user_id
        WHERE 
            (search_email IS NULL OR LOWER(au.email) LIKE '%' || LOWER(search_email) || '%')
            AND (filter_active IS NULL OR up.is_active = filter_active OR (up.is_active IS NULL AND filter_active = true))
            AND (filter_deactivated IS NULL OR (filter_deactivated = true AND up.deactivated_at IS NOT NULL) OR (filter_deactivated = false AND up.deactivated_at IS NULL))
            AND (filter_role IS NULL OR up.role = filter_role OR (up.role IS NULL AND filter_role = 'user'))
        ORDER BY au.created_at DESC
        LIMIT page_size
        OFFSET offset_val
    )
    SELECT json_build_object(
        'users', json_agg(
            json_build_object(
                'user_id', auth_id,
                'auth', json_build_object(
                    'id', auth_id,
                    'email', auth_email,
                    'created_at', auth_created_at,
                    'updated_at', auth_updated_at,
                    'last_sign_in_at', auth_last_sign_in_at,
                    'email_confirmed_at', auth_email_confirmed_at
                ),
                'profile', CASE 
                    WHEN profile_id IS NOT NULL THEN json_build_object(
                        'id', profile_id,
                        'user_id', profile_user_id,
                        'role', profile_role,
                        'is_active', profile_is_active,
                        'last_login', profile_last_login,
                        'deactivated_at', profile_deactivated_at,
                        'deactivated_by', profile_deactivated_by,
                        'deactivation_reason', profile_deactivation_reason,
                        'sso_provider', profile_sso_provider,
                        'sso_user_id', profile_sso_user_id,
                        'created_at', profile_created_at,
                        'updated_at', profile_updated_at
                    )
                    ELSE NULL
                END
            )
        ),
        'total_count', total_count,
        'page', page_num,
        'page_size', page_size,
        'total_pages', CEIL(total_count::FLOAT / page_size)
    )
    INTO result
    FROM paginated_users;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_with_profiles TO authenticated;

COMMENT ON FUNCTION get_users_with_profiles IS 'Efficiently joins auth.users and user_profiles with filtering and pagination support';