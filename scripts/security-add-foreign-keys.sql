-- Phase 3: add foreign keys after security-integrity-audit.sql reports zero orphans.
DROP PROCEDURE IF EXISTS add_fk_if_missing;
DELIMITER $$
CREATE PROCEDURE add_fk_if_missing(
  IN p_table VARCHAR(64),
  IN p_constraint VARCHAR(64),
  IN p_clause TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND CONSTRAINT_NAME = p_constraint
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ', p_clause);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_fk_if_missing('users', 'users_deletedBy_users_id_fk', 'ADD CONSTRAINT `users_deletedBy_users_id_fk` FOREIGN KEY (`deletedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('admin_email_allowlist', 'admin_allowlist_createdBy_users_id_fk', 'ADD CONSTRAINT `admin_allowlist_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('admin_email_allowlist', 'admin_allowlist_usedBy_users_id_fk', 'ADD CONSTRAINT `admin_allowlist_usedBy_users_id_fk` FOREIGN KEY (`usedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('sessions', 'sessions_userId_users_id_fk', 'ADD CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE');
CALL add_fk_if_missing('posts', 'posts_authorId_users_id_fk', 'ADD CONSTRAINT `posts_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
CALL add_fk_if_missing('activities', 'activities_createdBy_users_id_fk', 'ADD CONSTRAINT `activities_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
CALL add_fk_if_missing('post_likes', 'post_likes_postId_posts_id_fk', 'ADD CONSTRAINT `post_likes_postId_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE CASCADE');
CALL add_fk_if_missing('post_likes', 'post_likes_userId_users_id_fk', 'ADD CONSTRAINT `post_likes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE');
CALL add_fk_if_missing('comments', 'comments_postId_posts_id_fk', 'ADD CONSTRAINT `comments_postId_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE CASCADE');
CALL add_fk_if_missing('comments', 'comments_authorId_users_id_fk', 'ADD CONSTRAINT `comments_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
CALL add_fk_if_missing('comments', 'comments_parentId_comments_id_fk', 'ADD CONSTRAINT `comments_parentId_comments_id_fk` FOREIGN KEY (`parentId`) REFERENCES `comments` (`id`) ON DELETE CASCADE');
CALL add_fk_if_missing('comments', 'comments_replyToUserId_users_id_fk', 'ADD CONSTRAINT `comments_replyToUserId_users_id_fk` FOREIGN KEY (`replyToUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('comments', 'comments_reviewedBy_users_id_fk', 'ADD CONSTRAINT `comments_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('profile_change_requests', 'profile_changes_userId_users_id_fk', 'ADD CONSTRAINT `profile_changes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
CALL add_fk_if_missing('profile_change_requests', 'profile_changes_reviewedBy_users_id_fk', 'ADD CONSTRAINT `profile_changes_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('audit_logs', 'audit_logs_userId_users_id_fk', 'ADD CONSTRAINT `audit_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
CALL add_fk_if_missing('security_events', 'security_events_userId_users_id_fk', 'ADD CONSTRAINT `security_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('uploaded_files', 'uploaded_files_uploader_users_id_fk', 'ADD CONSTRAINT `uploaded_files_uploader_users_id_fk` FOREIGN KEY (`uploaderUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
CALL add_fk_if_missing('step_up_grants', 'step_up_grants_userId_users_id_fk', 'ADD CONSTRAINT `step_up_grants_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE');
CALL add_fk_if_missing('recovery_codes', 'recovery_codes_userId_users_id_fk', 'ADD CONSTRAINT `recovery_codes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE');
CALL add_fk_if_missing('account_recovery_requests', 'account_recovery_userId_users_id_fk', 'ADD CONSTRAINT `account_recovery_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
CALL add_fk_if_missing('account_recovery_reviews', 'account_recovery_reviews_request_fk', 'ADD CONSTRAINT `account_recovery_reviews_request_fk` FOREIGN KEY (`requestId`) REFERENCES `account_recovery_requests` (`id`) ON DELETE CASCADE');
CALL add_fk_if_missing('account_recovery_reviews', 'account_recovery_reviews_reviewer_fk', 'ADD CONSTRAINT `account_recovery_reviews_reviewer_fk` FOREIGN KEY (`reviewerId`) REFERENCES `users` (`id`) ON DELETE RESTRICT');
CALL add_fk_if_missing('recovery_completion_tokens', 'recovery_completion_request_fk', 'ADD CONSTRAINT `recovery_completion_request_fk` FOREIGN KEY (`requestId`) REFERENCES `account_recovery_requests` (`id`) ON DELETE CASCADE');

DROP PROCEDURE add_fk_if_missing;
