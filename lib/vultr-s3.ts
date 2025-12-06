import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Validate environment variables (lazy validation - only when needed)
function validateEnvVars() {
  const required = ['VULTR_ACCESS_KEY', 'VULTR_SECRET_KEY', 'VULTR_BUCKET_NAME'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ [Vultr S3] Missing required environment variables:');
    missing.forEach(key => {
      console.error(`   - ${key}: ${process.env[key] ? 'EXISTS (but empty)' : 'NOT SET'}`);
    });
    console.error('\n💡 [Vultr S3] Make sure you have a .env.local file with these variables set.');
    console.error('💡 [Vultr S3] Current environment check:', {
      VULTR_ACCESS_KEY: process.env.VULTR_ACCESS_KEY ? `SET (length: ${process.env.VULTR_ACCESS_KEY.length})` : 'NOT SET',
      VULTR_SECRET_KEY: process.env.VULTR_SECRET_KEY ? `SET (length: ${process.env.VULTR_SECRET_KEY.length})` : 'NOT SET',
      VULTR_BUCKET_NAME: process.env.VULTR_BUCKET_NAME ? `SET (value: ${process.env.VULTR_BUCKET_NAME})` : 'NOT SET',
      VULTR_ENDPOINT: process.env.VULTR_ENDPOINT || 'DEFAULT (sgp1.vultrobjects.com)',
    });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Log successful validation in development
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ [Vultr S3] Environment variables validated successfully');
    console.log('   - Access Key:', process.env.VULTR_ACCESS_KEY?.substring(0, 8) + '...');
    console.log('   - Secret Key:', process.env.VULTR_SECRET_KEY ? '***SET***' : 'NOT SET');
    console.log('   - Bucket Name:', process.env.VULTR_BUCKET_NAME);
    console.log('   - Endpoint:', process.env.VULTR_ENDPOINT || 'sgp1.vultrobjects.com (default)');
  }
}

// Lazy initialization - validate when S3 client is first used
let s3ClientInitialized = false;
function ensureS3ClientInitialized() {
  if (!s3ClientInitialized) {
    validateEnvVars();
    s3ClientInitialized = true;
  }
}

// Create S3 client configured for Vultr Object Storage (lazy initialization)
function getS3Client() {
  ensureS3ClientInitialized();
  const endpoint = process.env.VULTR_ENDPOINT || 'https://sgp1.vultrobjects.com';
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 [Vultr S3] Creating S3 client with config:', {
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      accessKeyId: process.env.VULTR_ACCESS_KEY?.substring(0, 8) + '...',
    });
  }
  
  return new S3Client({
    endpoint,
    region: 'us-east-1', // Vultr doesn't use regions, but SDK requires it
    credentials: {
      accessKeyId: process.env.VULTR_ACCESS_KEY!,
      secretAccessKey: process.env.VULTR_SECRET_KEY!,
    },
    forcePathStyle: true, // Required for S3-compatible services
  });
}

function getBucketName() {
  ensureS3ClientInitialized();
  return process.env.VULTR_BUCKET_NAME!;
}

/**
 * Generate file path with date-based organization
 * Format: media/{year}/{month}/{filename}
 */
export function generateFilePath(fileName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `media/${year}/${month}/${sanitizedFileName}`;
}

/**
 * Upload file to Vultr Object Storage
 */
export async function uploadFile(
  file: Buffer | Uint8Array,
  filePath: string,
  contentType: string
): Promise<string> {
  try {
    console.log('📤 [Vultr S3] Starting file upload:', {
      filePath,
      contentType,
      fileSize: file.length,
      fileSizeMB: (file.length / 1024 / 1024).toFixed(2) + ' MB',
    });
    
    const s3Client = getS3Client();
    const bucketName = getBucketName();
    
    console.log('📤 [Vultr S3] Upload configuration:', {
      bucket: bucketName,
      key: filePath,
      contentType,
    });
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: file,
      ContentType: contentType,
    });

    const startTime = Date.now();
    await s3Client.send(command);
    const uploadTime = Date.now() - startTime;
    
    console.log(`✅ [Vultr S3] Upload successful in ${uploadTime}ms:`, {
      bucket: bucketName,
      key: filePath,
      size: file.length,
    });
    
    // Return URL (with forcePathStyle, format is: endpoint/bucket/key)
    // Note: This will be a presigned URL if bucket is private
    const endpoint = process.env.VULTR_ENDPOINT || 'https://sgp1.vultrobjects.com';
    // With forcePathStyle, URL format is: endpoint/bucket/key
    const fileUrl = `${endpoint}/${bucketName}/${filePath}`;
    
    console.log('🔗 [Vultr S3] Generated file URL:', fileUrl);
    console.log('💡 Note: If bucket is private, use presigned URL instead');
    
    return fileUrl;
  } catch (error: any) {
    console.error('❌ [Vultr S3] Upload failed:', {
      filePath,
      contentType,
      fileSize: file.length,
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.Code || error?.code,
      errorRequestId: error?.$metadata?.requestId,
      errorStatusCode: error?.$metadata?.httpStatusCode,
      fullError: process.env.NODE_ENV === 'development' ? error : undefined,
    });
    throw error;
  }
}

/**
 * Delete file from Vultr Object Storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    console.log('🗑️ [Vultr S3] Starting file deletion:', { filePath });
    
    const s3Client = getS3Client();
    const bucketName = getBucketName();
    
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: filePath,
    });

    await s3Client.send(command);
    
    console.log('✅ [Vultr S3] File deleted successfully:', { bucket: bucketName, key: filePath });
  } catch (error: any) {
    console.error('❌ [Vultr S3] Delete failed:', {
      filePath,
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.Code || error?.code,
      fullError: process.env.NODE_ENV === 'development' ? error : undefined,
    });
    throw error;
  }
}

/**
 * Generate presigned URL for file access (valid for 1 hour)
 */
export async function getPresignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
  const s3Client = getS3Client();
  const bucketName = getBucketName();
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: filePath,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get public URL for file (if bucket is public)
 * With forcePathStyle, URL format is: endpoint/bucket/key
 */
export function getPublicUrl(filePath: string): string {
  const bucketName = getBucketName();
  const endpoint = process.env.VULTR_ENDPOINT || 'https://sgp1.vultrobjects.com';
  // With forcePathStyle, URL format is: endpoint/bucket/key
  return `${endpoint}/${bucketName}/${filePath}`;
}

/**
 * Determine media type from MIME type
 */
export function getMediaType(mimeType: string): 'image' | 'video' {
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  }
  throw new Error(`Unsupported media type: ${mimeType}`);
}

/**
 * List all buckets in Vultr Object Storage
 */
export async function listBuckets() {
  try {
    console.log('📦 [Vultr S3] Listing all buckets...');
    
    // Note: ListBuckets doesn't require bucket name, so we can call it without VULTR_BUCKET_NAME
    // But we still need credentials
    const required = ['VULTR_ACCESS_KEY', 'VULTR_SECRET_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ [Vultr S3] Missing required credentials:', missing.join(', '));
      throw new Error(`Missing required credentials: ${missing.join(', ')}`);
    }
    
    const endpoint = process.env.VULTR_ENDPOINT || 'https://sgp1.vultrobjects.com';
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [Vultr S3] Creating S3 client for listBuckets:', { endpoint });
    }
    
    const s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.VULTR_ACCESS_KEY!,
        secretAccessKey: process.env.VULTR_SECRET_KEY!,
      },
      forcePathStyle: true,
    });
    
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    
    const buckets = response.Buckets || [];
    console.log(`✅ [Vultr S3] Found ${buckets.length} bucket(s):`);
    buckets.forEach((bucket, index) => {
      const date = bucket.CreationDate ? new Date(bucket.CreationDate).toLocaleString() : 'Unknown';
      console.log(`   ${index + 1}. ${bucket.Name} (created: ${date})`);
    });
    
    return buckets.map(bucket => ({
      name: bucket.Name,
      creationDate: bucket.CreationDate,
    }));
  } catch (error: any) {
    console.error('❌ [Vultr S3] Failed to list buckets:', {
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.Code || error?.code,
      errorRequestId: error?.$metadata?.requestId,
      errorStatusCode: error?.$metadata?.httpStatusCode,
      fullError: process.env.NODE_ENV === 'development' ? error : undefined,
    });
    throw error;
  }
}

// Export getBucketName function for use in other modules
export { getBucketName };

