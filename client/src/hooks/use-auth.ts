import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useEffect } from "react";
import type { User } from "@shared/models/auth";
import { useAuthedFetch } from "@/lib/authed-fetch";

export function useAuth() {

  const { isLoaded, isSignedIn } = useClerkAuth();
  const authedFetch = useAuthedFetch();

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoaded || isSignedIn) {
      return;
    }

    queryClient.setQueryData(["/api/me"], null);
  }, [isLoaded, isSignedIn, queryClient]);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const response = await authedFetch("/api/me");

      if (response.status === 401 || response.status === 403) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: isLoaded && isSignedIn,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await authedFetch("/api/logout", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/me"], null);
    },
  });

  return {
    user,
    isLoading: !isLoaded || isLoading,
    isAuthenticated: !!isSignedIn,
    isClerkLoaded: isLoaded,
    isClerkSignedIn: !!isSignedIn,
    hasProfile: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
