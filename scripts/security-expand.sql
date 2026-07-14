-- Phase 1: additive security schema only. No foreign keys are added here.
-- Review this file and run it after a database and uploads backup.

DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_column_if_missing('users', 'deletedAt', 'TIMESTAMP NULL');
CALL add_column_if_missing('users', 'deletedBy', 'BIGINT UNSIGNED NULL');
CALL add_column_if_missing('users', 'deletionReason', 'VARCHAR(255) NULL');
CALL add_column_if_missing('audit_logs', 'actorPublicId', 'INT NULL');
CALL add_column_if_missing('audit_logs', 'actorRole', 'VARCHAR(32) NULL');
CALL add_column_if_missing('audit_logs', 'actorName', 'VARCHAR(255) NULL');

DROP PROCEDURE add_column_if_missing;

-- Existing installations may have createdBy as NOT NULL. SET NULL foreign keys require a nullable child column.
ALTER TABLE `admin_email_allowlist`
  MODIFY COLUMN `createdBy` BIGINT UNSIGNED NULL;

ALTER TABLE `verificationCodes`
  MODIFY COLUMN `purpose` ENUM(
    'register',
    'reset_password',
    'bind_email',
    'bind_email_old',
    'bind_email_new',
    'recovery_new_email'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS `uploaded_files` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `path` VARCHAR(255) NOT NULL,
  `uploaderUserId` BIGINT UNSIGNED NOT NULL,
  `purpose` ENUM('avatar', 'content') NOT NULL,
  `sizeBytes` INT UNSIGNED NOT NULL,
  `format` VARCHAR(16) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uploaded_files_path_unique` (`path`),
  KEY `uploaded_files_uploader_idx` (`uploaderUserId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_verification_challenges` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phoneHash` VARCHAR(128) NOT NULL,
  `purpose` VARCHAR(50) NOT NULL,
  `expiresAt` TIMESTAMP NOT NULL,
  `consumedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `sms_challenges_subject_idx` (`phoneHash`, `purpose`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `step_up_grants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenHash` VARCHAR(128) NOT NULL,
  `userId` BIGINT UNSIGNED NOT NULL,
  `action` ENUM('bind_email', 'bind_phone', 'recovery_codes') NOT NULL,
  `targetHash` VARCHAR(128) NOT NULL,
  `method` ENUM('password', 'email', 'phone') NOT NULL,
  `expiresAt` TIMESTAMP NOT NULL,
  `consumedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `step_up_grants_token_unique` (`tokenHash`),
  KEY `step_up_grants_user_idx` (`userId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recovery_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId` BIGINT UNSIGNED NOT NULL,
  `codeHash` VARCHAR(128) NOT NULL,
  `consumedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `recovery_codes_hash_unique` (`codeHash`),
  KEY `recovery_codes_user_idx` (`userId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_recovery_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId` BIGINT UNSIGNED NOT NULL,
  `contactType` ENUM('email', 'phone') NOT NULL,
  `newContactHash` VARCHAR(128) NOT NULL,
  `newContactEncrypted` TEXT NOT NULL,
  `status` ENUM('pending', 'initial_approved', 'final_approved', 'rejected', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
  `evidence` JSON NULL,
  `availableAt` TIMESTAMP NOT NULL,
  `cancelTokenHash` VARCHAR(128) NOT NULL,
  `rejectReason` VARCHAR(255) NULL,
  `completedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (now()),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_recovery_cancel_token_unique` (`cancelTokenHash`),
  KEY `account_recovery_user_status_idx` (`userId`, `status`, `createdAt`),
  KEY `account_recovery_available_idx` (`status`, `availableAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_recovery_reviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `requestId` BIGINT UNSIGNED NOT NULL,
  `reviewerId` BIGINT UNSIGNED NOT NULL,
  `stage` ENUM('initial', 'final') NOT NULL,
  `decision` ENUM('approve', 'reject') NOT NULL,
  `reason` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_recovery_review_stage_unique` (`requestId`, `stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recovery_completion_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `requestId` BIGINT UNSIGNED NOT NULL,
  `tokenHash` VARCHAR(128) NOT NULL,
  `expiresAt` TIMESTAMP NOT NULL,
  `consumedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `recovery_completion_request_unique` (`requestId`),
  UNIQUE KEY `recovery_completion_token_unique` (`tokenHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_outbox` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel` ENUM('email', 'sms') NOT NULL,
  `destinationEncrypted` TEXT NOT NULL,
  `template` VARCHAR(80) NOT NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('pending', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `availableAt` TIMESTAMP NOT NULL DEFAULT (now()),
  `lockedAt` TIMESTAMP NULL,
  `lastError` VARCHAR(500) NULL,
  `sentAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `notification_outbox_pending_idx` (`status`, `availableAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `integrity_orphan_archive` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sourceTable` VARCHAR(64) NOT NULL,
  `sourceId` VARCHAR(64) NOT NULL,
  `reason` VARCHAR(120) NOT NULL,
  `payload` JSON NOT NULL,
  `archivedAt` TIMESTAMP NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `integrity_orphan_source_unique` (`sourceTable`, `sourceId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
