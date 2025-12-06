'use client';

import { useState, useEffect } from 'react';
import { Media } from '@/types/database';

interface MediaVideoProps {
  media: Media;
  className?: string;
  preload?: 'none' | 'metadata' | 'auto';
  controls?: boolean;
}

export function MediaVideo({ media, className, preload = 'metadata', controls = false }: MediaVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string>(media.file_url);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Try to load the video
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      setHasError(false);
    };
    video.onerror = async () => {
      // If public URL fails, try to get presigned URL
      console.log('🔄 [MediaVideo] Public URL failed, fetching presigned URL for:', media.file_name);
      try {
        const response = await fetch(`/api/media/${media.id}/url`);
        if (response.ok) {
          const { url } = await response.json();
          setVideoUrl(url);
          setHasError(false);
        } else {
          setHasError(true);
        }
      } catch (error) {
        console.error('❌ [MediaVideo] Failed to get presigned URL:', error);
        setHasError(true);
      }
    };
    video.src = media.file_url;
  }, [media.id, media.file_url, media.file_name]);

  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <span className="text-xs text-muted-foreground">Failed to load</span>
      </div>
    );
  }

  return (
    <video
      src={videoUrl}
      className={className}
      preload={preload}
      controls={controls}
      onError={async (e) => {
        // Fallback: try presigned URL on error
        if (videoUrl === media.file_url) {
          console.log('🔄 [MediaVideo] Video error, fetching presigned URL for:', media.file_name);
          try {
            const response = await fetch(`/api/media/${media.id}/url`);
            if (response.ok) {
              const { url } = await response.json();
              setVideoUrl(url);
              (e.target as HTMLVideoElement).src = url;
            } else {
              setHasError(true);
            }
          } catch (error) {
            console.error('❌ [MediaVideo] Failed to get presigned URL:', error);
            setHasError(true);
          }
        } else {
          setHasError(true);
        }
      }}
    >
      Your browser does not support the video tag.
    </video>
  );
}

