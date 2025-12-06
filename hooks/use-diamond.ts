'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

async function fetchDiamond(productId: number) {
  const response = await fetch(`/api/products/${productId}/diamond`);
  if (!response.ok) {
    if (response.status === 404) {
      return null; // Diamond not found is OK
    }
    throw new Error('Failed to fetch diamond');
  }
  return response.json();
}

async function updateDiamond(productId: number, data: any) {
  const response = await fetch(`/api/products/${productId}/diamond`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update diamond');
  }
  return response.json();
}

export function useDiamond(productId: number) {
  return useQuery({
    queryKey: ['diamond', productId],
    queryFn: () => fetchDiamond(productId),
    enabled: !!productId,
  });
}

export function useUpdateDiamond(productId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => updateDiamond(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diamond', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

