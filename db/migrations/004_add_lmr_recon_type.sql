-- Migration: Add LMR reconstruction type
-- This migration adds 'LMR' to the recon_type ENUM in reconstruction_jobs table

USE lipdverse;

-- Add LMR to the recon_type enum
ALTER TABLE reconstruction_jobs
MODIFY COLUMN recon_type ENUM('holocene_da', 'temp12k', 'download', 'LMR') NOT NULL;

-- Verify the change
SHOW COLUMNS FROM reconstruction_jobs LIKE 'recon_type';
