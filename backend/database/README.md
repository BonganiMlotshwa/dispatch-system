# Database Migrations

Run tracked database updates after pulling new code:

```bash
php backend/database/migrate.php
```

The runner records applied migrations in `schema_migrations`, so each migration only runs once per database.

If you need to rerun the legacy one-off scripts manually, they still exist at the backend root, but the tracked runner is the preferred path.
