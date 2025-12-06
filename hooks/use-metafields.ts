'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ProductAttribute,
  CreateMetafieldInput,
  UpdateMetafieldInput,
} from '@/types/database';

const API_BASE = '/api/metafields';

async function fetchMetafields() {
  const response = await fetch(API_BASE);
  if (!response.ok) throw new Error('Failed to fetch metafields');
  return response.json();
}

async function fetchMetafield(id: number) {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch metafield');
  return response.json();
}

async function createMetafield(data: CreateMetafieldInput) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create metafield');
  }
  return response.json();
}

async function updateMetafield(data: UpdateMetafieldInput) {
  const response = await fetch(`${API_BASE}/${data.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update metafield');
  }
  return response.json();
}

async function deleteMetafield(id: number) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete metafield');
  }
  return response.json();
}

async function fetchProductMetafields(productId: number) {
  const response = await fetch(`/api/products/${productId}/metafields`);
  if (!response.ok) throw new Error('Failed to fetch product metafields');
  return response.json();
}

async function setProductMetafield(
  productId: number,
  attributeId: number,
  value: string,
  isVariantValue: boolean = false
) {
  const requestBody = {
    attribute_id: attributeId,
    value,
    is_variant_value: isVariantValue,
  };
  
  console.log('📤 [Hook] setProductMetafield - Request:', {
    productId,
    ...requestBody
  });
  
  const response = await fetch(`/api/products/${productId}/metafields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('❌ [Hook] setProductMetafield - Error response:', errorData);
    
    // Parse error message properly
    let errorMessage = 'Failed to set product metafield';
    if (typeof errorData.error === 'string') {
      errorMessage = errorData.error;
    } else if (errorData.error && typeof errorData.error === 'object') {
      // Handle ZodError format
      if (Array.isArray(errorData.details)) {
        errorMessage = errorData.error || `Validation failed: ${errorData.details.map((e: any) => `${e.path?.join('.')}: ${e.message}`).join(', ')}`;
      } else {
        errorMessage = JSON.stringify(errorData.error);
      }
    }
    
    throw new Error(errorMessage);
  }
  
  const result = await response.json();
  console.log('✅ [Hook] setProductMetafield - Success:', result);
  return result;
}

async function deleteProductMetafield(productId: number, attributeId: number) {
  const response = await fetch(
    `/api/products/${productId}/metafields?attribute_id=${attributeId}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete product metafield');
  }
  return response.json();
}

export function useMetafields() {
  return useQuery({
    queryKey: ['metafields'],
    queryFn: fetchMetafields,
  });
}

export function useMetafield(id: number) {
  return useQuery({
    queryKey: ['metafield', id],
    queryFn: () => fetchMetafield(id),
    enabled: !!id,
  });
}

export function useProductMetafields(productId: number) {
  return useQuery({
    queryKey: ['product-metafields', productId],
    queryFn: () => fetchProductMetafields(productId),
    enabled: !!productId,
  });
}

export function useCreateMetafield() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createMetafield,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metafields'] });
    },
  });
}

export function useUpdateMetafield() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateMetafield,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metafields'] });
    },
  });
}

export function useDeleteMetafield() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteMetafield,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metafields'] });
    },
  });
}

export function useSetProductMetafield(productId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ attributeId, value, isVariantValue }: {
      attributeId: number;
      value: string;
      isVariantValue?: boolean;
    }) => setProductMetafield(productId, attributeId, value, isVariantValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-metafields', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
}

export function useDeleteProductMetafield(productId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (attributeId: number) => deleteProductMetafield(productId, attributeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-metafields', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
}

