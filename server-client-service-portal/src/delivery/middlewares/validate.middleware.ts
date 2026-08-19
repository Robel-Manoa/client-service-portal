import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";

// Turns a Zod schema into Express middleware, so every route validates its
// input the same way instead of each controller checking req.body by hand.
// Parses body/query/params together under one schema (see delivery/schemas)
// so a single object can validate more than just the body when a route
// needs to (e.g. an :id param). The "body." prefix stripped from
// error.path below exists because most schemas only ever validate
// req.body — without stripping it, every field-level error the frontend
// shows would read "body.title" instead of "title".
export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join(".").replace("body.", ""),
          message: err.message,
        }));

        res
          .status(400)
          .json({ error: "Invalid data", details: formattedErrors });
        return;
      }

      next(error);
    }
  };
};
