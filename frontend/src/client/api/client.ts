type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export function getApiBaseUrl(): string {
  if (!import.meta.env.PROD) return '/api/client';
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const base = (raw && raw.trim().length > 0 ? raw.trim() : "").replace(/\/+$/, "");
  return `${base}/api/client`;
}

export async function apiRequest<T>(
  path: string,
  options?: {
    method?: HttpMethod;
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const method = options?.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  let body: string | undefined;
  if (typeof options?.body !== "undefined") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    signal: options?.signal,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const message = (() => {
      if (payload && typeof payload === "object") {
        const data = payload as Record<string, unknown>;
        if (typeof data.error === "string" && data.error.trim()) return data.error;
        if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
        if (Array.isArray(data.detail)) return JSON.stringify(data.detail);
      }
      if (typeof payload === "string" && payload.trim()) return payload;
      return `HTTP ${res.status}`;
    })();
    throw new Error(message);
  }

  return payload as T;
}
