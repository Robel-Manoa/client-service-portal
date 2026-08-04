import { requestCommentDb } from "./database";
import { CommentVisibility, RequestComment } from "./types";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";

export class CommentService {
  private static formatComment(comment: RequestComment): RequestComment {
    return { ...comment, created_at: formatDate(comment.created_at) };
  }

  // List the comments on a request. includeInternal controls whether
  // internal comments (staff-only) are included.
  static async listForRequest(
    requestId: string,
    includeInternal: boolean,
  ): Promise<RequestComment[]> {
    return requestCommentDb
      .filter(
        (c) =>
          c.request_id === requestId &&
          (includeInternal || c.visibility === "public"),
      )
      .map(this.formatComment);
  }

  static async create(data: {
    request_id: string;
    author_id: string;
    body: string;
    visibility: CommentVisibility;
  }): Promise<RequestComment> {
    const newComment: RequestComment = {
      id: generateId(),
      request_id: data.request_id,
      author_id: data.author_id,
      body: data.body,
      visibility: data.visibility,
      created_at: new Date().toISOString(),
    };

    requestCommentDb.push(newComment);
    return this.formatComment(newComment);
  }
}
