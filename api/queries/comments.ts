import { eq, desc } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";

export async function findCommentsByPost(postId: number) {
  const comments = await getDb()
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.postId, postId))
    .orderBy(desc(schema.comments.createdAt));

  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const allAuthors = [];
  for (const id of authorIds) {
    const user = await getDb().query.users.findFirst({
      where: eq(schema.users.id, id),
    });
    if (user) allAuthors.push(user);
  }
  
  const authorMap = new Map(allAuthors.map(a => [a.id, a]));
  
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
    with: { author: true },
  });
  return comment;
}
