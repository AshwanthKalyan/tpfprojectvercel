import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authed-fetch";

export function useMyApplications() {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["my-applications"],
    queryFn: async () => {
      const res = await authedFetch("/api/my-applications");
      if (!res.ok) throw new Error("Failed to fetch your applications");
      return res.json();
    },
    enabled: isLoaded && !!isSignedIn,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
