-- Migration: Add Hybrid Authentication Support
-- Adds columns to track GitHub App vs OAuth reconstructions

-- Add auth_type column to track authentication method
ALTER TABLE reconstruction_jobs
ADD COLUMN auth_type ENUM('oauth', 'github_app') NOT NULL DEFAULT 'github_app'
COMMENT 'Authentication method: oauth (personal) or github_app (anonymous)';

-- Add is_anonymous flag for easier queries
ALTER TABLE reconstruction_jobs
ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT TRUE
COMMENT 'TRUE for GitHub App (anonymous), FALSE for OAuth (personal)';

-- Add github_org for centralized reconstructions
ALTER TABLE reconstruction_jobs
ADD COLUMN github_org VARCHAR(255) DEFAULT NULL
COMMENT 'Organization name for GitHub App reconstructions';

-- Add index for filtering by auth type
CREATE INDEX idx_auth_type ON reconstruction_jobs(auth_type);

-- Add index for anonymous reconstructions
CREATE INDEX idx_is_anonymous ON reconstruction_jobs(is_anonymous);

-- Update existing records (if any) to use oauth auth type
-- This assumes existing records are all OAuth-based
UPDATE reconstruction_jobs
SET auth_type = 'oauth', is_anonymous = FALSE
WHERE auth_type = 'github_app';

-- Verification queries (run after migration)
-- SELECT COUNT(*) as github_app_count FROM reconstruction_jobs WHERE auth_type = 'github_app';
-- SELECT COUNT(*) as oauth_count FROM reconstruction_jobs WHERE auth_type = 'oauth';
-- SELECT COUNT(*) as anonymous_count FROM reconstruction_jobs WHERE is_anonymous = TRUE;
