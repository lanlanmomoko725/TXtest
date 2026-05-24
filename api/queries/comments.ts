import { eq, desc } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import { findPublicUsersByIds } from "./users";

export async function findCommentsByPost(postId: number) {
  const comments = await getDb()
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.postId, postId))
    .orderBy(desc(schema.comments.createdAt));

  const authorMap = await findPublicUsersByIds(comments.map((c) => c.authorId));
  
  return comments.map(comment => ({
    ...comment,
    author: authorMap.get(comment.authorId) || null,
  }));
}

export async function createComment(data: {
  postId: number;
  authorId: number;
  content: string;
}) {
  const [{ id }] = await getDb()
    .insert(schema.comments)
    .values({
      postId: data.postId,
      authorId: data.authorId,
      content: data.content,
    })
    .$returningId();

  const comment = await getDb().query.comments.findFirst({
    where: eq(schema.comments.id, id),
  });
  if (!comment) return null;
  const authorMap = await findPublicUsersByIds([comment.authorId]);
  return {
    ...comment,
    author: authorMap.get(comment.authorId) || null,
  };
}
