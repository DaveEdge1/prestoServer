-- Migration: Convert reconstruction_jobs.recon_type from ENUM to VARCHAR
--
-- New reconstruction methods are added through presto/reconRegistry.json. With
-- an ENUM column, every new method also required a schema change; a plain
-- VARCHAR removes that hard blocker so registering a method can be a data-only
-- pull request. Existing values (holocene_da, temp12k, download, LMR, ...) are
-- preserved unchanged by the widening conversion.

USE lipdverse;

ALTER TABLE reconstruction_jobs
  MODIFY COLUMN recon_type VARCHAR(64) NOT NULL;

-- Verify the change
SHOW COLUMNS FROM reconstruction_jobs LIKE 'recon_type';
