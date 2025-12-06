'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Media } from '@/types/database';

const API_BASE = '/api/media';

async function fetchMedia(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  media_type?: 'image' | 'video';
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.media_type) searchParams.set('media_type', params.media_type);

  const response = await fetch(`${API_BASE}?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch media');
  return response.json();
}

async function fetchMediaById(id: number) {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch media');
  return response.json();
}

async function uploadMedia(formData: FormData) {
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload media');
  }
  return response.json();
}

async function deleteMedia(id: number) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete media');
  }
  return response.json();
}

export function useMedia(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  media_type?: 'image' | 'video';
}) {
  return useQuery({
    queryKey: ['media', params],
    queryFn: () => fetchMedia(params),
  });
}

export function useMediaById(id: number) {
  return useQuery({
    queryKey: ['media', id],
    queryFn: () => fetchMediaById(id),
    enabled: !!id,
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: uploadMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
}


