import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  if (!request.path.startsWith("/api/")) {
    next();
    return;
  }

  next(new ApiError(404, "NOT_FOUND", "Recurso não encontrado."));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Revise os dados informados.",
        details: error.flatten(),
      },
    });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({
      error: { code: "INVALID_JSON", message: "O corpo da requisição não é um JSON válido." },
    });
    return;
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Ocorreu um erro inesperado. Tente novamente.",
    },
  });
};

export const asyncRoute = <T extends RequestHandler>(handler: T): RequestHandler =>
  (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
