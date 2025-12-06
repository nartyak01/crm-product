'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProducts } from '@/hooks/use-products';
import { useSyncProductToShopify } from '@/hooks/use-shopify-sync';
import { formatCurrency, formatDateShort, formatImageUrl } from '@/lib/utils';
import Link from 'next/link';
import { Package, Plus, Search, Edit, Eye } from 'lucide-react';
import { ShopifySyncStatus } from '@/components/shopify-sync-status';
import { SyncButton } from '@/components/sync-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductDetailDialog } from '@/components/product-detail-dialog';
import { ProductEditDialog } from '@/components/product-edit-dialog';

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [productType, setProductType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [syncingProductId, setSyncingProductId] = useState<number | null>(null);
  const limit = 20;

  const { data, isLoading } = useProducts({
    search: search || undefined,
    status: status !== 'all' ? status : undefined,
    product_type: productType !== 'all' ? productType : undefined,
    limit,
    offset: page * limit,
  });

  const syncMutation = useSyncProductToShopify();

  const products = data?.products || [];
  const pagination = data?.pagination;

  const handleViewDetail = (productId: number) => {
    setSelectedProductId(productId);
    setIsDetailDialogOpen(true);
  };

  const handleEdit = (productId: number) => {
    setSelectedProductId(productId);
    setIsEditDialogOpen(true);
  };

  const handleSync = async (id: number) => {
    setSyncingProductId(id);
    try {
      await syncMutation.mutateAsync(id);
      alert('Product synced to Shopify successfully!');
    } catch (error: any) {
      alert(`Failed to sync product: ${error.message}`);
    } finally {
      setSyncingProductId(null);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Products</h1>
            </div>
            <Link href="/products/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Product
              </Button>
            </Link>
          </div>

          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="publish">Published</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="do_not_import">Do Not Import</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={productType} 
              onValueChange={(value) => {
                setProductType(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Product Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="jewelry">Jewelry</SelectItem>
                <SelectItem value="diamond">Diamond</SelectItem>
                <SelectItem value="gemstone">Gemstone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Thumbnail</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Shopify</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No products found
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((product: any) => {
                        // Get thumbnail URL
                        const getThumbnailUrl = (): string => {
                          if (product.product_type === 'diamond' && product.diamond_image_path) {
                            return product.diamond_image_path;
                          }
                          if (product.thumbnail) {
                            return formatImageUrl(product.thumbnail, product.product_type);
                          }
                          return '';
                        };
                        const thumbnailUrl = getThumbnailUrl();

                        return (
                          <TableRow key={product.id}>
                            <TableCell className="font-mono text-sm">
                              {product.sku}
                            </TableCell>
                            <TableCell>
                              {thumbnailUrl ? (
                                <img
                                  src={thumbnailUrl}
                                  alt={product.name}
                                  className="w-12 h-12 object-cover rounded border"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">
                                  No img
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => handleViewDetail(product.id)}
                                className="font-medium hover:underline text-left"
                              >
                                {product.name}
                              </button>
                            </TableCell>
                            <TableCell>{formatCurrency(product.retail_price)}</TableCell>
                            <TableCell>
                              <span
                                className={`rounded-full px-2 py-1 text-xs ${
                                  product.status === 'publish'
                                    ? 'bg-green-100 text-green-800'
                                    : product.status === 'draft'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {product.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <ShopifySyncStatus 
                                shopifyId={product.shopify_product_id}
                                isLoading={syncingProductId === product.id}
                              />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateShort(product.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <SyncButton
                                  onSync={() => handleSync(product.id)}
                                  isLoading={syncingProductId === product.id}
                                  size="icon"
                                  variant="ghost"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDetail(product.id)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(product.id)}
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.total > limit && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {page * limit + 1} to{' '}
                    {Math.min((page + 1) * limit, pagination.total)} of{' '}
                    {pagination.total} products
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
      <ProductDetailDialog
        productId={selectedProductId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
      />
      <ProductEditDialog
        productId={selectedProductId}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {
          // Data will be refreshed automatically via React Query invalidation
          // No need to reload page
        }}
      />
    </div>
  );
}

