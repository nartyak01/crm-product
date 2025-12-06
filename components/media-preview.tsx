'use client';

import { Media } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MediaImage } from './media-image';
import { MediaVideo } from './media-video';
import { Download, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MediaPreviewProps {
  media: Media;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaPreview({ media, open, onOpenChange }: MediaPreviewProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{media.file_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative bg-muted rounded-lg overflow-hidden">
            {media.media_type === 'image' ? (
              <MediaImage
                media={media}
                className="w-full h-auto max-h-[60vh] object-contain mx-auto"
                alt={media.file_name}
              />
            ) : (
              <MediaVideo
                media={media}
                controls
                className="w-full h-auto max-h-[60vh] mx-auto"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">File Name</p>
              <p className="font-medium">{media.file_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">File Size</p>
              <p className="font-medium">{formatFileSize(media.file_size)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium capitalize">{media.media_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">MIME Type</p>
              <p className="font-medium">{media.file_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Uploaded</p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(media.created_at), { addSuffix: true })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Path</p>
              <p className="font-medium text-xs break-all">{media.file_path}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(media.file_url, '_blank')}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


