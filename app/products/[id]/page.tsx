'use client';

import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProduct, useUpdateProduct } from '@/hooks/use-products';
import { useProductForm } from '@/hooks/use-product-form';
import { useProductImages, useUpdateProductImages } from '@/hooks/use-product-images';
import { useProductMetafields, useSetProductMetafield, useDeleteProductMetafield } from '@/hooks/use-metafields';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryTree, flattenCategoryTree } from '@/hooks/use-category-tree';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { parseGallery } from '@/lib/utils';
import { useMetafields } from '@/hooks/use-metafields';

export default function ProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const productId = parseInt(params.id as string);

  const { data: product, isLoading } = useProduct(productId);
  const form = useProductForm(product);
  const updateMutation = useUpdateProduct();

  useEffect(() => {
    if (product) {
      form.reset({
        sku: product.sku,
        name: product.name,
        product_type: product.product_type,
        retail_price: product.retail_price,
        sale_price: product.sale_price,
        description: product.description || '',
        is_pre_order: product.is_pre_order,
        status: product.status,
      });
    }
  }, [product, form]);

  const onSubmit = async (data: any) => {
    try {
      await updateMutation.mutateAsync({ id: productId, ...data });
      alert('Product updated successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to update product');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div>Loading...</div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div>Product not found</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <Link href="/products">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Products
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">{product.name}</h1>
          </div>

          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList>
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="metafields">Metafields</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                  <CardHeader>
                    <CardTitle>Product Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="sku">SKU *</Label>
                        <Input id="sku" {...form.register('sku')} />
                        {form.formState.errors.sku && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.sku.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" {...form.register('name')} />
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
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                            <SelectItem value="variant">Variant</SelectItem>
                            <SelectItem value="set">Set</SelectItem>
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
                          {...form.register('retail_price', { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sale_price">Sale Price</Label>
                        <Input
                          id="sale_price"
                          type="number"
                          step="0.01"
                          {...form.register('sale_price', { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...form.register('description')}
                        rows={4}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_pre_order"
                        {...form.register('is_pre_order')}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="is_pre_order" className="cursor-pointer">
                        Available for pre-order
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                <div className="mt-6 flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="images">
              <ProductImagesTab productId={productId} />
            </TabsContent>

            <TabsContent value="categories">
              <ProductCategoriesTab productId={productId} product={product} />
            </TabsContent>

            <TabsContent value="metafields">
              <ProductMetafieldsTab productId={productId} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function ProductImagesTab({ productId }: { productId: number }) {
  const { data: images } = useProductImages(productId);
  const updateMutation = useUpdateProductImages(productId);
  const [thumbnail, setThumbnail] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);

  useEffect(() => {
    if (images) {
      setThumbnail(images.thumbnail || '');
      setGallery(parseGallery(images.gallery || ''));
    }
  }, [images]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ thumbnail, gallery });
      alert('Images updated successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to update images');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Images</CardTitle>
        <CardDescription>Manage product thumbnail and gallery images</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Thumbnail URL</Label>
          <Input
            value={thumbnail}
            onChange={(e) => setThumbnail(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </div>
        <div className="space-y-2">
          <Label>Gallery URLs (one per line)</Label>
          <Textarea
            value={gallery.join('\n')}
            onChange={(e) => setGallery(e.target.value.split('\n').filter(Boolean))}
            rows={6}
            placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
          />
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Images'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProductCategoriesTab({ productId, product }: { productId: number; product: any }) {
  const { data: categories } = useCategoryTree();
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  useEffect(() => {
    if (product?.categories) {
      setSelectedCategories(product.categories.map((c: any) => c.id));
    }
  }, [product]);

  const handleToggleCategory = async (categoryId: number) => {
    const isSelected = selectedCategories.includes(categoryId);
    try {
      if (isSelected) {
        await fetch(`/api/products/${productId}/categories?category_id=${categoryId}`, {
          method: 'DELETE',
        });
        setSelectedCategories((prev) => prev.filter((id) => id !== categoryId));
      } else {
        await fetch(`/api/products/${productId}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: categoryId }),
        });
        setSelectedCategories((prev) => [...prev, categoryId]);
      }
    } catch (error) {
      alert('Failed to update category');
    }
  };

  const flatCategories = categories ? flattenCategoryTree(categories) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Categories</CardTitle>
        <CardDescription>Assign categories to this product</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {flatCategories.map((category) => (
            <div key={category.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.id)}
                onChange={() => handleToggleCategory(category.id)}
                className="h-4 w-4"
              />
              <Label className="cursor-pointer">{category.name}</Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductMetafieldsTab({ productId }: { productId: number }) {
  const { data: metafields } = useMetafields();
  const { data: productMetafields } = useProductMetafields(productId);
  const setMutation = useSetProductMetafield(productId);
  const deleteMutation = useDeleteProductMetafield(productId);
  const [values, setValues] = useState<Record<number, string>>({});

  useEffect(() => {
    if (productMetafields) {
      const initialValues: Record<number, string> = {};
      productMetafields.forEach((mf: any) => {
        initialValues[mf.attribute_id] = mf.value;
      });
      setValues(initialValues);
    }
  }, [productMetafields]);

  const handleSave = async (attributeId: number, value: string) => {
    try {
      await setMutation.mutateAsync({ attributeId, value });
      alert('Metafield updated successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to update metafield');
    }
  };

  const handleDelete = async (attributeId: number) => {
    try {
      await deleteMutation.mutateAsync(attributeId);
      setValues((prev) => {
        const next = { ...prev };
        delete next[attributeId];
        return next;
      });
    } catch (error: any) {
      alert(error.message || 'Failed to delete metafield');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Metafields</CardTitle>
        <CardDescription>Manage custom attributes for this product</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {metafields?.map((metafield) => (
          <div key={metafield.id} className="flex items-center gap-4">
            <div className="flex-1">
              <Label>{metafield.name}</Label>
              <Input
                value={values[metafield.id] || ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [metafield.id]: e.target.value }))
                }
                placeholder={`Enter ${metafield.name.toLowerCase()}`}
              />
            </div>
            {values[metafield.id] ? (
              <>
                <Button
                  onClick={() => handleSave(metafield.id, values[metafield.id])}
                  disabled={setMutation.isPending}
                >
                  Save
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(metafield.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleSave(metafield.id, values[metafield.id] || '')}
                disabled={setMutation.isPending}
              >
                Add
              </Button>
            )}
          </div>
        ))}
        {(!metafields || metafields.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No metafields available. Create metafields first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

