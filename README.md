# Product Admin Dashboard

Full-stack Next.js application for managing products, categories, images, and metafields with PostgreSQL database.

## Features

- **Product Management**: CRUD operations for products with SKU, pricing, status, and descriptions
- **Image Management**: Upload and manage product thumbnails and gallery images
- **Category Management**: Hierarchical category tree with parent-child relationships
- **Metafield Management**: Custom product attributes (product_attribute) and values (product_attribute_value)

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: PostgreSQL
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod validation

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

## Setup

1. **Install dependencies**:
   ```bash
   cd product-admin
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` file in the `product-admin` directory:
   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=your_database_name
   POSTGRES_USER=your_username
   POSTGRES_PASSWORD=your_password
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Database Setup**:
   Make sure your PostgreSQL database has the schema from `005_product.sql` applied. The application expects the following tables:
   - `product`
   - `category`
   - `product_category`
   - `product_attribute`
   - `product_attribute_value`
   - `product_image`

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
product-admin/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── products/          # Product pages
│   ├── categories/        # Category pages
│   └── metafields/        # Metafield pages
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── layout/           # Layout components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and database
│   ├── db.ts             # PostgreSQL connection
│   └── queries/          # Database query functions
└── types/                 # TypeScript type definitions
```

## API Routes

- `GET /api/products` - List products with pagination and filters
- `POST /api/products` - Create new product
- `GET /api/products/[id]` - Get product details
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product
- `GET /api/categories` - List categories (tree or flat)
- `POST /api/categories` - Create category
- `GET /api/metafields` - List metafields
- `POST /api/metafields` - Create metafield
- `POST /api/products/[id]/images` - Update product images
- `POST /api/products/[id]/categories` - Assign category to product
- `POST /api/products/[id]/metafields` - Set product metafield value

## Usage

### Products
- View all products with search and filter capabilities
- Create new products with SKU, name, type, prices, and status
- Edit products with tabs for Basic info, Images, Categories, and Metafields
- Delete products (cascades to related data)

### Categories
- Create hierarchical category structure
- Edit category names inline
- Assign categories to products
- Delete categories (only if no children or product assignments)

### Metafields
- Create custom attribute definitions (e.g., Color, Size, Material)
- Assign metafield values to products
- Support for different attribute types (text, number, select, boolean)

## Notes

- No authentication is implemented (localhost only)
- `created_by_id` and `updated_by_id` can be NULL
- Product images support JSON array or comma-separated URLs
- Category `parent_id = 0` means root category
- Gallery images stored as JSON array in `product_image.gallery`

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## License

MIT

