import { useQuery } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authed-fetch";

export function useMyApplications() {
  const authedFetch = useAuthedFetch();
  return useQuery({
    queryKey: ["my-applications"],
    queryFn: async () => {
      const res = await authedFetch("/api/my-applications");
      if (!res.ok) throw new Error("Failed to fetch your applications");
      return res.json();
    },
  });
}
