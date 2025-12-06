'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProduct, useUpdateProduct } from '@/hooks/use-products';
import { useProductForm } from '@/hooks/use-product-form';
import { useProductImages, useUpdateProductImages } from '@/hooks/use-product-images';
import { useProductMetafields, useSetProductMetafield, useDeleteProductMetafield } from '@/hooks/use-metafields';
import { useCategoryTree, flattenCategoryTree } from '@/hooks/use-category-tree';
import { useMetafields } from '@/hooks/use-metafields';
import { useDiamond, useUpdateDiamond } from '@/hooks/use-diamond';
import { parseGallery, decodeDescription, formatImageUrl } from '@/lib/utils';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useUploadMedia } from '@/hooks/use-media';

interface ProductEditDialogProps {
  productId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProductEditDialog({ productId, open, onOpenChange, onSuccess }: ProductEditDialogProps) {
  const { data: product, isLoading } = useProduct(productId || 0);
  const form = useProductForm(product);
  const updateMutation = useUpdateProduct();
  const { data: images } = useProductImages(productId || 0);
  const updateImagesMutation = useUpdateProductImages(productId || 0);
  const { data: categories } = useCategoryTree();
  const { data: metafields } = useMetafields();
  const { data: productMetafields } = useProductMetafields(productId || 0);
  const setMetafieldMutation = useSetProductMetafield(productId || 0);
  const deleteMetafieldMutation = useDeleteProductMetafield(productId || 0);

  const [thumbnail, setThumbnail] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  // Store file_urls separately to find media records later
  const [thumbnailFileUrl, setThumbnailFileUrl] = useState('');
  const [galleryFileUrls, setGalleryFileUrls] = useState<Record<number, string>>({});
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [metafieldValues, setMetafieldValues] = useState<Record<string, string>>({});
  const [allAttributes, setAllAttributes] = useState<any[]>([]);

  // Diamond fields
  const { data: diamond } = useDiamond(productId || 0);
  const updateDiamondMutation = useUpdateDiamond(productId || 0);
  const [diamondFields, setDiamondFields] = useState<any>({});
  
  // Status state để đảm bảo Select hiển thị đúng giá trị
  const [statusValue, setStatusValue] = useState<string>('');

  // Upload refs and handlers
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadMedia();

  // Handler upload thumbnail
  const handleThumbnailUpload = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadMutation.mutateAsync(formData);
      console.log('📤 [Upload] Thumbnail upload result:', result);
      // Store file_url for finding media record later
      if (result?.file_url) {
        setThumbnailFileUrl(result.file_url);
      }
      // Use presigned_url for display if available, otherwise use file_url
      const urlToUse = result?.presigned_url || result?.file_url;
      if (urlToUse) {
        console.log('✅ [Upload] Setting thumbnail URL (presigned):', urlToUse);
        setThumbnail(urlToUse);
      }
    } catch (error: any) {
      console.error('Failed to upload thumbnail:', error);
      alert(`Failed to upload thumbnail: ${error.message || 'Unknown error'}`);
    }
  }, [uploadMutation]);

  // Handler upload gallery
  const handleGalleryUpload = useCallback(async (files: FileList) => {
    try {
      const fileArray = Array.from(files);
      const uploadedUrls: string[] = [];
      const fileUrlMap: Record<number, string> = {};
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const formData = new FormData();
        formData.append('file', file);
        const result = await uploadMutation.mutateAsync(formData);
        console.log('📤 [Upload] Gallery image upload result:', result);
        // Store file_url for finding media record later
        if (result?.file_url) {
          fileUrlMap[gallery.length + i] = result.file_url;
        }
        // Use presigned_url for display if available, otherwise use file_url
        const urlToUse = result?.presigned_url || result?.file_url;
        if (urlToUse) {
          uploadedUrls.push(urlToUse);
        }
      }
      
      if (uploadedUrls.length > 0) {
        console.log('✅ [Upload] Setting gallery URLs (presigned):', uploadedUrls);
        setGallery(prev => {
          const newGallery = [...prev, ...uploadedUrls];
          // Update file URL map
          setGalleryFileUrls(prevMap => {
            const newMap = { ...prevMap };
            uploadedUrls.forEach((url, idx) => {
              const originalIdx = prev.length + idx;
              if (fileUrlMap[originalIdx]) {
                newMap[originalIdx] = fileUrlMap[originalIdx];
              }
            });
            return newMap;
          });
          return newGallery;
        });
      }
    } catch (error: any) {
      console.error('Failed to upload gallery images:', error);
      alert(`Failed to upload gallery images: ${error.message || 'Unknown error'}`);
    }
  }, [uploadMutation, gallery.length]);

  // Handler xóa ảnh khỏi gallery
  const handleRemoveGalleryImage = (index: number) => {
    setGallery(prev => prev.filter((_, i) => i !== index));
    // Also remove from file_url map and reindex
    setGalleryFileUrls(prev => {
      const newMap: Record<number, string> = {};
      let newIndex = 0;
      Object.keys(prev).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex !== index) {
          // Reindex: if oldIndex < index, keep same; if oldIndex > index, decrease by 1
          if (oldIndex < index) {
            newMap[oldIndex] = prev[oldIndex];
          } else if (oldIndex > index) {
            newMap[oldIndex - 1] = prev[oldIndex];
          }
        }
      });
      return newMap;
    });
  };

  // Log product data when dialog opens or product loads
  useEffect(() => {
    if (open && productId) {
      console.log('📋 [Product Edit Dialog] Dialog opened for product ID:', productId);
    } else if (!open) {
      // Reset status value khi dialog đóng
      setStatusValue('');
      // Reset form khi dialog đóng
      form.reset();
    }
  }, [open, productId, form]);

  // Log product data when product is loaded
  useEffect(() => {
    if (product) {
      console.log('📦 [Product Edit Dialog] Product data loaded:', {
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

  // Reset form and set status value when product loads
  useEffect(() => {
    if (product) {
      const status = product.status || 'draft';
      console.log('🔄 [Product Edit] Resetting form with product data:', {
        sku: product.sku,
        name: product.name,
        product_type: product.product_type,
        status: status,
        statusType: typeof status,
        currentStatusValue: statusValue,
      });
      
      // Set statusValue TRƯỚC khi reset form để Select có giá trị ngay
      console.log('✅ [Product Edit] Setting status value to:', status);
      setStatusValue(status);
      
      // Reset form với tất cả giá trị
      form.reset({
        sku: product.sku || '',
        name: product.name || '',
        product_type: product.product_type || 'standard',
        retail_price: product.retail_price || 0,
        sale_price: product.sale_price || 0,
        description: decodeDescription(product.description) || '',
        is_pre_order: product.is_pre_order || false,
        status: status,
      });
    }
  }, [product]);

  // Load images - format based on product type
  useEffect(() => {
    if (images) {
      console.log('🖼️ [Images] Loading images from database:', {
        thumbnail: images.thumbnail,
        gallery: images.gallery,
        product_type: product?.product_type,
        diamond_image_path: diamond?.image_path,
      });
      
      // For diamond products, use diamond.image_path if available
      if (product?.product_type === 'diamond' && diamond?.image_path) {
        console.log('💎 [Images] Setting diamond image:', diamond.image_path);
        setThumbnail(diamond.image_path);
        setGallery(diamond.image_path ? [diamond.image_path] : []);
      } else {
        // For jewelry and other types, format URLs
        // Note: URLs in product_image are already presigned URLs from media table if available
        const thumbnailUrl = images.thumbnail 
          ? formatImageUrl(images.thumbnail, product?.product_type)
          : '';
        const galleryUrls = parseGallery(images.gallery || '').map(url => 
          formatImageUrl(url, product?.product_type)
        );
        console.log('🖼️ [Images] Setting thumbnail and gallery:', {
          thumbnailUrl,
          galleryUrls,
        });
        setThumbnail(thumbnailUrl);
        setGallery(galleryUrls);
        // Reset file_url states when loading from database (URLs are already presigned)
        setThumbnailFileUrl('');
        setGalleryFileUrls({});
      }
    } else {
      console.log('⚠️ [Images] No images data available');
    }
  }, [images, product?.product_type, diamond?.image_path]);

  // Reset images when dialog closes
  useEffect(() => {
    if (!open) {
      setThumbnail('');
      setGallery([]);
      setThumbnailFileUrl('');
      setGalleryFileUrls({});
    }
  }, [open]);

  // Load categories
  useEffect(() => {
    if (product?.categories) {
      setSelectedCategories(product.categories.map((c: any) => c.id));
    }
  }, [product]);

  // Load all attributes with brand_id = 4
  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        const response = await fetch('/api/metafields/all-attributes?brand_id=4');
        if (response.ok) {
          const attributes = await response.json();
          setAllAttributes(attributes);
        }
      } catch (error) {
        console.error('Failed to fetch attributes:', error);
      }
    };
    fetchAttributes();
  }, []);

  // Load diamond data
  useEffect(() => {
    if (diamond) {
      console.log('💎 [Product Edit Dialog] Diamond data loaded:', {
        product_id: diamond.product_id,
        shape: diamond.shape,
        cut_grade: diamond.cut_grade,
        carat: diamond.carat,
        color: diamond.color,
        clarity: diamond.clarity,
        grading_lab: diamond.grading_lab,
        certificate_number: diamond.certificate_number,
        fullDiamondData: diamond,
      });
      setDiamondFields({
        shape: diamond.shape || '',
        cut_grade: diamond.cut_grade || '',
        carat: diamond.carat || 0,
        color: diamond.color || '',
        clarity: diamond.clarity || '',
        grading_lab: diamond.grading_lab || '',
        certificate_number: diamond.certificate_number || '',
        certificate_path: diamond.certificate_path || '',
        image_path: diamond.image_path || '',
        total_price: diamond.total_price || 0,
        measurement_length: diamond.measurement_length || 0,
        measurement_width: diamond.measurement_width || 0,
        measurement_height: diamond.measurement_height || 0,
        country: diamond.country || '',
        state_region: diamond.state_region || '',
        guaranteed_availability: diamond.guaranteed_availability || false,
        item_id: diamond.item_id || '',
      });
    } else if (product?.product_type === 'diamond') {
      console.log('💎 [Product Edit Dialog] Product is diamond type but no diamond record found');
      // Initialize empty diamond fields if product is diamond but no diamond record exists
      setDiamondFields({
        shape: '',
        cut_grade: '',
        carat: 0,
        color: '',
        clarity: '',
        grading_lab: '',
        certificate_number: '',
        certificate_path: '',
        image_path: '',
        total_price: 0,
        measurement_length: 0,
        measurement_width: 0,
        measurement_height: 0,
        country: '',
        state_region: '',
        guaranteed_availability: false,
        item_id: '',
      });
    }
  }, [diamond, product]);

  // Load metafields - map by metafield type (name)
  useEffect(() => {
    if (productMetafields && allAttributes.length > 0) {
      const initialValues: Record<string, string> = {};
      productMetafields.forEach((mf: any) => {
        // Find which metafield (type) this attribute belongs to
        const attribute = allAttributes.find((attr: any) => attr.id === mf.attribute_id);
        if (attribute) {
          // Find the metafield group by type
          const metafieldGroup = metafields?.find((mfGroup: any) => mfGroup.type === attribute.type);
          if (metafieldGroup) {
            initialValues[metafieldGroup.name] = attribute.name;
          }
        }
      });
      setMetafieldValues(initialValues);
    }
  }, [productMetafields, allAttributes, metafields]);

  const handleSubmit = async (data: any, e?: React.BaseSyntheticEvent) => {
    // Prevent default form submission and page reload
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!productId) {
      console.warn('⚠️ [Product Edit] No productId provided');
      return;
    }

    console.log('🚀 [Product Edit] Form submitted with data:', data);
    console.log('🚀 [Product Edit] Form validation errors:', form.formState.errors);
    console.log('🏷️ [Product Edit] Current metafieldValues state:', metafieldValues);
    console.log('🏷️ [Product Edit] MetafieldValues keys:', Object.keys(metafieldValues));
    console.log('🏷️ [Product Edit] MetafieldValues entries:', Object.entries(metafieldValues));

    // Check for validation errors and show detailed message
    const validationErrors = form.formState.errors;
    if (Object.keys(validationErrors).length > 0) {
      console.error('❌ [Product Edit] Form validation failed:', validationErrors);
      
      // Build detailed error message
      const errorMessages: string[] = [];
      if (validationErrors.sku) errorMessages.push(`SKU: ${validationErrors.sku.message}`);
      if (validationErrors.name) errorMessages.push(`Name: ${validationErrors.name.message}`);
      if (validationErrors.product_type) errorMessages.push(`Product Type: ${validationErrors.product_type.message}`);
      if (validationErrors.retail_price) errorMessages.push(`Retail Price: ${validationErrors.retail_price.message}`);
      if (validationErrors.sale_price) errorMessages.push(`Sale Price: ${validationErrors.sale_price.message}`);
      if (validationErrors.status) errorMessages.push(`Status: ${validationErrors.status.message}`);
      
      // Validation errors logged to console
      return;
    }

    // Get current product data for comparison
    const currentProduct = product;
    const currentCategoryIds = product?.categories?.map((c: any) => c.id) || [];
    const flatCategories = categories ? flattenCategoryTree(categories) : [];
    const categoryNames = flatCategories
      .filter(cat => selectedCategories.includes(cat.id))
      .map(cat => ({ id: cat.id, name: cat.name }));

    // Prepare all data to log
    const productData = {
      // Basic Product Info
      product: {
        id: productId,
        current: {
          sku: currentProduct?.sku,
          name: currentProduct?.name,
          product_type: currentProduct?.product_type,
          retail_price: currentProduct?.retail_price,
          sale_price: currentProduct?.sale_price,
          description: currentProduct?.description,
          is_pre_order: currentProduct?.is_pre_order,
          status: currentProduct?.status,
        },
        updated: {
          sku: data.sku,
          name: data.name,
          product_type: data.product_type,
          retail_price: data.retail_price,
          sale_price: data.sale_price,
          description: data.description,
          is_pre_order: data.is_pre_order,
          status: data.status,
        },
      },
      // Images
      images: {
        current: {
          thumbnail: images?.thumbnail || '',
          gallery: images?.gallery || '',
          galleryCount: parseGallery(images?.gallery || '').length,
        },
        updated: {
          thumbnail: thumbnail,
          gallery: gallery,
          galleryCount: gallery.length,
        },
      },
      // Categories
      categories: {
        current: currentCategoryIds.map((id: number) => {
          const cat = flatCategories.find(c => c.id === id);
          return cat ? { id: cat.id, name: cat.name } : { id };
        }),
        selected: categoryNames,
        toAdd: selectedCategories.filter((id: number) => !currentCategoryIds.includes(id)).map((id: number) => {
          const cat = flatCategories.find(c => c.id === id);
          return cat ? { id: cat.id, name: cat.name } : { id };
        }),
        toRemove: currentCategoryIds.filter((id: number) => !selectedCategories.includes(id)).map((id: number) => {
          const cat = flatCategories.find(c => c.id === id);
          return cat ? { id: cat.id, name: cat.name } : { id };
        }),
      },
      // Diamond Fields (if applicable)
      diamond: product?.product_type === 'diamond' ? {
        current: diamond || null,
        updated: diamondFields,
      } : null,
      // Metafields
      metafields: {
        current: productMetafields?.map((mf: any) => ({
          id: mf.id,
          attribute_id: mf.attribute_id,
          attribute_name: mf.attribute.name,
          attribute_type: mf.attribute.type,
          value: mf.value,
        })) || [],
        selected: Object.entries(metafieldValues).map(([type, value]) => ({
          type,
          value,
        })),
      },
    };

    // Console log all product data
    console.log('📋 [Product Edit] ============================================');
    console.log('📋 [Product Edit] PRODUCT DATA TO UPDATE:');
    console.log('📋 [Product Edit] ============================================');
    console.log(JSON.stringify(productData, null, 2));
    console.log('📋 [Product Edit] ============================================');
    
    // Log detailed breakdown
    console.log('📦 [Product Edit] Basic Product Info:');
    console.log('  Current:', productData.product.current);
    console.log('  Updated:', productData.product.updated);
    
    console.log('🖼️ [Product Edit] Images:');
    console.log('  Current:', productData.images.current);
    console.log('  Updated:', productData.images.updated);
    
    console.log('📁 [Product Edit] Categories:');
    console.log('  Current:', productData.categories.current);
    console.log('  Selected:', productData.categories.selected);
    console.log('  To Add:', productData.categories.toAdd);
    console.log('  To Remove:', productData.categories.toRemove);
    
    if (productData.diamond) {
      console.log('💎 [Product Edit] Diamond Fields:');
      console.log('  Current:', productData.diamond.current);
      console.log('  Updated:', productData.diamond.updated);
    }
    
    console.log('🏷️ [Product Edit] Metafields:');
    console.log('  Current:', productData.metafields.current);
    console.log('  Selected:', productData.metafields.selected);

    // Now perform actual updates
    console.log('🔄 [Product Edit] Starting database updates...');
    const errors: string[] = [];

    try {
      // Update basic product info
      // Encode description if it exists
      const productUpdateData: any = { id: productId };
      if (data.sku !== undefined) productUpdateData.sku = data.sku;
      if (data.name !== undefined) productUpdateData.name = data.name;
      if (data.product_type !== undefined) productUpdateData.product_type = data.product_type;
      if (data.retail_price !== undefined) productUpdateData.retail_price = data.retail_price;
      if (data.sale_price !== undefined) productUpdateData.sale_price = data.sale_price;
      if (data.description !== undefined) {
        // Encode description if it contains special characters
        productUpdateData.description = encodeURIComponent(data.description);
      }
      if (data.is_pre_order !== undefined) productUpdateData.is_pre_order = data.is_pre_order;
      if (data.status !== undefined) productUpdateData.status = data.status;

      console.log('📝 [Product Edit] Updating basic product info...', productUpdateData);
      try {
        const updatedProduct = await updateMutation.mutateAsync(productUpdateData);
        console.log('✅ [Product Edit] Product updated successfully:', updatedProduct);
      } catch (error: any) {
        console.error('❌ [Product Edit] Failed to update product:', error);
        console.error('❌ [Product Edit] Product update error details:', {
          message: error.message,
          stack: error.stack,
          data: productUpdateData,
        });
        errors.push(`Product info: ${error.message || 'Update failed'}`);
      }
      
      // Update images
      console.log('🖼️ [Product Edit] Updating images...', { thumbnail, galleryCount: gallery.length });
      try {
        // Use file_url for saving (API route will find media and get presigned_url)
        // For thumbnail: use file_url if we have it, otherwise use thumbnail (might be from existing data)
        // If thumbnail is empty, send empty string to remove it
        const thumbnailToSave = thumbnail ? (thumbnailFileUrl || thumbnail) : '';
        
        // For gallery: map presigned URLs back to file_urls if we have them
        const galleryToSave = gallery.map((url, index) => {
          // If we have file_url for this index, use it; otherwise use the URL as-is
          return galleryFileUrls[index] || url;
        });
        
        // Always send gallery data (empty array if no images to remove all)
        const galleryData = JSON.stringify(galleryToSave);
        const imageData: { thumbnail?: string; gallery?: string } = {};
        
        // Always send thumbnail (empty string to remove, or URL to update)
        imageData.thumbnail = thumbnailToSave;
        // Always send gallery (empty array to remove all, or array with URLs to update)
        imageData.gallery = galleryData;
        
        console.log('🖼️ [Product Edit] Sending image data (file_urls for media lookup):', imageData);
        await updateImagesMutation.mutateAsync(imageData);
        console.log('✅ [Product Edit] Images updated successfully');
      } catch (error: any) {
        console.error('❌ [Product Edit] Failed to update images:', error);
        console.error('❌ [Product Edit] Image update error details:', {
          message: error.message,
          stack: error.stack,
          thumbnail,
          galleryLength: gallery.length,
        });
        errors.push(`Images: ${error.message || 'Update failed'}`);
      }
      
      // Update categories
      console.log('📁 [Product Edit] Updating categories...');
      try {
      // Remove categories that are no longer selected
      for (const categoryId of currentCategoryIds) {
        if (!selectedCategories.includes(categoryId)) {
            console.log(`🗑️ [Product Edit] Removing category ${categoryId}`);
            const response = await fetch(`/api/products/${productId}/categories?category_id=${categoryId}`, {
            method: 'DELETE',
          });
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Failed to remove category ${categoryId}`);
            }
        }
      }
      
      // Add new categories
      for (const categoryId of selectedCategories) {
        if (!currentCategoryIds.includes(categoryId)) {
            console.log(`➕ [Product Edit] Adding category ${categoryId} (type: ${typeof categoryId})`);
            try {
              const response = await fetch(`/api/products/${productId}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_id: categoryId }),
          });
              
              if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ [Product Edit] API Error Response:', errorData);
                const errorMessage = typeof errorData.error === 'string' 
                  ? errorData.error 
                  : errorData.error?.message || JSON.stringify(errorData);
                throw new Error(errorMessage || `Failed to add category ${categoryId}`);
              }
              
              const result = await response.json();
              console.log(`✅ [Product Edit] Category ${categoryId} added successfully:`, result);
            } catch (fetchError: any) {
              console.error(`❌ [Product Edit] Failed to add category ${categoryId}:`, fetchError);
              throw fetchError;
            }
          }
        }
        console.log('✅ [Product Edit] Categories updated successfully');
      } catch (error: any) {
        console.error('❌ [Product Edit] Failed to update categories:', error);
        errors.push(`Categories: ${error.message || 'Update failed'}`);
      }

      // Update metafields
      // Only update if product is not diamond type
      if (product?.product_type === 'diamond') {
        console.log('ℹ️ [Product Edit] Skipping metafields update - product is diamond type');
      } else {
        try {
          console.log('🏷️ [Product Edit] ========== START METAFIELDS UPDATE ==========');
          console.log('🏷️ [Product Edit] Product type:', product?.product_type);
          console.log('🏷️ [Product Edit] metafieldValues:', metafieldValues);
          console.log('🏷️ [Product Edit] metafieldValues type:', typeof metafieldValues);
          console.log('🏷️ [Product Edit] metafieldValues keys:', Object.keys(metafieldValues));
          console.log('🏷️ [Product Edit] metafieldValues entries:', Object.entries(metafieldValues));
          console.log('🏷️ [Product Edit] metafields available:', metafields?.map((mf: any) => mf.name));
          console.log('🏷️ [Product Edit] productMetafields:', productMetafields);
          console.log('🏷️ [Product Edit] allAttributes count:', allAttributes.length);
          
          // Check if metafieldValues is empty
          if (!metafieldValues || Object.keys(metafieldValues).length === 0) {
            console.warn('⚠️ [Product Edit] metafieldValues is empty! No metafields to update.');
          }
        
        // Get current metafields to compare - map by metafield name to attribute_id and attribute name
        const currentMetafieldMap = new Map<string, { attributeId: number; attributeName: string }>();
        productMetafields?.forEach((mf: any) => {
          const attribute = allAttributes.find((attr: any) => attr.id === mf.attribute_id);
          if (attribute) {
            const metafieldGroup = metafields?.find((mfGroup: any) => mfGroup.type === attribute.type);
            if (metafieldGroup) {
              currentMetafieldMap.set(metafieldGroup.name, {
                attributeId: mf.attribute_id,
                attributeName: attribute.name
              });
            }
          }
        });

        // Delete metafields that were removed or changed
        for (const [metafieldName, currentData] of currentMetafieldMap.entries()) {
          const selectedValue = metafieldValues[metafieldName];
          // If metafield was removed (empty) or value changed
          if (!selectedValue || selectedValue !== currentData.attributeName) {
            console.log(`🗑️ [Product Edit] Removing metafield ${metafieldName} (attribute_id ${currentData.attributeId})`);
            await deleteMetafieldMutation.mutateAsync(currentData.attributeId);
          }
        }

        // Add/update metafields
        for (const [metafieldName, selectedValue] of Object.entries(metafieldValues)) {
          if (!selectedValue) continue;
          
          const metafieldGroup = metafields?.find((mf: any) => mf.name === metafieldName);
          if (!metafieldGroup) {
            console.warn(`⚠️ [Product Edit] Metafield group "${metafieldName}" not found`);
            continue;
          }
          
          const currentData = currentMetafieldMap.get(metafieldName);
          const currentValue = currentData?.attributeName;
          
          // Only update if value changed or is new
          if (currentValue !== selectedValue) {
            const attributeId = findAttributeId(selectedValue, metafieldGroup.type);
            if (attributeId) {
              // Ensure attributeId is a number
              const numericAttributeId = typeof attributeId === 'string' ? parseInt(attributeId, 10) : attributeId;
              if (isNaN(numericAttributeId)) {
                console.error(`❌ [Product Edit] Invalid attributeId: ${attributeId} (type: ${typeof attributeId})`);
                throw new Error(`Invalid attribute ID: ${attributeId}`);
              }
              
              console.log(`➕ [Product Edit] Setting metafield ${metafieldName} = ${selectedValue} (attribute_id ${numericAttributeId}, type: ${typeof numericAttributeId})`);
              await setMetafieldMutation.mutateAsync({ 
                attributeId: numericAttributeId, 
                value: selectedValue 
              });
            } else {
              console.warn(`⚠️ [Product Edit] Attribute "${selectedValue}" not found for metafield "${metafieldName}" (type: ${metafieldGroup.type})`);
              const availableAttrs = allAttributes.filter((attr: any) => 
                attr.type?.toLowerCase() === metafieldGroup.type?.toLowerCase() && attr.brand_id === 4
              );
              console.warn(`⚠️ [Product Edit] Available attributes with type "${metafieldGroup.type}" (case-insensitive):`, availableAttrs.map((a: any) => ({ id: a.id, name: a.name, type: a.type })));
            }
          } else {
            console.log(`ℹ️ [Product Edit] Metafield ${metafieldName} unchanged (${selectedValue})`);
          }
        }
        
          console.log('✅ [Product Edit] Metafields updated successfully');
          console.log('🏷️ [Product Edit] ========== END METAFIELDS UPDATE ==========');
        } catch (error: any) {
          console.error('❌ [Product Edit] Failed to update metafields:', error);
          console.error('❌ [Product Edit] Error details:', {
            message: error.message,
            stack: error.stack,
            metafieldValues,
          });
          errors.push(`Metafields: ${error.message || 'Update failed'}`);
        }
      }

      // Note: Diamond fields update will be handled separately via "Save Diamond Fields" button

      if (errors.length > 0) {
        console.warn('⚠️ [Product Edit] Some updates failed:', errors);
      } else {
        console.log('🎉 [Product Edit] All updates completed successfully!');
      }
      
      // Invalidate queries to refresh data without page reload
      // React Query mutations already invalidate queries automatically
      // Close dialog - data will be refreshed via query invalidation
      onOpenChange(false);
      
      // Call onSuccess callback (but it should not reload page)
      onSuccess?.();
    } catch (error: any) {
      console.error('❌ [Product Edit] Update failed:', error);
      console.error('❌ [Product Edit] Error details:', {
        message: error.message,
        stack: error.stack,
        productId,
      });
    }
  };

  const handleToggleCategory = (categoryId: number) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Find attribute ID by name and type
  // Note: allAttributes đã được filter brand_id = 4 rồi, không cần check lại
  const findAttributeId = (attributeName: string, type: string): number | null => {
    console.log(`🔍 [findAttributeId] Searching for: name="${attributeName}", type="${type}"`);
    console.log(`🔍 [findAttributeId] allAttributes count: ${allAttributes.length}`);
    
    // Try exact match first (allAttributes đã filter brand_id = 4)
    let attribute = allAttributes.find(
      (attr: any) => attr.name === attributeName && attr.type === type
    );
    
    if (attribute) {
      console.log(`✅ [findAttributeId] Found exact match:`, attribute);
      // Ensure id is a number
      const id = typeof attribute.id === 'string' ? parseInt(attribute.id, 10) : attribute.id;
      if (isNaN(id)) {
        console.error(`❌ [findAttributeId] Invalid id type: ${attribute.id} (${typeof attribute.id})`);
        return null;
      }
      return id;
    }
    
    // Try case-insensitive match for type
    attribute = allAttributes.find(
      (attr: any) => 
        attr.name === attributeName && 
        attr.type?.toLowerCase() === type?.toLowerCase()
    );
    
    if (attribute) {
      console.log(`✅ [findAttributeId] Found case-insensitive match:`, attribute);
      // Ensure id is a number
      const id = typeof attribute.id === 'string' ? parseInt(attribute.id, 10) : attribute.id;
      if (isNaN(id)) {
        console.error(`❌ [findAttributeId] Invalid id type: ${attribute.id} (${typeof attribute.id})`);
        return null;
      }
      return id;
    }
    
    // Log all attributes with matching name for debugging
    const matchingName = allAttributes.filter((attr: any) => attr.name === attributeName);
    console.log(`⚠️ [findAttributeId] Attributes with name "${attributeName}":`, matchingName);
    
    // Log all attributes with matching type for debugging
    const matchingType = allAttributes.filter((attr: any) => 
      attr.type?.toLowerCase() === type?.toLowerCase()
    );
    console.log(`⚠️ [findAttributeId] Attributes with type "${type}" (case-insensitive):`, matchingType);
    
    // Check if the attribute found by name has the correct type (case-insensitive)
    if (matchingName.length > 0) {
      const foundAttr = matchingName[0];
      console.log(`⚠️ [findAttributeId] Found attribute by name:`, {
        id: foundAttr.id,
        name: foundAttr.name,
        type: foundAttr.type,
        brand_id: foundAttr.brand_id,
        expectedType: type,
        typeMatch: foundAttr.type?.toLowerCase() === type?.toLowerCase()
      });
      
      // If type matches (case-insensitive), use it (brand_id đã được filter rồi)
      if (foundAttr.type?.toLowerCase() === type?.toLowerCase()) {
        console.log(`✅ [findAttributeId] Using attribute found by name (type matches case-insensitive):`, foundAttr);
        // Ensure id is a number
        const id = typeof foundAttr.id === 'string' ? parseInt(foundAttr.id, 10) : foundAttr.id;
        if (isNaN(id)) {
          console.error(`❌ [findAttributeId] Invalid id type: ${foundAttr.id} (${typeof foundAttr.id})`);
          return null;
        }
        return id;
      } else {
        console.warn(`⚠️ [findAttributeId] Type mismatch: found "${foundAttr.type}" but expected "${type}"`);
      }
    }
    
    console.log(`❌ [findAttributeId] No match found for name="${attributeName}", type="${type}"`);
    return null;
  };

  const handleSaveMetafield = async (metafieldName: string, selectedValue: string) => {
    if (!productId || !selectedValue) return;
    
    try {
      // metafieldName is the type, selectedValue is the attribute name
      const attributeId = findAttributeId(selectedValue, metafieldName);
      
      if (!attributeId) {
        console.error(`❌ [Product Edit] Attribute "${selectedValue}" not found. Please ensure it exists in the system.`);
        return;
      }
      
      // Save the metafield - value is the attribute name
      await setMetafieldMutation.mutateAsync({ attributeId, value: selectedValue });
      setMetafieldValues((prev) => ({ ...prev, [metafieldName]: selectedValue }));
    } catch (error: any) {
      console.error('❌ [Product Edit] Failed to update metafield:', error);
    }
  };

  const handleDeleteMetafield = async (metafieldName: string) => {
    if (!productId) return;
    
    const selectedValue = metafieldValues[metafieldName];
    if (!selectedValue) return;
    
    try {
      const attributeId = findAttributeId(selectedValue, metafieldName);
      if (attributeId) {
        await deleteMetafieldMutation.mutateAsync(attributeId);
        setMetafieldValues((prev) => {
          const next = { ...prev };
          delete next[metafieldName];
          return next;
        });
      } else {
        console.error('❌ [Product Edit] Cannot find attribute to delete');
      }
    } catch (error: any) {
      console.error('❌ [Product Edit] Failed to delete metafield:', error);
    }
  };

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

  const flatCategories = categories ? flattenCategoryTree(categories) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Update product information</DialogDescription>
        </DialogHeader>

        <form 
          onSubmit={form.handleSubmit(handleSubmit, (errors) => {
            console.error('❌ [Product Edit] Form validation errors:', errors);
            // Build detailed error message
            const errorMessages: string[] = [];
            if (errors.sku) errorMessages.push(`SKU: ${errors.sku.message}`);
            if (errors.name) errorMessages.push(`Name: ${errors.name.message}`);
            if (errors.product_type) errorMessages.push(`Product Type: ${errors.product_type.message}`);
            if (errors.retail_price) errorMessages.push(`Retail Price: ${errors.retail_price.message}`);
            if (errors.sale_price) errorMessages.push(`Sale Price: ${errors.sale_price.message}`);
            if (errors.status) errorMessages.push(`Status: ${errors.status.message}`);
            
            // Validation errors logged to console
          })} 
          className="space-y-6 mt-4"
        >
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status - moved to top */}
                <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  key={`status-${productId}-${statusValue || product?.status || 'empty'}`}
                  value={statusValue || product?.status || form.getValues('status') || ''}
                  onValueChange={(value) => {
                    console.log('🔄 [Status Select] Value changed to:', value);
                    form.setValue('status', value as any, { shouldValidate: true });
                    setStatusValue(value); // Update state để Select re-render
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="publish">Published</SelectItem>
                    <SelectItem value="updated">Updated</SelectItem>
                    <SelectItem value="do_not_import">Do Not Import</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.status && (
                    <p className="text-sm text-destructive">
                    {form.formState.errors.status.message}
                  </p>
                )}
                {/* Debug info - remove after fix */}
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-muted-foreground">
                    Debug: statusValue={statusValue}, formStatus={form.getValues('status')}, productStatus={product?.status}
                    </p>
                  )}
                </div>

              {/* Name - full width for better display */}
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                <Input id="name" {...form.register('name')} className="w-full" />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
              </div>

              {/* SKU */}
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input id="sku" {...form.register('sku')} />
                  {form.formState.errors.sku && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.sku.message}
                    </p>
                  )}
                </div>

              {/* Product Type - read-only display (not editable) */}
              {product?.product_type && (
                <div className="space-y-2">
                  <Label>Product Type</Label>
                  <Input 
                    value={product.product_type} 
                    disabled 
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
              )}

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

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {product?.product_type === 'diamond' ? (
                // For diamond, show image_path from diamond table
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const result = await uploadMutation.mutateAsync(formData);
                            // Use presigned_url if available, otherwise use file_url
                            const urlToUse = result?.presigned_url || result?.file_url;
                            if (urlToUse) {
                              setDiamondFields({ ...diamondFields, image_path: urlToUse });
                            }
                            if (thumbnailInputRef.current) {
                              thumbnailInputRef.current.value = '';
                            }
                          } catch (error: any) {
                            console.error('Failed to upload diamond image:', error);
                            alert(`Failed to upload diamond image: ${error.message || 'Unknown error'}`);
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => thumbnailInputRef.current?.click()}
                      disabled={uploadMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadMutation.isPending ? 'Uploading...' : 'Upload Diamond Image'}
                    </Button>
                    {diamondFields.image_path && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDiamondFields({ ...diamondFields, image_path: '' });
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                  {diamondFields.image_path ? (
                    <div className="relative">
                      <img
                        src={diamondFields.image_path}
                        alt="Diamond Image"
                        className="w-full h-auto rounded-md border object-cover max-h-96"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No image available</p>
                  )}
                </div>
              ) : (
                // For jewelry and other types, show thumbnail and gallery in grid layout like detail dialog
                <div className="space-y-4">
                  {/* Upload Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleThumbnailUpload(file).then(() => {
                            if (thumbnailInputRef.current) {
                              thumbnailInputRef.current.value = '';
                            }
                          });
                        }
                      }}
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleGalleryUpload(e.target.files).then(() => {
                            if (galleryInputRef.current) {
                              galleryInputRef.current.value = '';
                            }
                          });
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => thumbnailInputRef.current?.click()}
                      disabled={uploadMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadMutation.isPending ? 'Uploading...' : 'Upload Thumbnail'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={uploadMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadMutation.isPending ? 'Uploading...' : 'Upload Gallery'}
                    </Button>
                  </div>

                  {/* Images Grid - Same layout as detail dialog */}
                  {thumbnail || gallery.length > 0 ? (
                    <div className="grid grid-cols-10 gap-4">
                      {/* Thumbnail - 4 columns, larger size */}
                      {thumbnail && (
                        <div className="col-span-4 relative group">
                          <img
                            src={thumbnail}
                            alt="Thumbnail"
                            className="w-full h-auto rounded-md border object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setThumbnail('');
                              setThumbnailFileUrl('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {/* Gallery - 6 columns, smaller images */}
                      {gallery.length > 0 && (
                        <div className={`col-span-6 grid grid-cols-2 md:grid-cols-3 gap-2 ${!thumbnail ? 'col-span-10' : ''}`}>
                          {gallery.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt={`Gallery ${index + 1}`}
                                className="w-full h-auto rounded-md border object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveGalleryImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
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
                {flatCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground">No categories available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Diamond Specifications */}
          {product?.product_type === 'diamond' && (
            <Card>
              <CardHeader>
                <CardTitle>Diamond Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shape">Shape</Label>
                    <Input
                      id="shape"
                      value={diamondFields.shape || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, shape: e.target.value })}
                      placeholder="Round, Princess, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cut_grade">Cut Grade</Label>
                    <Input
                      id="cut_grade"
                      value={diamondFields.cut_grade || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, cut_grade: e.target.value })}
                      placeholder="Excellent, Very Good, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carat">Carat</Label>
                    <Input
                      id="carat"
                      type="number"
                      step="0.001"
                      min="0"
                      value={diamondFields.carat || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, carat: parseFloat(e.target.value) || 0 })}
                      placeholder="0.650"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Input
                      id="color"
                      value={diamondFields.color || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, color: e.target.value })}
                      placeholder="D, E, F, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clarity">Clarity</Label>
                    <Input
                      id="clarity"
                      value={diamondFields.clarity || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, clarity: e.target.value })}
                      placeholder="VS1, VVS2, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grading_lab">Grading Lab</Label>
                    <Input
                      id="grading_lab"
                      value={diamondFields.grading_lab || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, grading_lab: e.target.value })}
                      placeholder="GIA, IGI, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="certificate_number">Certificate Number</Label>
                    <Input
                      id="certificate_number"
                      value={diamondFields.certificate_number || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, certificate_number: e.target.value })}
                      placeholder="5182112308"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item_id">Item ID</Label>
                    <Input
                      id="item_id"
                      value={diamondFields.item_id || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, item_id: e.target.value })}
                      placeholder="155556519"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total_price">Total Price</Label>
                    <Input
                      id="total_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={diamondFields.total_price || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, total_price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="measurement_length">Measurement Length (mm)</Label>
                    <Input
                      id="measurement_length"
                      type="number"
                      step="0.01"
                      min="0"
                      value={diamondFields.measurement_length || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, measurement_length: parseFloat(e.target.value) || 0 })}
                      placeholder="6.7"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="measurement_width">Measurement Width (mm)</Label>
                    <Input
                      id="measurement_width"
                      type="number"
                      step="0.01"
                      min="0"
                      value={diamondFields.measurement_width || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, measurement_width: parseFloat(e.target.value) || 0 })}
                      placeholder="5.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="measurement_height">Measurement Height (mm)</Label>
                    <Input
                      id="measurement_height"
                      type="number"
                      step="0.01"
                      min="0"
                      value={diamondFields.measurement_height || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, measurement_height: parseFloat(e.target.value) || 0 })}
                      placeholder="2.6"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={diamondFields.country || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, country: e.target.value })}
                      placeholder="Country of origin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state_region">State/Region</Label>
                    <Input
                      id="state_region"
                      value={diamondFields.state_region || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, state_region: e.target.value })}
                      placeholder="State or region"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="certificate_path">Certificate Path</Label>
                    <Input
                      id="certificate_path"
                      value={diamondFields.certificate_path || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, certificate_path: e.target.value })}
                      placeholder="https://example.com/certificate.pdf"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image_path">Image Path</Label>
                    <Input
                      id="image_path"
                      value={diamondFields.image_path || ''}
                      onChange={(e) => setDiamondFields({ ...diamondFields, image_path: e.target.value })}
                      placeholder="https://example.com/diamond.jpg"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="guaranteed_availability"
                    checked={diamondFields.guaranteed_availability || false}
                    onChange={(e) => setDiamondFields({ ...diamondFields, guaranteed_availability: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="guaranteed_availability" className="cursor-pointer">
                    Guaranteed Availability
                  </Label>
                </div>
                <Button
                  type="button"
                  onClick={async () => {
                    console.log('💎 [Product Edit] Saving diamond fields...', diamondFields);
                    try {
                      await updateDiamondMutation.mutateAsync(diamondFields);
                      console.log('✅ [Product Edit] Diamond fields updated successfully');
                    } catch (error: any) {
                      console.error('❌ [Product Edit] Failed to update diamond fields:', error);
                    }
                  }}
                  disabled={updateDiamondMutation.isPending}
                  className="w-full"
                >
                  {updateDiamondMutation.isPending ? 'Saving...' : 'Save Diamond Fields'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Metafields */}
          {metafields && metafields.length > 0 && product?.product_type !== 'diamond' && (
            <Card>
              <CardHeader>
                <CardTitle>Metafields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {metafields.map((metafield: any) => (
                  <div key={metafield.name} className="space-y-2">
                    <Label>{metafield.name} (Type: {metafield.type})</Label>
                      <Select
                        value={metafieldValues[metafield.name] || ''}
                        onValueChange={(value) => {
                          console.log(`🏷️ [Metafield Select] ${metafield.name} changed to:`, value);
                          setMetafieldValues((prev) => {
                            const updated = { ...prev, [metafield.name]: value };
                            console.log(`🏷️ [Metafield Select] Updated metafieldValues:`, updated);
                            return updated;
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${metafield.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {metafield.values.map((value: string) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending || updateImagesMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={updateMutation.isPending || updateImagesMutation.isPending}
            >
              {updateMutation.isPending || updateImagesMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

