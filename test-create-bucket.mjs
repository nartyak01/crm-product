/**
 * Test script: Create a new bucket in Vultr Object Storage
 * 
 * Usage:
 *   node test-create-bucket.mjs ritamie-media
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env.local');

try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
  console.log('✅ Loaded environment variables from .env.local\n');
} catch (error) {
  console.error('⚠️  Could not load .env.local file:', error.message);
  process.exit(1);
}

async function createBucket(bucketName) {
  try {
    console.log(`🔍 Creating bucket: ${bucketName}...\n`);
    
    const { S3Client, CreateBucketCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    
    const required = ['VULTR_ACCESS_KEY', 'VULTR_SECRET_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      process.exit(1);
    }
    
    const endpoint = process.env.VULTR_ENDPOINT || 'https://sgp1.vultrobjects.com';
    
    console.log('🔧 Configuration:');
    console.log(`   - Endpoint: ${endpoint}`);
    console.log(`   - Bucket Name: ${bucketName}\n`);
    
    const s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.VULTR_ACCESS_KEY,
        secretAccessKey: process.env.VULTR_SECRET_KEY,
      },
      forcePathStyle: true,
    });
    
    // Check if bucket already exists
    try {
      const headCommand = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(headCommand);
      console.log(`✅ Bucket "${bucketName}" already exists!\n`);
      console.log('💡 You can use it directly by updating .env.local:');
      console.log(`   VULTR_BUCKET_NAME=${bucketName}\n`);
      return bucketName;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        // Bucket doesn't exist, create it
        console.log(`📦 Creating bucket "${bucketName}"...`);
      } else {
        throw error;
      }
    }
    
    // Create bucket
    const createCommand = new CreateBucketCommand({ Bucket: bucketName });
    await s3Client.send(createCommand);
    
    console.log(`✅ Bucket "${bucketName}" created successfully!\n`);
    console.log('💡 Next steps:');
    console.log(`   1. Update .env.local: VULTR_BUCKET_NAME=${bucketName}`);
    console.log('   2. Restart your Next.js dev server\n');
    
    return bucketName;
  } catch (error) {
    console.error('\n❌ Error creating bucket:');
    console.error('   Message:', error.message);
    if (error.name) {
      console.error('   Name:', error.name);
    }
    if (error.Code || error.code) {
      console.error('   Code:', error.Code || error.code);
    }
    if (error.$metadata) {
      console.error('   Request ID:', error.$metadata.requestId);
      console.error('   Status Code:', error.$metadata.httpStatusCode);
    }
    
    // Common errors
    if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
      console.error('\n💡 Bucket already exists. You can use it directly.');
      console.error(`💡 Update .env.local: VULTR_BUCKET_NAME=${bucketName}`);
    } else if (error.name === 'InvalidBucketName') {
      console.error('\n💡 Invalid bucket name. Bucket names must:');
      console.error('   - Be 3-63 characters long');
      console.error('   - Contain only lowercase letters, numbers, hyphens, and dots');
      console.error('   - Start and end with a letter or number');
      console.error('   - Not be formatted as an IP address');
    } else if (error.name === 'BucketAlreadyOwnedByYou') {
      console.error('\n💡 Bucket already exists and is owned by you.');
      console.error(`💡 Update .env.local: VULTR_BUCKET_NAME=${bucketName}`);
    }
    
    process.exit(1);
  }
}

// Get bucket name from command line argument or use default
const bucketName = process.argv[2] || 'ritamie-media';

if (!bucketName) {
  console.error('❌ Please provide a bucket name');
  console.error('Usage: node test-create-bucket.mjs <bucket-name>');
  process.exit(1);
}

// Validate bucket name
if (bucketName.length < 3 || bucketName.length > 63) {
  console.error('❌ Bucket name must be 3-63 characters long');
  process.exit(1);
}

if (!/^[a-z0-9.-]+$/.test(bucketName)) {
  console.error('❌ Bucket name can only contain lowercase letters, numbers, hyphens, and dots');
  process.exit(1);
}

if (bucketName.startsWith('.') || bucketName.endsWith('.') || bucketName.startsWith('-') || bucketName.endsWith('-')) {
  console.error('❌ Bucket name must start and end with a letter or number');
  process.exit(1);
}

// Check if it looks like an IP address
if (/^\d+\.\d+\.\d+\.\d+$/.test(bucketName)) {
  console.error('❌ Bucket name cannot be formatted as an IP address');
  process.exit(1);
}

createBucket(bucketName);

