'use client';

import { useState } from 'react';
import { Media } from '@/types/database';
import { Grid3x3, List, Trash2, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDeleteMedia } from '@/hooks/use-media';
import { MediaPreview } from './media-preview';
import { MediaImage } from './media-image';
import { MediaVideo } from './media-video';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface MediaGalleryProps {
  media: Media[];
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export function MediaGallery({ media, viewMode = 'grid', onViewModeChange }: MediaGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const deleteMutation = useDeleteMedia();

  const handleDelete = async (id: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete media');
    }
  };

  const handlePreview = (item: Media) => {
    setSelectedMedia(item);
    setPreviewOpen(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (media.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No media files found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange?.('grid')}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange?.('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {media.map((item) => (
            <Card key={item.id} className="group relative overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-square relative bg-muted">
                  {item.media_type === 'image' ? (
                    <MediaImage
                      media={item}
                      className="w-full h-full object-cover"
                      alt={item.file_name}
                    />
                  ) : (
                    <MediaVideo
                      media={item}
                      className="w-full h-full object-cover"
                      preload="metadata"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => handlePreview(item)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleDelete(item.id, item.file_name)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={item.file_name}>
                    {item.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(item.file_size)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {media.map((item) => (
            <Card key={item.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 flex-shrink-0 bg-muted rounded overflow-hidden">
                    {item.media_type === 'image' ? (
                      <MediaImage
                        media={item}
                        className="w-full h-full object-cover"
                        alt={item.file_name}
                      />
                    ) : (
                      <MediaVideo
                        media={item}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.file_name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatFileSize(item.file_size)}</span>
                      <span>•</span>
                      <span className="capitalize">{item.media_type}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handlePreview(item)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => window.open(item.file_url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(item.id, item.file_name)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedMedia && (
        <MediaPreview
          media={selectedMedia}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </>
  );
}


