# User Management System - Guide

## Overview

The User Management system allows administrators to create, edit, and manage user accounts with role-based access control.

---

## Access

**Location**: Click the ⚙️ **Settings** icon in the top-right header

**Permission**: **Admin-only** - Only users with the `admin` role can access this page

---

## Features

### 1. **User List**
- View all system users in a table
- See username, full name, email, role, status
- Track last login and account creation date
- Quick identification of your own account ("You" badge)

### 2. **Add New User**
Click the **"Add User"** button to create a new account:

**Required Fields:**
- Username (minimum 3 characters, unique)
- Password (minimum 6 characters)
- Confirm Password
- Role (Admin / User / Viewer)

**Optional Fields:**
- Full Name
- Email
- Active Status (checked by default)

**Roles Explained:**
- **Admin**: Full system access + user management
- **User**: Standard warehouse operations access
- **Viewer**: Read-only access (cannot modify data)

### 3. **Edit User**
Click the pencil icon (✏️) to modify user details:
- Update full name and email
- Change user role
- Activate or deactivate account

**Security:**
- You cannot remove your own admin privileges
- You cannot deactivate your own account

### 4. **Reset Password**
Click the key icon (🔑) to reset a user's password:
- Enter new password (minimum 6 characters)
- Confirm password
- User will need to use the new password on next login

### 5. **Toggle Active/Inactive**
Click the toggle icon to activate or deactivate accounts:
- 🟢 **Active**: User can log in
- ⚪ **Inactive**: User cannot log in (account locked)

Use this instead of deleting accounts to preserve audit trails.

### 6. **Delete User**
Click the trash icon (🗑️) to permanently delete a user:
- Confirmation required
- Cannot delete your own account
- **Warning**: This action cannot be undone

**Best Practice**: Use deactivate instead of delete to keep audit history.

### 7. **Audit Log**
Click **"Audit Log"** button to view user management history:
- Who created which account
- Role changes and modifications
- Password resets
- Account deletions
- IP address tracking
- Timestamps for all actions

**Shows last 50 actions** with color-coded badges:
- 🟢 **Create**: New user added
- 🔵 **Update**: User details changed
- 🟡 **Role Change**: Role modified
- 🟠 **Password Reset**: Password changed
- 🔴 **Delete**: User removed

---

## User Account Status Indicators

### Status Badges:
- 🟢 **Active**: Account is active and can log in
- ⚪ **Inactive**: Account deactivated by admin
- 🟡 **Locked**: Account temporarily locked (too many failed login attempts)

### Role Badges:
- 🔴 **ADMIN**: Full access
- 🔵 **USER**: Standard access
- ⚪ **VIEWER**: Read-only access

---

## Security Features

### Password Requirements:
- Minimum 6 characters
- Hashed using bcrypt (secure encryption)
- No password shown in plain text anywhere

### Account Protection:
- Cannot delete or deactivate your own account
- Cannot remove your own admin role
- All actions are logged in audit trail
- Failed login attempts tracked

### Audit Trail:
- Every user creation logged
- Every role change recorded
- Every password reset tracked
- IP addresses captured
- Admin username recorded for accountability

---

## Common Workflows

### Adding a New Employee:
1. Click **"Add User"** button
2. Enter username (e.g., employee name or ID)
3. Set temporary password
4. Enter full name and email
5. Select role based on their job:
   - Warehouse staff → **User**
   - Manager/supervisor → **Admin**
   - Auditors/reports only → **Viewer**
6. Click **"Create User"**
7. Share username and password with employee
8. Employee should change password on first login (future feature)

### When Employee Leaves:
**Option 1 (Recommended)**: Deactivate account
- Preserves audit history
- Can reactivate if they return
- Click toggle icon → Confirm

**Option 2**: Delete account
- Permanent removal
- Use only if absolutely necessary
- Click trash icon → Confirm

### Forgot Password Request:
1. Find user in list
2. Click key icon (🔑)
3. Enter new temporary password
4. Click **"Reset Password"**
5. Share new password with user

### Promoting User to Admin:
1. Click pencil icon (✏️) on user row
2. Change role from "User" to "Admin"
3. Click **"Save Changes"**
4. Action logged in audit trail

---

## Best Practices

### Security:
✅ Use strong, unique usernames
✅ Set strong initial passwords
✅ Review audit log regularly
✅ Deactivate unused accounts
✅ Limit number of admin accounts
✅ Don't share accounts between people

❌ Don't use simple passwords like "123456"
❌ Don't keep inactive employees active
❌ Don't share admin credentials

### User Management:
✅ Create accounts only when needed
✅ Assign appropriate roles (principle of least privilege)
✅ Keep full names and emails updated
✅ Document role changes (audit log does this automatically)
✅ Deactivate instead of delete when possible

---

## Troubleshooting

### "Admin access required" error:
- You're logged in as a non-admin user
- Contact your system administrator
- Only admins can access user management

### "Username already exists" error:
- Choose a different username
- Usernames must be unique across the system

### "Passwords do not match" error:
- Retype the password carefully
- Both fields must be identical

### "You cannot remove your own admin privileges" error:
- This is a safety feature
- Ask another admin to change your role if needed

### "You cannot deactivate your own account" error:
- This prevents lockout
- Ask another admin to deactivate your account if needed

---

## API Endpoints (Developer Reference)

**Base URL**: `backend/api/user_management.php`

**Actions:**
- `GET ?action=list` - List all users
- `GET ?action=audit_log&limit=50` - Get audit log
- `POST ?action=create` - Create new user
- `PUT ?action=update` - Update user details
- `PUT ?action=reset_password` - Reset user password
- `DELETE ?action=delete&user_id=X` - Delete user

**Authentication**: Requires active admin session

---

## Database Tables

### `users` table:
Stores user account information
- id, username, password (hashed)
- full_name, email
- role (admin/user/viewer)
- is_active, last_login
- failed_login_attempts, locked_until
- created_at, updated_at

### `user_audit_log` table:
Tracks all user management actions
- action_by_user_id, action_by_username
- action_type, target_user_id, target_username
- old_value, new_value (JSON)
- description, ip_address, created_at

---

## Support

For questions or issues:
1. Check this guide first
2. Review audit log for recent changes
3. Contact your system administrator
4. Check database logs if technical issues persist

---

**Remember**: With great admin power comes great responsibility! 🚀
