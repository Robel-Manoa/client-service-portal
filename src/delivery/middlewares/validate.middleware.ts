// Création d'un middleware pour les validations de donnée grace à Zod
import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";

export const valides = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validation du corps
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Formatage des erreurs
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join(".").replace("body.", ""),
          message: err.message,
        }));

        res
          .status(400)
          .json({ error: "Données invalides", details: formattedErrors });
        return;
      }

      next(error);
    }
  };
};
