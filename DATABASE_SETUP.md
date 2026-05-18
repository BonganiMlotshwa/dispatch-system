# Database Setup Guide

## Quick Setup for XAMPP

### Option 1: Using phpMyAdmin (Recommended)

1. **Start XAMPP**
   - Start Apache and MySQL services

2. **Open phpMyAdmin**
   - Go to `http://localhost/phpmyadmin`

3. **Import Schema**
   - Click on "Import" tab
   - Click "Choose File" and select `database_schema.sql`
   - Click "Go" at the bottom
   - Wait for success message

4. **Create Admin User**
   - Open your browser and go to: `http://localhost:8001/create_admin_user.php`
   - This will create the admin user with username: `admin` and password: `admin123`

### Option 2: Using MySQL Command Line

```bash
# Navigate to your project directory
cd path/to/your/project

# Login to MySQL
mysql -u root -p

# Run the schema file
source database_schema.sql

# Exit MySQL
exit
```

Then create the admin user by visiting: `http://localhost:8001/create_admin_user.php`

## Database Structure

### Tables Created:

1. **shipments** - Stores PO/shipment information
   - Supports multiple customers (MRP, OTB, OBSW)
   - Tracks manual vs XML entries
   - Stores style, color, order quantity

2. **cartons** - Stores individual carton data
   - Links to shipments via foreign key
   - Tracks status: pending → entered → exited
   - Records scan timestamps
   - Stores QC and finishing numbers

3. **users** - User authentication
   - Admin, user, and viewer roles
   - Account locking after failed login attempts
   - Password hashing for security

## Default Credentials

After running `create_admin_user.php`:
- **Username:** admin
- **Password:** admin123

⚠️ **Important:** Change the admin password after first login!

## Verification

To verify the database was created correctly:

1. Go to phpMyAdmin
2. Select `warehouse_tracking` database from the left sidebar
3. You should see 3 tables: `shipments`, `cartons`, `users`
4. Click on each table to verify the structure

## Troubleshooting

### Error: Database already exists
- If you get this error, the database already exists
- You can either:
  - Drop the existing database first (⚠️ This will delete all data!)
  - Or skip this step if your database is already set up

### Error: Table already exists
- This is normal if you're re-running the schema
- The `CREATE TABLE IF NOT EXISTS` statements will skip existing tables

### Cannot connect to database
- Check that MySQL is running in XAMPP
- Verify database credentials in `backend/config/database.php`
- Default credentials are usually:
  - Host: localhost
  - Username: root
  - Password: (empty)
  - Database: warehouse_tracking

## Migration from Old Database

If you have an existing database and need to add the new customer support fields:

Run the migration script:
```bash
php backend/migrate_customer_support.php
```

This will add:
- `customer` column to shipments table
- `style` column to shipments table
- `color` column to shipments table
- `order_qty` column to shipments table
- `entry_type` column to shipments table

## Next Steps

After database setup:

1. ✅ Database created
2. ✅ Admin user created
3. 🔄 Start the backend server: `php backend/start_server.php`
4. 🔄 Start the frontend: `cd frontend && npm start`
5. 🔄 Login with admin credentials
6. 🔄 Start using the system!

## Support

If you encounter any issues:
1. Check XAMPP error logs
2. Check browser console for errors
3. Verify all services are running
4. Check database connection settings
