interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => ({}))) as { data?: T } & ApiErrorBody;
  if (!response.ok) {
    throw new ApiClientError(
      body.error?.message ?? "Não foi possível concluir a solicitação.",
      response.status,
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.details,
    );
  }

  return body.data as T;
};

export const toQueryString = (values: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};
