'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProductForm } from '@/hooks/use-product-form';
import { useCreateProduct } from '@/hooks/use-products';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();
  const form = useProductForm();
  const createMutation = useCreateProduct();

  const onSubmit = async (data: any) => {
    try {
      const product = await createMutation.mutateAsync(data);
      router.push(`/products/${product.id}`);
    } catch (error: any) {
      alert(error.message || 'Failed to create product');
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <Link href="/products">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Products
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">New Product</h1>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
                <CardDescription>
                  Enter the basic information for your product
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      {...form.register('sku')}
                      placeholder="PROD-001"
                    />
                    {form.formState.errors.sku && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.sku.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      {...form.register('name')}
                      placeholder="Product Name"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="product_type">Product Type</Label>
                    <Select
                      value={form.watch('product_type')}
                      onValueChange={(value) =>
                        form.setValue('product_type', value as any)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jewelry">Jewelry</SelectItem>
                        <SelectItem value="diamond">Diamond</SelectItem>
                        <SelectItem value="gemstone">Gemstone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={form.watch('status')}
                      onValueChange={(value) =>
                        form.setValue('status', value as any)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="publish">Published</SelectItem>
                        <SelectItem value="updated">Updated</SelectItem>
                        <SelectItem value="do_not_import">Do Not Import</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="retail_price">Retail Price</Label>
                    <Input
                      id="retail_price"
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register('retail_price', { valueAsNumber: true })}
                    />
                    {form.formState.errors.retail_price && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.retail_price.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sale_price">Sale Price</Label>
                    <Input
                      id="sale_price"
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register('sale_price', { valueAsNumber: true })}
                    />
                    {form.formState.errors.sale_price && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.sale_price.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register('description')}
                    rows={4}
                    placeholder="Product description..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_pre_order"
                    {...form.register('is_pre_order')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="is_pre_order" className="cursor-pointer">
                    Available for pre-order
                  </Label>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 flex justify-end gap-4">
              <Link href="/products">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Product'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

