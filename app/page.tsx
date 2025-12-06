'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProducts } from '@/hooks/use-products';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-8 text-3xl font-bold">Dashboard</h1>
          <DashboardContent />
        </div>
      </main>
    </div>
  );
}

function DashboardContent() {
  const { data, isLoading } = useProducts({ limit: 10 });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const products = data?.products || [];
  const total = data?.pagination?.total || 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Products</CardTitle>
            <CardDescription>All products in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Published</CardTitle>
            <CardDescription>Published products</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {products.filter((p: any) => p.status === 'publish').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Draft</CardTitle>
            <CardDescription>Draft products</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {products.filter((p: any) => p.status === 'draft').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Products</CardTitle>
          <CardDescription>Latest products added to the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No products yet. <Link href="/products/new" className="text-primary hover:underline">Create one</Link>
              </div>
            ) : (
              products.map((product: any) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div>
                    <Link
                      href={`/products/${product.id}`}
                      className="font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      SKU: {product.sku} • {formatCurrency(product.retail_price)}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(product.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4">
            <Link href="/products">
              <Button variant="outline">View All Products</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

