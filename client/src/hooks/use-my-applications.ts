import { useQuery } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authed-fetch";

export function useMyApplications() {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  return useQuery({
    queryKey: ["my-applications", user?.id ?? null],
    queryFn: async () => {
      const res = await authedFetch("/api/my-applications");
      if (!res.ok) throw new Error("Failed to fetch your applications");
      return res.json();
    },
    enabled: isLoaded && isUserLoaded && !!isSignedIn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}
