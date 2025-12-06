'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Product, CreateProductInput, UpdateProductInput } from '@/types/database';

const API_BASE = '/api/products';

async function fetchProducts(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  product_type?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.product_type) searchParams.set('product_type', params.product_type);

  const response = await fetch(`${API_BASE}?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch products');
  return response.json();
}

async function fetchProduct(id: number) {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch product');
  return response.json();
}

async function createProduct(data: CreateProductInput) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create product');
  }
  return response.json();
}

async function updateProduct(data: UpdateProductInput) {
  console.log('🔗 [Hook] updateProduct called:', data);
  
  const response = await fetch(`${API_BASE}/${data.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  console.log('📡 [Hook] API Response status:', response.status, response.statusText);
  
  if (!response.ok) {
    const error = await response.json();
    console.error('❌ [Hook] API Error response:', error);
    throw new Error(error.error || 'Failed to update product');
  }
  
  const result = await response.json();
  console.log('✅ [Hook] Product updated successfully:', result);
  return result;
}

async function deleteProduct(id: number) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete product');
  }
  return response.json();
}

export function useProducts(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  product_type?: string;
}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => fetchProducts(params),
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', data.id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

