'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMedia } from '@/hooks/use-media';
import { MediaUpload } from '@/components/media-upload';
import { MediaGallery } from '@/components/media-gallery';
import { Search, Image as ImageIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type ViewMode = 'grid' | 'list';

export default function MediaPage() {
  const [search, setSearch] = useState('');
  const [mediaType, setMediaType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading, refetch } = useMedia({
    search: search || undefined,
    media_type: mediaType !== 'all' ? (mediaType as 'image' | 'video') : undefined,
    limit,
    offset: page * limit,
  });

  const media = data?.media || [];
  const pagination = data?.pagination;

  const handleUploadComplete = () => {
    refetch();
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-3">
            <ImageIcon className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Media</h1>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload Media</CardTitle>
              <CardDescription>
                Upload images and videos to Vultr Object Storage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MediaUpload onUploadComplete={handleUploadComplete} />
            </CardContent>
          </Card>

          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search media files..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={mediaType}
              onValueChange={(value) => {
                setMediaType(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Media Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <>
              <MediaGallery
                media={media}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />

              {pagination && pagination.total > limit && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {page * limit + 1} to{' '}
                    {Math.min((page + 1) * limit, pagination.total)} of{' '}
                    {pagination.total} files
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!pagination.hasMore}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}


