'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook for syncing discount to Shopify
 */
export function useSyncDiscountToShopify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (discountId: number) => {
      const response = await fetch(`/api/discounts/${discountId}/sync`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync discount to Shopify');
      }
      return response.json();
    },
    onSuccess: (_, discountId) => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discount', discountId] });
    },
  });
}

