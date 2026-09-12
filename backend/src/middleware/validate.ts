import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Server-side input validation. Every mutating endpoint and every
 * query-parameter filter runs through here, so the API never trusts a
 * client-side check. Parsed (and coerced) values replace the raw request
 * data, which also strips unknown keys before they reach a controller.
 *
 * `ZodTypeAny` rather than `AnyZodObject` so that schemas refined with
 * cross-field rules (e.g. `dueFrom <= dueTo`) are accepted too.
 */
export function validate(schema: {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = (await schema.query.parseAsync(req.query)) as Request['query'];
      }
      if (schema.params) {
        req.params = (await schema.params.parseAsync(req.params)) as Request['params'];
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(new ValidationError('Input validation failed', errorMessages));
      }
      next(error);
    }
  };
}
