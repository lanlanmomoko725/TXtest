-- Read-only checks that can run before the additive schema phase.
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
UNION ALL SELECT 'profile_change_requests.userId', COUNT(*) FROM profile_change_requests c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'audit_logs.userId', COUNT(*) FROM audit_logs c LEFT JOIN users p ON p.id = c.userId WHERE p.id IS NULL
UNION ALL SELECT 'security_events.userId', COUNT(*) FROM security_events c LEFT JOIN users p ON p.id = c.userId WHERE c.userId IS NOT NULL AND p.id IS NULL;
