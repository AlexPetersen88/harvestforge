const BASE_URL = import.meta.env.VITE_API_URL || "/v1";

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body: any) { return this.request<T>(path, { method: "POST", body: JSON.stringify(body) }); }
  patch<T>(path: string, body: any) { return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) }); }
  put<T>(path: string, body: any) { return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) }); }
  delete<T>(path: string) { return this.request<T>(path, { method: "DELETE" }); }
}

export const api = new ApiClient();
