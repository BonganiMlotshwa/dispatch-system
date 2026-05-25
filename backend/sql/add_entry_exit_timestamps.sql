-- Separate entry and exit timestamps for cartons (manual entry + scanner)
ALTER TABLE cartons
  ADD COLUMN IF NOT EXISTS entry_timestamp DATETIME DEFAULT NULL COMMENT 'When carton entered warehouse' AFTER scan_timestamp,
  ADD COLUMN IF NOT EXISTS exit_timestamp DATETIME DEFAULT NULL COMMENT 'When carton exited warehouse' AFTER entry_timestamp;

-- Backfill from legacy scan_timestamp where possible
UPDATE cartons
SET entry_timestamp = scan_timestamp
WHERE entry_timestamp IS NULL
  AND status IN ('entered', 'exited')
  AND scan_timestamp IS NOT NULL;

UPDATE cartons
SET exit_timestamp = scan_timestamp
WHERE exit_timestamp IS NULL
  AND status = 'exited'
  AND scan_timestamp IS NOT NULL;
