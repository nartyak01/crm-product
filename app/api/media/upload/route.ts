import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, generateFilePath, getMediaType, getBucketName, getPresignedUrl } from '@/lib/vultr-s3';
import { createMedia } from '@/lib/queries/media';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('📥 [Media Upload API] Received upload request');
  
  try {
    console.log('📥 [Media Upload API] Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ [Media Upload API] No file provided in request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📥 [Media Upload API] File received:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: (file.size / 1024 / 1024).toFixed(2) + ' MB',
    });

    // Validate file type
    console.log('📥 [Media Upload API] Validating file type...');
    let mediaType: 'image' | 'video';
    try {
      mediaType = getMediaType(file.type);
      console.log('✅ [Media Upload API] File type validated:', { mediaType, mimeType: file.type });
    } catch (typeError: any) {
      console.error('❌ [Media Upload API] Invalid file type:', {
        fileType: file.type,
        fileName: file.name,
        error: typeError.message,
      });
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Only images and videos are allowed.` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    console.log('📥 [Media Upload API] Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('✅ [Media Upload API] Buffer created:', {
      bufferLength: buffer.length,
      expectedLength: file.size,
      match: buffer.length === file.size ? 'YES' : 'NO',
    });

    // Generate file path
    const filePath = generateFilePath(file.name);
    console.log('📥 [Media Upload API] Generated file path:', filePath);

    // Upload to Vultr Object Storage
    console.log('📥 [Media Upload API] Starting upload to Vultr Object Storage...');
    const fileUrl = await uploadFile(buffer, filePath, file.type);
    console.log('✅ [Media Upload API] Upload to Vultr completed:', { fileUrl });

    // Generate presigned URL for private bucket
    console.log('📥 [Media Upload API] Generating presigned URL...');
    let presignedUrl: string | null = null;
    try {
      presignedUrl = await getPresignedUrl(filePath);
      console.log('✅ [Media Upload API] Presigned URL generated');
    } catch (error: any) {
      console.warn('⚠️ [Media Upload API] Failed to generate presigned URL:', error.message);
      // Continue without presigned URL (bucket might be public)
    }

    // Save metadata to database
    console.log('📥 [Media Upload API] Saving metadata to database...');
    const bucketName = getBucketName();
    const mediaData = {
      file_name: file.name,
      file_path: filePath,
      file_url: fileUrl,
      presigned_url: presignedUrl || undefined,
      file_type: file.type,
      file_size: file.size,
      media_type: mediaType,
      bucket_name: bucketName,
    };
    console.log('📥 [Media Upload API] Media data to save:', mediaData);
    
    const media = await createMedia(mediaData);
    console.log('✅ [Media Upload API] Media saved to database:', { id: media.id });

    const totalTime = Date.now() - startTime;
    console.log(`✅ [Media Upload API] Upload completed successfully in ${totalTime}ms:`, {
      mediaId: media.id,
      fileName: file.name,
      fileSize: file.size,
    });

    return NextResponse.json(media);
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [Media Upload API] Upload failed after ${totalTime}ms:`, {
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorCode: error?.code,
      errorDetails: error?.details,
      fullError: process.env.NODE_ENV === 'development' ? error : undefined,
    });
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to upload media',
        errorName: error?.name,
        errorCode: error?.code,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}


