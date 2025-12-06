'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadMedia } from '@/hooks/use-media';
import { cn } from '@/lib/utils';

interface MediaUploadProps {
  onUploadComplete?: () => void;
}

export function MediaUpload({ onUploadComplete }: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const uploadMutation = useUploadMedia();

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      return isImage || isVideo;
    });

    if (validFiles.length === 0) {
      alert('Please select image or video files only.');
      return;
    }

    const fileNames = validFiles.map(f => f.name);
    setUploadingFiles(prev => [...prev, ...fileNames]);

    try {
      console.log('📤 [Media Upload Component] Starting upload of', validFiles.length, 'file(s)');
      
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        console.log(`📤 [Media Upload Component] Uploading file ${i + 1}/${validFiles.length}:`, {
          name: file.name,
          type: file.type,
          size: file.size,
          sizeMB: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        });
        
        const formData = new FormData();
        formData.append('file', file);
        
        const startTime = Date.now();
        const result = await uploadMutation.mutateAsync(formData);
        const uploadTime = Date.now() - startTime;
        
        console.log(`✅ [Media Upload Component] File ${i + 1} uploaded successfully in ${uploadTime}ms:`, {
          fileName: file.name,
          mediaId: result?.id,
          fileUrl: result?.file_url,
        });
      }
      
      console.log('✅ [Media Upload Component] All files uploaded successfully');
      onUploadComplete?.();
    } catch (error: any) {
      console.error('❌ [Media Upload Component] Upload error:', {
        errorName: error?.name,
        errorMessage: error?.message,
        errorResponse: error?.response,
        errorData: error?.data,
        fullError: error,
      });
      
      // Extract detailed error message
      let errorMessage = 'Failed to upload file.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      console.error('❌ [Media Upload Component] Error message to display:', errorMessage);
      alert(`Upload failed: ${errorMessage}\n\nPlease check:\n- Vultr credentials in .env.local\n- Network connection\n- File size limits`);
    } finally {
      setUploadingFiles([]);
    }
  }, [uploadMutation, onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileInput}
        className="hidden"
      />
      
      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-sm font-medium mb-2">
        Drag and drop files here, or click to select
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Supports images and videos
      </p>
      <Button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadMutation.isPending}
      >
        {uploadMutation.isPending ? 'Uploading...' : 'Select Files'}
      </Button>
      
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">Uploading:</p>
          {uploadingFiles.map((fileName, index) => (
            <div key={index} className="text-xs text-muted-foreground">
              {fileName}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


