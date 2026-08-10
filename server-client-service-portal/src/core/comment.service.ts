import { CommentVisibility, RequestComment } from "./types";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";
import type { CommentRepository } from "./ports";
import { commentRepository as defaultComments } from "./in-memory.repositories";

export class CommentService {
  private static formatComment(comment: RequestComment): RequestComment {
    return { ...comment, created_at: formatDate(comment.created_at) };
  }

  // includeInternal decides whether staff-only comments show up. That's an
  // authorization call, not a data-access one, which is why it's filtered
  // here and not baked into the repository query.
  static async listForRequest(
    requestId: string,
    includeInternal: boolean,
    comments: CommentRepository = defaultComments,
  ): Promise<RequestComment[]> {
    const all = await comments.findAllForRequest(requestId);
    return all
      .filter((c) => includeInternal || c.visibility === "public")
      .map(this.formatComment);
  }

  static async create(
    data: {
      request_id: string;
      author_id: string;
      body: string;
      visibility: CommentVisibility;
    },
    comments: CommentRepository = defaultComments,
  ): Promise<RequestComment> {
    const newComment: RequestComment = {
      id: generateId(),
      request_id: data.request_id,
      author_id: data.author_id,
      body: data.body,
      visibility: data.visibility,
      created_at: new Date().toISOString(),
    };

    await comments.insert(newComment);
    return this.formatComment(newComment);
  }
}
