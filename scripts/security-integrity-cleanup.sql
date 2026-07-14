-- Phase 2: reviewed orphan cleanup. Run only after security-integrity-audit.sql and a backup.
START TRANSACTION;

INSERT INTO users (
  publicId, name, email, phoneHash, phoneEncrypted, password, avatar, role, level,
  emailVerified, phoneVerified, sessionVersion, deletedAt, deletionReason,
  createdAt, updatedAt, lastSignInAt
)
SELECT NULL, '已注销用户-完整性修复', NULL, NULL, NULL, NULL, NULL, 'user', 0,
  FALSE, FALSE, 1, NOW(), '历史孤儿关系占位账号', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = '已注销用户-完整性修复');

SET @orphan_user_id = (SELECT id FROM users WHERE name = '已注销用户-完整性修复' ORDER BY id LIMIT 1);

UPDATE posts c LEFT JOIN users p ON p.id = c.authorId
SET c.authorId = @orphan_user_id WHERE p.id IS NULL;
UPDATE activities c LEFT JOIN users p ON p.id = c.createdBy
SET c.createdBy = @orphan_user_id WHERE p.id IS NULL;
UPDATE comments c LEFT JOIN users p ON p.id = c.authorId
SET c.authorId = @orphan_user_id WHERE p.id IS NULL;
UPDATE audit_logs c LEFT JOIN users p ON p.id = c.userId
SET c.userId = @orphan_user_id,
    c.actorName = COALESCE(c.actorName, '历史未知操作者'),
    c.actorRole = COALESCE(c.actorRole, 'unknown')
WHERE p.id IS NULL;

INSERT IGNORE INTO integrity_orphan_archive (sourceTable, sourceId, reason, payload)
SELECT 'comments', CAST(c.id AS CHAR), 'missing post', JSON_OBJECT(
  'postId', c.postId, 'authorId', c.authorId, 'parentId', c.parentId,
  'replyToUserId', c.replyToUserId, 'content', c.content, 'status', c.status,
  'createdAt', c.createdAt
)
FROM comments c LEFT JOIN posts p ON p.id = c.postId WHERE p.id IS NULL;
DELETE c FROM comments c LEFT JOIN posts p ON p.id = c.postId WHERE p.id IS NULL;

UPDATE comments c LEFT JOIN comments p ON p.id = c.parentId
SET c.parentId = NULL, c.replyToUserId = NULL
WHERE c.parentId IS NOT NULL AND p.id IS NULL;
UPDATE comments c LEFT JOIN users p ON p.id = c.replyToUserId
SET c.replyToUserId = NULL WHERE c.replyToUserId IS NOT NULL AND p.id IS NULL;
UPDATE comments c LEFT JOIN users p ON p.id = c.reviewedBy
SET c.reviewedBy = NULL WHERE c.reviewedBy IS NOT NULL AND p.id IS NULL;
UPDATE profile_change_requests c LEFT JOIN users p ON p.id = c.reviewedBy
SET c.reviewedBy = NULL WHERE c.reviewedBy IS NOT NULL AND p.id IS NULL;
UPDATE admin_email_allowlist c LEFT JOIN users p ON p.id = c.createdBy
SET c.createdBy = NULL WHERE c.createdBy IS NOT NULL AND p.id IS NULL;
UPDATE admin_email_allowlist c LEFT JOIN users p ON p.id = c.usedBy
SET c.usedBy = NULL WHERE c.usedBy IS NOT NULL AND p.id IS NULL;
UPDATE security_events c LEFT JOIN users p ON p.id = c.userId
SET c.userId = NULL WHERE c.userId IS NOT NULL AND p.id IS NULL;
UPDATE users c LEFT JOIN users p ON p.id = c.deletedBy
SET c.deletedBy = NULL WHERE c.deletedBy IS NOT NULL AND p.id IS NULL;

DELETE c FROM sessions c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL;
DELETE c FROM post_likes c LEFT JOIN posts p ON p.id = c.postId WHERE p.id IS NULL;
DELETE c FROM post_likes c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL;
DELETE c FROM step_up_grants c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL;
DELETE c FROM recovery_codes c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL;

INSERT IGNORE INTO integrity_orphan_archive (sourceTable, sourceId, reason, payload)
SELECT 'profile_change_requests', CAST(c.id AS CHAR), 'missing user', JSON_OBJECT(
  'userId', c.userId, 'type', c.type, 'value', c.value, 'status', c.status, 'createdAt', c.createdAt
)
FROM profile_change_requests c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL;
DELETE c FROM profile_change_requests c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL;

INSERT IGNORE INTO integrity_orphan_archive (sourceTable, sourceId, reason, payload)
SELECT 'uploaded_files', CAST(c.id AS CHAR), 'missing uploader', JSON_OBJECT(
  'path', c.path, 'purpose', c.purpose, 'sizeBytes', c.sizeBytes, 'format', c.format
)
FROM uploaded_files c LEFT JOIN users p ON p.id = c.uploaderUserId WHERE p.id IS NULL;
DELETE c FROM uploaded_files c LEFT JOIN users p ON p.id = c.uploaderUserId WHERE p.id IS NULL;

INSERT IGNORE INTO integrity_orphan_archive (sourceTable, sourceId, reason, payload)
SELECT 'account_recovery_requests', CAST(c.id AS CHAR), 'missing user', JSON_OBJECT(
  'userId', c.userId, 'contactType', c.contactType, 'status', c.status, 'createdAt', c.createdAt
)
FROM account_recovery_requests c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL;
DELETE t FROM recovery_completion_tokens t
JOIN account_recovery_requests r ON r.id = t.requestId
LEFT JOIN users u ON u.id = r.userId WHERE u.id IS NULL;
DELETE v FROM account_recovery_reviews v
JOIN account_recovery_requests r ON r.id = v.requestId
LEFT JOIN users u ON u.id = r.userId WHERE u.id IS NULL;
DELETE r FROM account_recovery_requests r LEFT JOIN users u ON u.id = r.userId WHERE u.id IS NULL;
DELETE v FROM account_recovery_reviews v LEFT JOIN account_recovery_requests r ON r.id = v.requestId WHERE r.id IS NULL;
DELETE t FROM recovery_completion_tokens t LEFT JOIN account_recovery_requests r ON r.id = t.requestId WHERE r.id IS NULL;

UPDATE account_recovery_requests r
JOIN account_recovery_reviews v ON v.requestId = r.id
LEFT JOIN users u ON u.id = v.reviewerId
SET r.status = 'rejected', r.rejectReason = '历史审核人不存在', r.updatedAt = NOW()
WHERE u.id IS NULL AND r.status IN ('pending', 'initial_approved', 'final_approved');
DELETE v FROM account_recovery_reviews v LEFT JOIN users u ON u.id = v.reviewerId WHERE u.id IS NULL;

COMMIT;
