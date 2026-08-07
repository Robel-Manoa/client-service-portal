import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";

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
