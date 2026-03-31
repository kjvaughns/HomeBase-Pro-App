import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { useQueryClient } from "@tanstack/react-query";

export function useNotificationCount() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications", user?.id, "unread-count"],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };
      const response = await apiRequest("GET", `/api/notifications/${user.id}/unread-count`);
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id, "unread-count"] });
  }, [queryClient, user?.id]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return {
    count: data?.count || 0,
    refetch,
  };
}
