-- GitHub Integration Database Schema
-- Migration: 001_github_integration
-- Created: 2026-01-23
-- Description: Adds tables for GitHub OAuth, reconstruction jobs, and webhook tracking

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  github_username VARCHAR(255) UNIQUE NOT NULL,
  github_id INT UNIQUE NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_github_username (github_username),
  INDEX idx_github_id (github_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GitHub tokens (encrypted)
CREATE TABLE IF NOT EXISTS github_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  encrypted_token TEXT NOT NULL,
  scope TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reconstruction job tracking
CREATE TABLE IF NOT EXISTS reconstruction_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unique_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT,
  email VARCHAR(255),
  recon_type ENUM('holocene_da', 'temp12k') NOT NULL,
  execution_mode ENUM('github_actions', 'traditional') NOT NULL,
  github_repo_name VARCHAR(255),
  github_repo_url TEXT,
  workflow_run_id BIGINT,
  workflow_status ENUM('pending', 'queued', 'in_progress', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  config_json LONGTEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  INDEX idx_unique_id (unique_id),
  INDEX idx_workflow_status (workflow_status),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook events log
CREATE TABLE IF NOT EXISTS webhook_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT,
  event_type VARCHAR(100) NOT NULL,
  workflow_run_id BIGINT,
  payload JSON,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES reconstruction_jobs(id) ON DELETE CASCADE,
  INDEX idx_job_id (job_id),
  INDEX idx_workflow_run_id (workflow_run_id),
  INDEX idx_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
