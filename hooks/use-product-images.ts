'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProductImage } from '@/types/database';

async function fetchProductImages(productId: number) {
  const response = await fetch(`/api/products/${productId}/images`);
  if (!response.ok) throw new Error('Failed to fetch product images');
  return response.json();
}

async function updateProductImages(
  productId: number,
  data: { thumbnail?: string; gallery?: string | string[] }
) {
  const response = await fetch(`/api/products/${productId}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update product images');
  }
  return response.json();
}

async function deleteProductImages(productId: number) {
  const response = await fetch(`/api/products/${productId}/images`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete product images');
  }
  return response.json();
}

export function useProductImages(productId: number) {
  return useQuery({
    queryKey: ['product-images', productId],
    queryFn: () => fetchProductImages(productId),
    enabled: !!productId,
  });
}

export function useUpdateProductImages(productId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { thumbnail?: string; gallery?: string | string[] }) =>
      updateProductImages(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
}

export function useDeleteProductImages(productId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => deleteProductImages(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
}

