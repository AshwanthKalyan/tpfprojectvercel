import { useAuth, useUser } from "@clerk/react";

export function useAuthedFetch() {
  const { getToken } = useAuth();
  const { user } = useUser();

  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(init.headers || {});
    const primaryEmail = user?.primaryEmailAddress?.emailAddress || null;

    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (primaryEmail && !headers.has("X-User-Email")) {
      headers.set("X-User-Email", primaryEmail);
    }

    return fetch(input, {
      ...init,
      credentials: "include",
      headers,
    });
  };
}
