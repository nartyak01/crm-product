/**
 * Test script: Check if bucket is public
 * 
 * Usage:
 *   node test-check-bucket-public.mjs
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

async function checkBucketPublic() {
  try {
    const { S3Client, HeadObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    
    const required = ['VULTR_ACCESS_KEY', 'VULTR_SECRET_KEY', 'VULTR_BUCKET_NAME'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      process.exit(1);
    }
    
    const bucketName = process.env.VULTR_BUCKET_NAME;
    const endpoint = process.env.VULTR_ENDPOINT || 'https://sgp1.vultrobjects.com';
    const endpointHost = endpoint.replace(/^https?:\/\//, '');
    
    console.log('🔍 Checking if bucket is public...\n');
    console.log('📋 Configuration:');
    console.log(`   - Bucket: ${bucketName}`);
    console.log(`   - Endpoint: ${endpoint}\n`);
    
    // Create S3 client
    const s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.VULTR_ACCESS_KEY,
        secretAccessKey: process.env.VULTR_SECRET_KEY,
      },
      forcePathStyle: true,
    });
    
    // Try to list objects in bucket to find a test file
    console.log('🔍 Looking for files in bucket...\n');
    let testFile = null;
    let testFilePath = null;
    
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 10,
      });
      const listResponse = await s3Client.send(listCommand);
      
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        // Use the first file found
        testFile = listResponse.Contents[0];
        testFilePath = testFile.Key;
        console.log(`✅ Found test file: ${testFilePath}`);
        console.log(`   Size: ${(testFile.Size / 1024).toFixed(2)} KB`);
        console.log(`   Last Modified: ${testFile.LastModified}\n`);
      } else {
        console.log('⚠️  No files found in bucket.');
        console.log('💡 Upload a file first, then run this script again.\n');
        
        // Still show URL formats
        const publicUrl1 = `https://${bucketName}.${endpointHost}/test.jpg`;
        const publicUrl2 = `${endpoint}/${bucketName}/test.jpg`;
        
        console.log('📝 URL Formats to test:');
        console.log(`   1. Virtual-hosted style: ${publicUrl1}`);
        console.log(`   2. Path-style (forcePathStyle): ${publicUrl2}\n`);
        
        console.log('💡 To check if bucket is public:');
        console.log('   1. Upload a test file');
        console.log('   2. Try accessing it via browser with both URL formats');
        console.log('   3. If you get 403 Forbidden, bucket is private');
        console.log('   4. If you can see the file, bucket is public\n');
        
        return;
      }
    } catch (error) {
      console.error('❌ Error listing objects:', error.message);
      process.exit(1);
    }
    
    // Test both URL formats
    const publicUrl1 = `https://${bucketName}.${endpointHost}/${testFilePath}`;
    const publicUrl2 = `${endpoint}/${bucketName}/${testFilePath}`;
    
    console.log('🔗 Testing URL formats:\n');
    console.log(`   1. Virtual-hosted style:`);
    console.log(`      ${publicUrl1}`);
    
    console.log(`\n   2. Path-style (forcePathStyle):`);
    console.log(`      ${publicUrl2}\n`);
    
    // Test public access using fetch
    console.log('🧪 Testing public access...\n');
    
    const testUrl = async (url, name) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          console.log(`   ✅ ${name}: PUBLIC (Status: ${response.status})`);
          console.log(`      Content-Type: ${response.headers.get('content-type') || 'N/A'}`);
          return true;
        } else if (response.status === 403) {
          console.log(`   🔒 ${name}: PRIVATE (Status: ${response.status} Forbidden)`);
          return false;
        } else if (response.status === 404) {
          console.log(`   ❓ ${name}: NOT FOUND (Status: ${response.status}) - URL format might be wrong`);
          return null;
        } else {
          console.log(`   ⚠️  ${name}: Unknown status (${response.status})`);
          return null;
        }
      } catch (error) {
        console.log(`   ❌ ${name}: Error - ${error.message}`);
        return null;
      }
    };
    
    const result1 = await testUrl(publicUrl1, 'Virtual-hosted style');
    const result2 = await testUrl(publicUrl2, 'Path-style');
    
    console.log('\n📊 Summary:');
    console.log('='.repeat(60));
    if (result1 || result2) {
      console.log('   ✅ Bucket appears to be PUBLIC');
      console.log('   💡 You can use public URLs directly');
      if (result1) {
        console.log(`   💡 Use URL format: https://${bucketName}.${endpointHost}/<file-path>`);
      }
      if (result2) {
        console.log(`   💡 Use URL format: ${endpoint}/${bucketName}/<file-path>`);
      }
    } else if (result1 === false || result2 === false) {
      console.log('   🔒 Bucket is PRIVATE');
      console.log('   💡 You need to use presigned URLs for access');
      console.log('   💡 Or make bucket public in Vultr Dashboard');
    } else {
      console.log('   ❓ Could not determine bucket status');
      console.log('   💡 Try accessing URLs manually in browser:');
      console.log(`      ${publicUrl1}`);
      console.log(`      ${publicUrl2}`);
    }
    console.log('='.repeat(60));
    
    console.log('\n💡 To make bucket public:');
    console.log('   1. Go to Vultr Dashboard → Object Storage');
    console.log('   2. Select your bucket');
    console.log('   3. Configure bucket policy or CORS settings');
    console.log('   4. Or use presigned URLs for private buckets\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkBucketPublic();

