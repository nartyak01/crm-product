// Database types based on 005_product.sql schema

export type ProductType = 'standard' | 'custom' | 'variant' | 'set' | 'jewelry' | 'diamond' | 'gemstone';
export type ProductStatus = 'draft' | 'publish' | 'updated' | 'do_not_import';

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  shopify_collection_id?: string | null;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  product_type: ProductType;
  retail_price: number;
  sale_price: number;
  description: string;
  is_pre_order: boolean;
  promotion_id: number;
  created_at: string;
  updated_at: string;
  created_by_id: number | null;
  updated_by_id: number | null;
  status: ProductStatus;
  published_at: string | null;
  shopify_product_id?: string | null;
}

export interface ProductCategory {
  id: number;
  product_id: number;
  category_id: number;
  created_at: string;
}

export interface ProductAttribute {
  id: number;
  name: string;
  type: string;
  value: string;
  description: string;
  shopify_metafield_definition_id?: string | null;
}

export interface ProductAttributeValue {
  id: number;
  product_id: number;
  attribute_id: number;
  value: string;
  is_variant_value: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: number;
  product_id: number;
  thumbnail: string; // URL from media table (can be presigned_url if available)
  gallery: string; // JSON array or comma-separated URLs from media table
  updated_by_id: number | null;
  updated_at: string;
}

// API Request/Response types
export interface CreateProductInput {
  sku: string;
  name: string;
  product_type?: ProductType;
  retail_price?: number;
  sale_price?: number;
  description?: string;
  is_pre_order?: boolean;
  status?: ProductStatus;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: number;
}

export interface CreateCategoryInput {
  name: string;
  parent_id?: number | null;
}

export interface UpdateCategoryInput {
  id: number;
  name?: string;
  parent_id?: number;
}

export interface CreateMetafieldInput {
  name: string;
  type: string;
  value?: string;
  description?: string;
}

export interface UpdateMetafieldInput {
  id: number;
  name?: string;
  type?: string;
  value?: string;
  description?: string;
}

export interface ProductWithRelations extends Product {
  categories?: Category[];
  images?: ProductImage;
  metafields?: (ProductAttributeValue & { attribute: ProductAttribute })[];
}

export interface CategoryTree extends Category {
  children?: CategoryTree[];
}

export interface GroupedMetafield {
  name: string; // Metafield name (which is the type)
  type: string; // Attribute type
  values: string[]; // Array of attribute names in the same type
}

export interface Media {
  id: number;
  file_name: string;
  file_path: string; // S3 object key
  file_url: string; // Public URL
  presigned_url?: string; // Presigned URL for private buckets (valid for 1 hour)
  file_type: string; // MIME type
  file_size: number; // Size in bytes
  media_type: 'image' | 'video';
  bucket_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMediaInput {
  file_name: string;
  file_path: string;
  file_url: string;
  file_type: string;
  file_size: number;
  media_type: 'image' | 'video';
  bucket_name: string;
}

// Promotion types based on 007_promotion.sql schema
export type PromotionType = 'discount' | 'bogo' | 'bundle' | 'tiered' | 'free_shipping';
export type PromotionStatus = 'draft' | 'active' | 'paused' | 'expired' | 'archived' | 'update';
export type DiscountType = 'percentage' | 'fixed_amount' | 'fixed_price' | 'free_shipping';
export type DiscountApplyTo = 'order' | 'line_item' | 'shipping';
export type DiscountAllocationMethod = 'across' | 'each';
export type BogoBuyType = 'quantity' | 'amount' | 'specific_products';
export type BogoGetType = 'same_product' | 'specific_products' | 'cheapest' | 'any';
export type PromoCodeStatus = 'active' | 'used' | 'expired' | 'revoked';
export type InclusionType = 'include' | 'exclude';
export type BogoContext = 'buy_side' | 'get_side' | 'both';

export interface Promotion {
  id: number;
  promo_code: string;
  promo_name: string;
  promo_type: PromotionType;
  discount_type?: 'products' | 'orders' | null; // Phân biệt products/orders khi promo_type = 'discount'
  status: PromotionStatus;
  start_date: string | null;
  end_date: string | null;
  usage_limit_total: number | null;
  usage_count: number;
  usage_limit_per_customer: number | null;
  eligibility_rules: any | null; // JSONB
  platform_sync: any | null; // JSONB - stores Shopify discount_id, status, last_synced
  shopify_discount_id?: string | null; // Shopify Global ID (GID) of the discount synced to Shopify
  tenant_id: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionDiscountRule {
  id: number;
  promo_id: number;
  discount_type: DiscountType;
  discount_value: number | null;
  max_discount_amount: number | null;
  apply_to: DiscountApplyTo;
  allocation_method: DiscountAllocationMethod | null;
  minimum_purchase_type: 'none' | 'amount' | 'quantity' | null;
  minimum_purchase_amount: number | null;
  minimum_purchase_quantity: number | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionBogoRule {
  id: number;
  promo_id: number;
  buy_type: BogoBuyType;
  buy_quantity: number | null;
  buy_amount: number | null;
  buy_product_rules: any | null; // JSONB
  get_type: BogoGetType;
  get_quantity: number;
  get_product_rules: any | null; // JSONB
  max_applications_per_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionCode {
  id: number;
  promo_id: number;
  code: string;
  status: PromoCodeStatus;
  usage_limit: number | null;
  usage_count: number;
  assigned_to_customer_id: number | null;
  platform_sync: any | null; // JSONB
  first_used_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionEligibleProduct {
  id: number;
  promo_id: number;
  product_id: string | null;
  variant_id: string | null;
  collection_id: string | null;
  product_sku: string | null;
  inclusion_type: InclusionType;
  context: BogoContext | null;
  created_at: string;
}

export interface PromotionPriceOverride {
  id: number;
  promo_id: number;
  product_id: string | null;
  variant_id: string | null;
  product_sku: string | null;
  override_price: number;
  original_price: number | null;
  price_override_type: 'sale_price' | 'retail_price' | 'both';
  created_at: string;
  updated_at: string;
}

export interface PromotionWithRelations extends Promotion {
  discount_rule?: PromotionDiscountRule;
  bogo_rule?: PromotionBogoRule;
  codes?: PromotionCode[];
  eligible_products?: PromotionEligibleProduct[];
  price_overrides?: PromotionPriceOverride[];
}

// API Request/Response types
export interface CreatePromotionInput {
  promo_code: string;
  promo_name: string;
  promo_type: PromotionType;
  discount_type?: 'products' | 'orders' | null; // Chỉ dùng khi promo_type = 'discount'
  status?: PromotionStatus;
  start_date?: string | null;
  end_date?: string | null;
  usage_limit_total?: number | null;
  usage_limit_per_customer?: number | null;
  eligibility_rules?: any;
  tenant_id?: number;
  created_by?: number | null;
  // Discount rule (for discount type)
  discount_rule?: {
    discount_type: DiscountType;
    discount_value?: number | null;
    max_discount_amount?: number | null;
    apply_to: DiscountApplyTo;
    allocation_method?: DiscountAllocationMethod | null;
  };
  // BOGO rule (for bogo type)
  bogo_rule?: {
    buy_type: BogoBuyType;
    buy_quantity?: number | null;
    buy_amount?: number | null;
    buy_product_rules?: any;
    get_type: BogoGetType;
    get_quantity?: number;
    get_product_rules?: any;
    max_applications_per_order?: number | null;
  };
  // Codes
  codes?: Array<{
    code: string;
    usage_limit?: number | null;
    expires_at?: string | null;
  }>;
  // Eligible products
  eligible_products?: Array<{
    product_id?: string | null;
    variant_id?: string | null;
    collection_id?: string | null;
    product_sku?: string | null;
    inclusion_type: InclusionType;
    context?: BogoContext | null;
  }>;
  // Price overrides (for direct price changes)
  price_overrides?: Array<{
    product_id?: string | null;
    variant_id?: string | null;
    product_sku?: string | null;
    override_price: number;
    original_price?: number | null;
    price_override_type?: 'sale_price' | 'retail_price' | 'both';
  }>;
}

export interface UpdatePromotionInput extends Partial<CreatePromotionInput> {
  id: number;
}

