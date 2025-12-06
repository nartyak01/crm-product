'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook for syncing category to Shopify
 */
export function useSyncCategoryToShopify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: number) => {
      const response = await fetch(`/api/categories/sync?category_id=${categoryId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync category to Shopify');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

/**
 * Hook for syncing metafield to Shopify
 */
export function useSyncMetafieldToShopify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ metafieldId, type, brandId = 4 }: { metafieldId?: number; type?: string; brandId?: number }) => {
      const params = new URLSearchParams();
      if (metafieldId) params.append('metafield_id', metafieldId.toString());
      if (type) params.append('type', type);
      params.append('brand_id', brandId.toString());

      const response = await fetch(`/api/metafields/sync?${params.toString()}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync metafield to Shopify');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metafields'] });
    },
  });
}

/**
 * Hook for syncing product to Shopify
 */
export function useSyncProductToShopify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: number) => {
      const response = await fetch(`/api/products/${productId}/sync`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync product to Shopify');
      }
      return response.json();
    },
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
}

/**
 * Hook for bulk syncing products to Shopify
 */
export function useBulkSyncProductsToShopify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productIds: number[]) => {
      const response = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: productIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to bulk sync products to Shopify');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

