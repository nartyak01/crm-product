/**
 * Test script: List all buckets in Vultr Object Storage
 * 
 * Usage:
 *   node test-list-buckets.mjs
 * 
 * Make sure you have .env.local file with:
 *   VULTR_ACCESS_KEY=your-access-key
 *   VULTR_SECRET_KEY=your-secret-key
 *   VULTR_ENDPOINT=https://sgp1.vultrobjects.com (optional)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Load .env.local file
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
  console.log('💡 Make sure .env.local exists in the product-admin directory\n');
}

async function testListBuckets() {
  try {
    console.log('🔍 Listing buckets from Vultr Object Storage...\n');
    
    // Dynamic import - need to use .ts extension and handle TypeScript
    // Since we're in a .mjs file, we'll need to import the compiled JS or use a different approach
    // For now, let's create a simple inline implementation
    
    const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
    
    const required = ['VULTR_ACCESS_KEY', 'VULTR_SECRET_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:');
      missing.forEach(key => console.error(`   - ${key}`));
      console.error('\n💡 Please add them to .env.local file');
      process.exit(1);
    }
    
    const endpoint = process.env.VULTR_ENDPOINT || 'https://sgp1.vultrobjects.com';
    
    console.log('🔧 Configuration:');
    console.log(`   - Endpoint: ${endpoint}`);
    console.log(`   - Access Key: ${process.env.VULTR_ACCESS_KEY?.substring(0, 8)}...`);
    console.log(`   - Secret Key: ${process.env.VULTR_SECRET_KEY ? '***SET***' : 'NOT SET'}\n`);
    
    const s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.VULTR_ACCESS_KEY,
        secretAccessKey: process.env.VULTR_SECRET_KEY,
      },
      forcePathStyle: true,
    });
    
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    
    const buckets = response.Buckets || [];
    
    console.log('📋 Bucket List:');
    console.log('='.repeat(60));
    
    if (buckets.length === 0) {
      console.log('   No buckets found.');
      console.log('\n💡 You can create a bucket in Vultr dashboard or use CreateBucket API');
    } else {
      buckets.forEach((bucket, index) => {
        const date = bucket.CreationDate 
          ? new Date(bucket.CreationDate).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Unknown';
        console.log(`   ${index + 1}. ${bucket.Name}`);
        console.log(`      Created: ${date}`);
      });
    }
    
    console.log('='.repeat(60));
    console.log(`\n✅ Total: ${buckets.length} bucket(s)\n`);
    
    // Show current VULTR_BUCKET_NAME if set
    if (process.env.VULTR_BUCKET_NAME) {
      const currentBucket = buckets.find(b => b.Name === process.env.VULTR_BUCKET_NAME);
      if (currentBucket) {
        console.log(`✅ Current VULTR_BUCKET_NAME (${process.env.VULTR_BUCKET_NAME}) exists in the list above`);
      } else {
        console.log(`⚠️  Current VULTR_BUCKET_NAME (${process.env.VULTR_BUCKET_NAME}) NOT found in the list`);
        console.log('💡 Update .env.local with one of the bucket names above');
      }
    } else {
      console.log('💡 VULTR_BUCKET_NAME is not set in .env.local');
      if (buckets.length > 0) {
        console.log(`💡 Suggested: VULTR_BUCKET_NAME=${buckets[0].Name}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error listing buckets:');
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
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testListBuckets();

