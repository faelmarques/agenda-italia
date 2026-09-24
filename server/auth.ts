import type { Request, RequestHandler, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config.js";
import { ApiError } from "./errors.js";

const cookieName = "agenda_session";
const encoder = new TextEncoder();

export const setSessionCookie = (response: Response, token: string): void => {
  response.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.secureCookie,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

export const clearSessionCookie = (response: Response): void => {
  response.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.secureCookie,
    path: "/",
  });
};

export const createSessionToken = async (userId: string): Promise<string> =>
  new SignJWT({ role: "psychologist" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encoder.encode(config.sessionSecret));

const readToken = (request: Request): string | undefined => {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[cookieName];
};

export const authenticate: RequestHandler = async (request, response, next) => {
  const token = readToken(request);
  if (!token) {
    next();
    return;
  }

  try {
    const { payload } = await jwtVerify(token, encoder.encode(config.sessionSecret), {
      algorithms: ["HS256"],
    });

    if (payload.role !== "psychologist" || !payload.sub) {
      throw new Error("Invalid session payload");
    }

    request.auth = { userId: payload.sub };
    next();
  } catch {
    clearSessionCookie(response);
    next();
  }
};

export const requireAuth: RequestHandler = (request, _response, next) => {
  if (!request.auth) {
    next(new ApiError(401, "UNAUTHENTICATED", "Faça login para continuar."));
    return;
  }
  next();
};

export const requireSameOrigin: RequestHandler = (request, _response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  const origin = request.get("origin");
  if (!origin) {
    next();
    return;
  }

  const expectedOrigin = `${request.protocol}://${request.get("host")}`;
  if (origin !== expectedOrigin) {
    next(new ApiError(403, "INVALID_ORIGIN", "Origem da requisição não autorizada."));
    return;
  }

  next();
};
