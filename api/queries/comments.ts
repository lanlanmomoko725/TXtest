import { and, asc, desc, eq, gte, or } from "drizzle-orm";
import * as schema from "@db/schema";
import type { Comment } from "@db/schema";
import type { PublicUser } from "../lib/user-dto";
import { getDb } from "./connection";
import { findPublicUsersByIds } from "./users";

export type CommentWithAuthor = Comment & {
  author: PublicUser | null;
  replyToUser: PublicUser | null;
};

export type CommentThread = CommentWithAuthor & {
  replies: CommentWithAuthor[];
};

export function buildCommentThreads(comments: Comment[], authorMap: Map<number, PublicUser | null>): CommentThread[] {
  const roots: CommentThread[] = [];
  const repliesByParent = new Map<number, CommentWithAuthor[]>();

  for (const comment of comments) {
    const withAuthor: CommentWithAuthor = {
      ...comment,
      author: authorMap.get(comment.authorId) || null,
      replyToUser: comment.replyToUserId ? authorMap.get(comment.replyToUserId) || null : null,
    };

    if (comment.parentId) {
      const replies = repliesByParent.get(comment.parentId) ?? [];
      replies.push(withAuthor);
      repliesByParent.set(comment.parentId, replies);
    } else {
      roots.push({ ...withAuthor, replies: [] });
    }
  }

  roots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  for (const root of roots) {
    const replies = repliesByParent.get(root.id) ?? [];
    replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    root.replies = replies;
  }

  return roots;
}

export async function findCommentsByPost(postId: number) {
  const comments = await getDb()
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.postId, postId))
    .orderBy(asc(schema.comments.createdAt));

  const userIds = comments.flatMap((comment) => [
    comment.authorId,
    ...(comment.replyToUserId ? [comment.replyToUserId] : []),
  ]);
  const authorMap = await findPublicUsersByIds(userIds);

  return buildCommentThreads(comments, authorMap);
}

export async function findCommentById(id: number) {
  const rows = await getDb()
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.id, id))
    .limit(1);
  return rows.at(0) ?? null;
}

export async function createComment(data: {
  postId: number;
  authorId: number;
  content: string;
  replyToCommentId?: number;
}) {
  const recentDuplicate = await getDb()
    .select({ id: schema.comments.id })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.authorId, data.authorId),
        eq(schema.comments.content, data.content.trim()),
        gte(schema.comments.createdAt, new Date(Date.now() - 5 * 60 * 1000)),
      ),
    )
    .limit(1);
  if (recentDuplicate.length > 0) {
    throw new Error("请不要重复发布相同评论。");
  }

  let parentId: number | null = null;
  let replyToUserId: number | null = null;

  if (data.replyToCommentId) {
    const target = await findCommentById(data.replyToCommentId);
    if (!target || target.postId !== data.postId) {
      throw new Error("回复的评论不存在。");
    }

    if (target.parentId) {
      const root = await findCommentById(target.parentId);
      if (!root || root.postId !== data.postId) {
        throw new Error("回复的评论不存在。");
      }
      parentId = root.id;
      replyToUserId = target.authorId;
    } else {
      parentId = target.id;
      replyToUserId = null;
    }
  }

  const [{ id }] = await getDb()
    .insert(schema.comments)
    .values({
      postId: data.postId,
      authorId: data.authorId,
      parentId,
      replyToUserId,
      content: data.content.trim(),
    })
    .$returningId();

  const comment = await findCommentById(id);
  if (!comment) return null;
  const userIds = [comment.authorId, ...(comment.replyToUserId ? [comment.replyToUserId] : [])];
  const authorMap = await findPublicUsersByIds(userIds);
  return {
    ...comment,
    author: authorMap.get(comment.authorId) || null,
    replyToUser: comment.replyToUserId ? authorMap.get(comment.replyToUserId) || null : null,
  };
}

export async function deleteCommentThread(commentId: number) {
  const target = await findCommentById(commentId);
  if (!target) {
    throw new Error("评论不存在。");
  }

  await getDb().transaction(async (tx) => {
    if (target.parentId) {
      await tx.delete(schema.comments).where(eq(schema.comments.id, target.id));
    } else {
      await tx
        .delete(schema.comments)
        .where(or(eq(schema.comments.id, target.id), eq(schema.comments.parentId, target.id)));
    }
  });

  return target;
}

export async function countReplies(commentId: number) {
  const replies = await getDb()
    .select({ id: schema.comments.id })
    .from(schema.comments)
    .where(eq(schema.comments.parentId, commentId))
    .orderBy(desc(schema.comments.createdAt));
  return replies.length;
}
