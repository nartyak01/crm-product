'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, CreateCategoryInput, UpdateCategoryInput } from '@/types/database';

const API_BASE = '/api/categories';

async function fetchCategories(tree: boolean = false) {
  const url = tree ? `${API_BASE}?tree=true&brand_id=4` : `${API_BASE}?brand_id=4`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch categories');
  return response.json();
}

async function fetchCategory(id: number) {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch category');
  return response.json();
}

async function createCategory(data: CreateCategoryInput) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, brand_id: 4 }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create category');
  }
  return response.json();
}

async function updateCategory(data: UpdateCategoryInput) {
  const response = await fetch(`${API_BASE}/${data.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update category');
  }
  return response.json();
}

async function deleteCategory(id: number) {
  const response = await fetch(`${API_BASE}/${id}?brand_id=4`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete category');
  }
  return response.json();
}

export function useCategories(tree: boolean = false) {
  return useQuery({
    queryKey: ['categories', tree ? 'tree' : 'list'],
    queryFn: () => fetchCategories(tree),
  });
}

export function useCategory(id: number) {
  return useQuery({
    queryKey: ['category', id],
    queryFn: () => fetchCategory(id),
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

