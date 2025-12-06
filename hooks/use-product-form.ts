'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProductType, ProductStatus } from '@/types/database';

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  product_type: z.enum(['jewelry', 'diamond', 'gemstone'], {
    errorMap: () => ({ message: 'Please select a valid product type' }),
  }),
  retail_price: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    },
    z.number().min(0, 'Retail price must be >= 0')
  ),
  sale_price: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    },
    z.number().min(0, 'Sale price must be >= 0')
  ),
  description: z.string().optional().nullable(),
  is_pre_order: z.boolean().optional().default(false),
  status: z.enum(['draft', 'publish', 'updated', 'do_not_import'], {
    errorMap: () => ({ message: 'Please select a valid status' }),
  }),
});

export type ProductFormData = z.infer<typeof productSchema>;

export function useProductForm(defaultValues?: Partial<ProductFormData>) {
  return useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: defaultValues?.sku || '',
      name: defaultValues?.name || '',
      product_type: defaultValues?.product_type || 'jewelry',
      retail_price: defaultValues?.retail_price || 0,
      sale_price: defaultValues?.sale_price || 0,
      description: defaultValues?.description || '',
      is_pre_order: defaultValues?.is_pre_order || false,
      status: defaultValues?.status || 'draft',
    },
  });
}

