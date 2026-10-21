import type { Place, PlanInput, PlanResponse } from "../types";

const API_ROOT = import.meta.env.VITE_API_URL ?? "/api";

async function decode<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "The request could not be completed.");
  }
  return payload as T;
}

export async function geocode(query: string, signal?: AbortSignal): Promise<Place[]> {
  const response = await fetch(`${API_ROOT}/geocode/?q=${encodeURIComponent(query)}`, { signal });
  const payload = await decode<{ results: Place[] }>(response);
  return payload.results;
}

export async function planRoutes(input: PlanInput): Promise<PlanResponse> {
  const response = await fetch(`${API_ROOT}/routes/plan/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return decode<PlanResponse>(response);
}

