# User Synchronization Quick Reference

## 🚀 Quick Start

### Check Current Status
```bash
cd backend
python user_sync_cli.py status
```

### Run Synchronization
```bash
# Preview changes (recommended first)
python user_sync_cli.py sync --dry-run

# Apply changes
python user_sync_cli.py sync
```

### Verify Migration
```bash
python user_management_migration_cli.py verify
```

## 📋 Common Commands

| Task | Command | Description |
|------|---------|-------------|
| Check sync status | `python user_sync_cli.py status` | Shows current synchronization statistics |
| Preview sync | `python user_sync_cli.py sync --dry-run` | Shows what would be synchronized without making changes |
| Run sync | `python user_sync_cli.py sync` | Synchronizes missing user profiles |
| Verbose output | `python user_sync_cli.py sync --verbose` | Shows detailed operation information |
| JSON output | `python user_sync_cli.py status --json` | Returns results in JSON format |
| Create single profile | `python user_sync_cli.py create-profile <user_id>` | Creates profile for specific user |
| Verify migration | `python user_management_migration_cli.py verify` | Checks migration status |
| Test system | `python user_management_migration_cli.py test` | Runs end-to-end tests |

## 🔧 Troubleshooting Commands

### Problem: Users can't access the application after signup

```bash
# 1. Check if profiles are missing
python user_sync_cli.py status

# 2. If missing profiles > 0, run sync
python user_sync_cli.py sync
```

### Problem: New users don't get profiles automatically

```bash
# 1. Verify migration is applied
python user_management_migration_cli.py verify

# 2. If verification fails, check database triggers
# In your database console:
# SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
```

### Problem: Sync fails with permission errors

```bash
# 1. Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# 2. Test database connection
python -c "from config.database import supabase; print('Connected' if supabase else 'Failed')"
```

## 📊 Status Interpretation

### Sync Status Output
```
=== User Synchronization Status ===
Total Auth Users:     150
Total User Profiles:  145
Missing Profiles:     5
Sync Percentage:      96.67%
```

- **Total Auth Users**: Users who can authenticate
- **Total User Profiles**: Users who can access the application
- **Missing Profiles**: Users who need synchronization
- **Sync Percentage**: Health indicator (should be 100%)

### Sync Summary Output
```
=== Synchronization Summary ===
Timestamp:            2026-01-08T10:30:00Z
Total Auth Users:     150
Existing Profiles:    145
Profiles Created:     5
Failed Creations:     0
Success Rate:         100%
Execution Time:       2.34 seconds
```

## 🚨 Emergency Procedures

### If sync completely fails:

1. **Check database connectivity**:
   ```bash
   python -c "from config.database import service_supabase; print(service_supabase.table('auth.users').select('id', count='exact').execute())"
   ```

2. **Manual profile creation** (for critical users):
   ```bash
   python user_sync_cli.py create-profile <user_id> --role admin
   ```

3. **Rollback migration** (last resort):
   ```bash
   python user_management_migration_cli.py rollback
   ```

### If automatic profile creation stops working:

1. **Re-apply migration**:
   ```bash
   python apply_user_management_migration_direct.py
   ```

2. **Verify trigger exists**:
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE trigger_name = 'on_auth_user_created';
   ```

## 🔍 Health Check URLs

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Basic application health | `{"status": "healthy"}` |
| `/admin/users/health-check` | User management health | User system status |
| `/dashboard/health-check` | Dashboard health | Dashboard status |

## 📝 Log Locations

- **Sync logs**: Console output (use `--verbose` for details)
- **Application logs**: `backend/backend.log`
- **Database logs**: Supabase dashboard → Logs

## 🔐 Security Notes

- Always use `SUPABASE_SERVICE_ROLE_KEY` for sync operations
- Never run sync commands with `--no-preserve` in production
- Verify user permissions before running admin commands
- Keep sync logs secure (they may contain user IDs)

## 📞 Support

If you encounter issues not covered here:

1. Check the full documentation: [USER_SYNCHRONIZATION.md](./USER_SYNCHRONIZATION.md)
2. Review application logs
3. Check Supabase dashboard for database errors
4. Contact system administrator

---

**Quick Reference Version**: 1.0.0  
**Last Updated**: January 2026