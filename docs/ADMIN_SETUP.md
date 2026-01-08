# Admin Setup & User Management Documentation

## ⚠️ SECURITY NOTICE
**This documentation contains sensitive setup information. Do not expose this in production applications.**

## Overview
This document provides guidance for setting up and managing the admin user system in the PPM application.

## Security First Approach

### 🔒 Production Security Requirements
Before deploying to production, ensure you have completed the [Security Checklist](./SECURITY_CHECKLIST.md):
- Bootstrap endpoints are disabled (`DISABLE_BOOTSTRAP=true`)
- Development mode is disabled (`ENABLE_DEVELOPMENT_MODE=false`)
- Proper authentication is configured
- Database security is implemented
- All sensitive documentation is removed from the application

### 🚨 Never Expose in Production
The following should NEVER be accessible in production applications:
- Bootstrap endpoints
- Setup documentation links
- Development credentials
- Admin setup guides
- Security configuration details

## Initial Setup (First Time Deployment)

### Development Environment
The system automatically handles development scenarios:
- Default admin user is created automatically
- Mock data is provided when database tables don't exist
- No manual setup required for development

### Production Environment

#### Option 1: Database-First Setup (Recommended)
1. **Create Required Tables** in your Supabase database:
   ```sql
   -- User profiles table
   CREATE TABLE user_profiles (
     user_id UUID PRIMARY KEY,
     role TEXT NOT NULL DEFAULT 'viewer',
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     deactivated_at TIMESTAMP WITH TIME ZONE,
     deactivated_by UUID,
     deactivation_reason TEXT
   );

   -- User roles table (for advanced RBAC)
   CREATE TABLE user_roles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES user_profiles(user_id),
     role_id UUID,
     assigned_by UUID,
     assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Roles table
   CREATE TABLE roles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT UNIQUE NOT NULL,
     description TEXT,
     permissions JSONB,
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. **Insert First Admin User**:
   ```sql
   INSERT INTO user_profiles (user_id, role, is_active)
   VALUES ('your-supabase-auth-user-id', 'admin', true);
   ```

#### Option 2: Bootstrap Endpoint (Use with Caution)
**⚠️ SECURITY WARNING**: Only use in controlled environments

The bootstrap endpoint should be:
- Disabled in production
- Only accessible during initial setup
- Protected by environment variables
- Removed after first admin is created

## User Management Features

### Available Roles
- **admin**: Full system access, user management
- **portfolio_manager**: Portfolio and project management
- **project_manager**: Project-specific management
- **resource_manager**: Resource allocation and management
- **team_member**: Basic project participation
- **viewer**: Read-only access

### User Management Operations
- Create new users
- Assign/modify roles
- Activate/deactivate users
- View user activity logs
- Manage permissions

## Security Considerations

### Production Security Checklist
- [ ] Bootstrap endpoint disabled (`DISABLE_BOOTSTRAP=true`)
- [ ] Proper Supabase Auth integration
- [ ] JWT token validation enabled
- [ ] Admin documentation not exposed in app
- [ ] Database tables properly secured with RLS
- [ ] Audit logging enabled
- [ ] Regular security reviews

### Environment Variables
```bash
# Production settings
DISABLE_BOOTSTRAP=true
ENABLE_DEVELOPMENT_MODE=false
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

## Troubleshooting

### Common Issues
1. **No users exist**: Use database-first setup or bootstrap (development only)
2. **Permission denied**: Check user role assignments
3. **Database errors**: Verify table structure and RLS policies
4. **Authentication failures**: Check Supabase Auth configuration

### Development vs Production
| Feature | Development | Production |
|---------|-------------|------------|
| Bootstrap endpoint | ✅ Enabled | ❌ Disabled |
| Mock data | ✅ Available | ❌ Disabled |
| Auto-admin | ✅ Enabled | ❌ Disabled |
| JWT validation | ⚠️ Relaxed | ✅ Strict |

## Monitoring & Maintenance

### Admin Dashboard Features
- System performance metrics
- User activity monitoring
- Cache statistics
- Health checks
- Audit logs

### Regular Maintenance
- Review user permissions quarterly
- Monitor failed login attempts
- Update security policies
- Backup user data
- Review audit logs

## API Endpoints

### User Management
- `GET /admin/users/` - List all users
- `POST /admin/users/` - Create new user
- `PUT /admin/users/{id}` - Update user
- `DELETE /admin/users/{id}` - Delete user
- `POST /admin/users/{id}/deactivate` - Deactivate user

### System Administration
- `GET /admin/performance/stats` - Performance metrics
- `GET /admin/performance/health` - System health
- `GET /admin/cache/stats` - Cache statistics
- `GET /admin/audit/logs` - Audit logs

### ⚠️ Development Only
- `POST /admin/bootstrap/admin` - Bootstrap first admin (DISABLE IN PRODUCTION)

## Support & Documentation

For additional support:
1. Check application logs
2. Review Supabase dashboard
3. Consult API documentation at `/docs`
4. Contact system administrator

---
**Last Updated**: January 2026  
**Version**: 1.0.0