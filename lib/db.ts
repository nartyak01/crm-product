import { Pool } from 'pg';

// Validate environment variables
function validateEnvVars() {
  const required = ['POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Make sure you have a .env.local file with these variables set.');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate on import
validateEnvVars();

// Create a connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
  console.log(`   Host: ${process.env.POSTGRES_HOST}`);
  console.log(`   Port: ${process.env.POSTGRES_PORT || '5432'}`);
  console.log(`   Database: ${process.env.POSTGRES_DB}`);
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ Database connection test successful');
  })
  .catch((err) => {
    console.error('❌ Database connection test failed:', err.message);
    console.error('💡 Please check your .env.local file and database connection settings.');
  });

export default pool;

