'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Promotion, CreatePromotionInput, UpdatePromotionInput } from '@/types/database';

const API_BASE = '/api/discounts';

async function fetchDiscounts(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  promo_type?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.promo_type) searchParams.set('promo_type', params.promo_type);

  const response = await fetch(`${API_BASE}?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch discounts');
  return response.json();
}

async function fetchDiscount(id: number) {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch discount');
  return response.json();
}

async function createDiscount(data: CreatePromotionInput) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create discount');
  }
  return response.json();
}

async function updateDiscount(data: UpdatePromotionInput) {
  const response = await fetch(`${API_BASE}/${data.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update discount');
  }
  return response.json();
}

async function deleteDiscount(id: number) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete discount');
  }
  return response.json();
}

export function useDiscounts(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  promo_type?: string;
}) {
  return useQuery({
    queryKey: ['discounts', params],
    queryFn: () => fetchDiscounts(params),
  });
}

export function useDiscount(id: number) {
  return useQuery({
    queryKey: ['discount', id],
    queryFn: () => fetchDiscount(id),
    enabled: !!id,
  });
}

export function useCreateDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDiscount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
  });
}

export function useUpdateDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDiscount,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discount', data.id] });
    },
  });
}

export function useDeleteDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDiscount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
  });
}

