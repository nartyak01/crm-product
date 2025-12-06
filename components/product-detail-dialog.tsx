'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useProduct } from '@/hooks/use-products';
import { useProductImages } from '@/hooks/use-product-images';
import { useProductMetafields } from '@/hooks/use-metafields';
import { useDiamond } from '@/hooks/use-diamond';
import { formatCurrency, formatDate, parseGallery, decodeDescription, formatImageUrl } from '@/lib/utils';
import { Image as ImageIcon } from 'lucide-react';

interface ProductDetailDialogProps {
  productId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailDialog({ productId, open, onOpenChange }: ProductDetailDialogProps) {
  const { data: product, isLoading } = useProduct(productId || 0);
  const { data: images } = useProductImages(productId || 0);
  const { data: productMetafields } = useProductMetafields(productId || 0);
  const { data: diamond } = useDiamond(productId || 0);

  // Log when dialog opens
  useEffect(() => {
    if (open && productId) {
      console.log('👁️ [Product Detail Dialog] Dialog opened for product ID:', productId);
    }
  }, [open, productId]);

  // Log product data when loaded
  useEffect(() => {
    if (product) {
      console.log('📦 [Product Detail Dialog] Product data loaded:', {
        id: product.id,
        sku: product.sku,
        name: product.name,
        product_type: product.product_type,
        status: product.status,
        retail_price: product.retail_price,
        sale_price: product.sale_price,
        description: product.description,
        is_pre_order: product.is_pre_order,
        shopify_product_id: product.shopify_product_id,
        categories: product.categories?.map((c: any) => ({ id: c.id, name: c.name })) || [],
        metafields: product.metafields?.length || 0,
        images: product.images ? { thumbnail: product.images.thumbnail, galleryCount: parseGallery(product.images.gallery || '').length } : null,
        fullProductData: product,
      });
    }
  }, [product]);

  if (!productId) return null;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div>Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!product) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div>Product not found</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Format images based on product type
  const getThumbnailUrl = (): string => {
    if (product?.product_type === 'diamond' && diamond?.image_path) {
      return diamond.image_path;
    }
    if (images?.thumbnail) {
      return formatImageUrl(images.thumbnail, product?.product_type);
    }
    return '';
  };

  const getGalleryUrls = (): string[] => {
    if (product?.product_type === 'diamond') {
      // For diamond, use image_path if available
      if (diamond?.image_path) {
        return [diamond.image_path];
      }
      return [];
    }
    // For jewelry and other types, format gallery URLs
    const gallery = images ? parseGallery(images.gallery || '') : [];
    return gallery.map(url => formatImageUrl(url, product?.product_type));
  };

  const thumbnailUrl = getThumbnailUrl();
  const galleryUrls = getGalleryUrls();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>Product Details</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">SKU</Label>
                  <p className="font-mono text-sm mt-1">{product.sku}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Product Type</Label>
                  <p className="mt-1">{product.product_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="mt-1">
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
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Pre-order</Label>
                  <p className="mt-1">{product.is_pre_order ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Retail Price</Label>
                  <p className="mt-1 font-semibold">{formatCurrency(product.retail_price)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Sale Price</Label>
                  <p className="mt-1 font-semibold">{formatCurrency(product.sale_price)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created At</Label>
                  <p className="mt-1 text-sm">{formatDate(product.created_at)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Updated At</Label>
                  <p className="mt-1 text-sm">{formatDate(product.updated_at)}</p>
                </div>
              </div>
              {product.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1 whitespace-pre-wrap">{decodeDescription(product.description)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              {thumbnailUrl || galleryUrls.length > 0 ? (
                <div className="grid grid-cols-10 gap-4">
                  {/* Thumbnail - 4 columns, larger size */}
                  {thumbnailUrl && (
                    <div className="col-span-4">
                      <img
                        src={thumbnailUrl}
                        alt="Thumbnail"
                        className="w-full h-auto rounded-md border object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  {/* Gallery - 6 columns, smaller images */}
                  {galleryUrls.length > 0 && (
                    <div className={`col-span-6 grid grid-cols-2 md:grid-cols-3 gap-2 ${!thumbnailUrl ? 'col-span-10' : ''}`}>
                      {galleryUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <img
                            src={url}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-auto rounded-md border object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  No images available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Categories */}
          {product.categories && product.categories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {product.categories.map((category: any) => (
                    <span
                      key={category.id}
                      className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-sm font-medium"
                    >
                      {category.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metafields */}
          {productMetafields && productMetafields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Metafields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {productMetafields.map((mf: any) => (
                    <div key={mf.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <Label className="text-muted-foreground">{mf.attribute.name}</Label>
                      <p className="mt-1">{mf.value || '-'}</p>
                      {mf.attribute.type && (
                        <p className="text-xs text-muted-foreground mt-1">Type: {mf.attribute.type}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

