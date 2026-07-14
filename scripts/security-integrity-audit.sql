-- Read-only orphan audit. Every count must be zero before adding foreign keys.
SELECT 'sessions.userId' AS relation_name, COUNT(*) AS orphan_count
FROM sessions c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'posts.authorId', COUNT(*) FROM posts c LEFT JOIN users p ON p.id = c.authorId WHERE p.id IS NULL
UNION ALL SELECT 'activities.createdBy', COUNT(*) FROM activities c LEFT JOIN users p ON p.id = c.createdBy WHERE p.id IS NULL
UNION ALL SELECT 'post_likes.postId', COUNT(*) FROM post_likes c LEFT JOIN posts p ON p.id = c.postId WHERE p.id IS NULL
UNION ALL SELECT 'post_likes.userId', COUNT(*) FROM post_likes c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'comments.postId', COUNT(*) FROM comments c LEFT JOIN posts p ON p.id = c.postId WHERE p.id IS NULL
UNION ALL SELECT 'comments.authorId', COUNT(*) FROM comments c LEFT JOIN users p ON p.id = c.authorId WHERE p.id IS NULL
UNION ALL SELECT 'comments.parentId', COUNT(*) FROM comments c LEFT JOIN comments p ON p.id = c.parentId WHERE c.parentId IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'comments.replyToUserId', COUNT(*) FROM comments c LEFT JOIN users p ON p.id = c.replyToUserId WHERE c.replyToUserId IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'comments.reviewedBy', COUNT(*) FROM comments c LEFT JOIN users p ON p.id = c.reviewedBy WHERE c.reviewedBy IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'profile_change_requests.userId', COUNT(*) FROM profile_change_requests c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'profile_change_requests.reviewedBy', COUNT(*) FROM profile_change_requests c LEFT JOIN users p ON p.id = c.reviewedBy WHERE c.reviewedBy IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'admin_email_allowlist.createdBy', COUNT(*) FROM admin_email_allowlist c LEFT JOIN users p ON p.id = c.createdBy WHERE c.createdBy IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'admin_email_allowlist.usedBy', COUNT(*) FROM admin_email_allowlist c LEFT JOIN users p ON p.id = c.usedBy WHERE c.usedBy IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'audit_logs.userId', COUNT(*) FROM audit_logs c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'security_events.userId', COUNT(*) FROM security_events c LEFT JOIN users p ON p.id = c.userId WHERE c.userId IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'uploaded_files.uploaderUserId', COUNT(*) FROM uploaded_files c LEFT JOIN users p ON p.id = c.uploaderUserId WHERE p.id IS NULL
UNION ALL SELECT 'step_up_grants.userId', COUNT(*) FROM step_up_grants c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'recovery_codes.userId', COUNT(*) FROM recovery_codes c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'account_recovery_requests.userId', COUNT(*) FROM account_recovery_requests c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'account_recovery_reviews.requestId', COUNT(*) FROM account_recovery_reviews c LEFT JOIN account_recovery_requests p ON p.id = c.requestId WHERE p.id IS NULL
UNION ALL SELECT 'account_recovery_reviews.reviewerId', COUNT(*) FROM account_recovery_reviews c LEFT JOIN users p ON p.id = c.reviewerId WHERE p.id IS NULL
UNION ALL SELECT 'recovery_completion_tokens.requestId', COUNT(*) FROM recovery_completion_tokens c LEFT JOIN account_recovery_requests p ON p.id = c.requestId WHERE p.id IS NULL
UNION ALL SELECT 'users.deletedBy', COUNT(*) FROM users c LEFT JOIN users p ON p.id = c.deletedBy WHERE c.deletedBy IS NOT NULL AND p.id IS NULL;
