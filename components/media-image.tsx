'use client';

import { useState, useEffect } from 'react';
import { Media } from '@/types/database';

interface MediaImageProps {
  media: Media;
  className?: string;
  alt?: string;
}

export function MediaImage({ media, className, alt }: MediaImageProps) {
  // Use presigned_url if available, otherwise use file_url
  const [imageUrl, setImageUrl] = useState<string>(media.presigned_url || media.file_url);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Use presigned_url if available
    const urlToUse = media.presigned_url || media.file_url;
    setImageUrl(urlToUse);
    
    // Try to load the image
    const img = new Image();
    img.onload = () => {
      setIsLoading(false);
      setHasError(false);
    };
    img.onerror = async () => {
      // If presigned_url fails and we have file_url, try file_url
      if (urlToUse === media.presigned_url && media.file_url && media.file_url !== media.presigned_url) {
        console.log('🔄 [MediaImage] Presigned URL failed, trying file_url for:', media.file_name);
        setImageUrl(media.file_url);
        return;
      }
      // If both fail, try to get new presigned URL
      console.log('🔄 [MediaImage] Both URLs failed, fetching new presigned URL for:', media.file_name);
      try {
        const response = await fetch(`/api/media/${media.id}/url`);
        if (response.ok) {
          const { url } = await response.json();
          setImageUrl(url);
          setIsLoading(false);
          setHasError(false);
        } else {
          setHasError(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ [MediaImage] Failed to get presigned URL:', error);
        setHasError(true);
        setIsLoading(false);
      }
    };
    img.src = urlToUse;
  }, [media.id, media.file_url, media.presigned_url, media.file_name]);

  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <span className="text-xs text-muted-foreground">Failed to load</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt || media.file_name}
      className={className}
      loading="lazy"
      onError={async (e) => {
        // If presigned_url fails, try file_url
        if (imageUrl === media.presigned_url && media.file_url && media.file_url !== media.presigned_url) {
          console.log('🔄 [MediaImage] Presigned URL error, trying file_url for:', media.file_name);
          setImageUrl(media.file_url);
          (e.target as HTMLImageElement).src = media.file_url;
          return;
        }
        // If both fail, try to get new presigned URL
        console.log('🔄 [MediaImage] Image error, fetching new presigned URL for:', media.file_name);
        try {
          const response = await fetch(`/api/media/${media.id}/url`);
          if (response.ok) {
            const { url } = await response.json();
            setImageUrl(url);
            (e.target as HTMLImageElement).src = url;
          } else {
            setHasError(true);
          }
        } catch (error) {
          console.error('❌ [MediaImage] Failed to get presigned URL:', error);
          setHasError(true);
        }
      }}
    />
  );
}

