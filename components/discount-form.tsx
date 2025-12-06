'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { PromotionWithRelations, CreatePromotionInput, UpdatePromotionInput } from '@/types/database';
import { useProducts } from '@/hooks/use-products';
import { useCategories } from '@/hooks/use-categories';
import { X } from 'lucide-react';

interface FilterRow {
  id: string;
  type: 'product' | 'collection';
  inclusion_type: 'include' | 'exclude';
  selectedItems: string[];
  search: string;
}

interface DiscountFormProps {
  discount?: PromotionWithRelations;
  displayType?: string; // 'amount_off_products', 'amount_off_order', 'buy_x_get_y', 'free_shipping'
  onSubmit: (data: CreatePromotionInput | UpdatePromotionInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DiscountForm({ discount, displayType, onSubmit, onCancel, isLoading }: DiscountFormProps) {
  const [formData, setFormData] = useState({
    promo_code: discount?.promo_code || '',
    promo_name: discount?.promo_name || '',
    status: (discount?.status === 'update' ? 'ready_to_update' : (discount?.status || 'draft')) as 'draft' | 'active' | 'paused' | 'expired' | 'archived' | 'ready_to_update',
    start_date: discount?.start_date ? discount.start_date.split('T')[0] : '',
    end_date: discount?.end_date ? discount.end_date.split('T')[0] : '',
    usage_limit_total: discount?.usage_limit_total?.toString() || '',
    usage_limit_per_customer: discount?.usage_limit_per_customer?.toString() || '',
    // Discount code
    code: discount?.codes?.[0]?.code || '',
    // Discount rule fields
    discount_type: (discount?.discount_rule?.discount_type || 'percentage') as 'percentage' | 'fixed_amount',
    discount_value: discount?.discount_rule?.discount_value?.toString() || '',
    max_discount_amount: discount?.discount_rule?.max_discount_amount?.toString() || '',
    apply_to: (discount?.discount_rule?.apply_to || 'line_item') as 'order' | 'line_item',
    // Minimum purchase requirements
    minimum_purchase_type: (discount?.discount_rule?.minimum_purchase_type || 'none') as 'none' | 'amount' | 'quantity',
    minimum_purchase_amount: discount?.discount_rule?.minimum_purchase_amount?.toString() || '',
    minimum_purchase_quantity: discount?.discount_rule?.minimum_purchase_quantity?.toString() || '',
    // BOGO rule fields
    buy_type: (discount?.bogo_rule?.buy_type || 'quantity') as 'quantity' | 'amount',
    buy_quantity: discount?.bogo_rule?.buy_quantity?.toString() || '',
    buy_amount: discount?.bogo_rule?.buy_amount?.toString() || '',
    buy_items_from: 'all_products' as 'all_products' | 'specific_products' | 'specific_collections',
    get_quantity: discount?.bogo_rule?.get_quantity?.toString() || '1',
    get_items_from: 'same_products' as 'same_products' | 'specific_products' | 'cheapest',
    // Combination fields - support both new structure (combinesWith) and old structure (backward compatibility)
    can_combine_with_product_discounts: (() => {
      if (!discount) return false; // New discount: default to false
      const rules = discount.eligibility_rules as any;
      return rules?.combinesWith?.productDiscounts ?? rules?.can_combine_with_product_discounts ?? false;
    })(),
    can_combine_with_order_discounts: (() => {
      if (!discount) return false; // New discount: default to false
      const rules = discount.eligibility_rules as any;
      return rules?.combinesWith?.orderDiscounts ?? rules?.can_combine_with_order_discounts ?? false;
    })(),
    can_combine_with_shipping_discounts: (() => {
      if (!discount) return false; // New discount: default to false
      const rules = discount.eligibility_rules as any;
      return rules?.combinesWith?.shippingDiscounts ?? rules?.can_combine_with_shipping_discounts ?? false;
    })(),
    max_combinations: (discount?.eligibility_rules as any)?.max_combinations ?? 1, // Keep for UI display only
  });

  // State for discount method
  // Initialize based on whether discount has codes (for editing) or default to 'discount_code' (for new)
  const [discountMethod, setDiscountMethod] = useState<'discount_code' | 'automatic'>(() => {
    if (discount) {
      // If editing, check if discount has codes
      return discount.codes && discount.codes.length > 0 ? 'discount_code' : 'automatic';
    }
    return 'discount_code'; // Default for new discount
  });

  // Update discountMethod when discount changes
  useEffect(() => {
    if (discount) {
      const method = discount.codes && discount.codes.length > 0 ? 'discount_code' : 'automatic';
      setDiscountMethod(method);
    }
  }, [discount]);

  // Update formData when discount changes (for editing)
  useEffect(() => {
    if (discount) {
      // Update status and basic fields when discount is loaded
      setFormData(prev => ({
        ...prev,
        status: (discount.status === 'update' ? 'ready_to_update' : (discount.status || prev.status)) as 'draft' | 'active' | 'paused' | 'expired' | 'archived' | 'ready_to_update',
      }));
    }
    
    if (discount?.discount_rule) {
      const discountRule = discount.discount_rule;
      setFormData(prev => ({
        ...prev,
        // Update discount rule fields
        discount_type: (discountRule.discount_type || prev.discount_type) as 'percentage' | 'fixed_amount',
        discount_value: discountRule.discount_value?.toString() || prev.discount_value,
        max_discount_amount: discountRule.max_discount_amount?.toString() || prev.max_discount_amount,
        apply_to: (discountRule.apply_to || prev.apply_to) as 'order' | 'line_item',
        // Update minimum purchase requirements
        minimum_purchase_type: (discountRule.minimum_purchase_type ?? 'none') as 'none' | 'amount' | 'quantity',
        minimum_purchase_amount: discountRule.minimum_purchase_amount?.toString() || '',
        minimum_purchase_quantity: discountRule.minimum_purchase_quantity?.toString() || '',
      }));
    }
    // Update combination fields from eligibility_rules
    if (discount?.eligibility_rules) {
      const eligibilityRules = discount.eligibility_rules as any;
      setFormData(prev => ({
        ...prev,
        // Support both new structure (combinesWith) and old structure (backward compatibility)
        can_combine_with_product_discounts: 
          eligibilityRules.combinesWith?.productDiscounts ?? 
          eligibilityRules.can_combine_with_product_discounts ?? 
          prev.can_combine_with_product_discounts,
        can_combine_with_order_discounts: 
          eligibilityRules.combinesWith?.orderDiscounts ?? 
          eligibilityRules.can_combine_with_order_discounts ?? 
          prev.can_combine_with_order_discounts,
        can_combine_with_shipping_discounts: 
          eligibilityRules.combinesWith?.shippingDiscounts ?? 
          eligibilityRules.can_combine_with_shipping_discounts ?? 
          prev.can_combine_with_shipping_discounts,
        max_combinations: eligibilityRules.max_combinations ?? prev.max_combinations, // Keep for UI display only
      }));
    }
  }, [discount]);

  // State for customer eligibility
  const [customerEligibility, setCustomerEligibility] = useState<'all_customers' | 'specific_segments' | 'specific_customers'>(
    'all_customers'
  );

  // State for filters - dynamic filter rows
  const [filters, setFilters] = useState<FilterRow[]>(() => {
    if (!discount?.eligible_products || discount.eligible_products.length === 0) return [];
    
    // Group by type and inclusion_type to create filter rows
    const filterMap = new Map<string, FilterRow>();
    
    discount.eligible_products.forEach((ep) => {
      const type = ep.product_id ? 'product' : 'collection';
      const key = `${ep.inclusion_type}_${type}`;
      
      if (!filterMap.has(key)) {
        filterMap.set(key, {
          id: `filter_${Date.now()}_${Math.random()}`,
          type: type as 'product' | 'collection',
          inclusion_type: ep.inclusion_type as 'include' | 'exclude',
          selectedItems: [],
          search: '',
        });
      }
      
      const filter = filterMap.get(key)!;
      if (ep.product_id) {
        filter.selectedItems.push(ep.product_id.toString());
      } else if (ep.collection_id) {
        filter.selectedItems.push(ep.collection_id.toString());
      }
    });
    
    return Array.from(filterMap.values());
  });

  // State for BOGO sections
  const [selectedBuyItems, setSelectedBuyItems] = useState<string[]>([]);
  const [selectedGetItems, setSelectedGetItems] = useState<string[]>([]);

  // State for search/filter in multi-selects
  const [buyProductSearch, setBuyProductSearch] = useState('');
  const [getProductSearch, setGetProductSearch] = useState('');

  // Get all product searches from filters
  const productSearches = filters
    .filter(f => f.type === 'product' && f.search)
    .map(f => f.search);
  const productSearch = productSearches[0] || ''; // Use first search or empty

  // Get selected product IDs from filters (for editing - ensure they're fetched)
  const selectedProductIds = useMemo(() => {
    const ids: string[] = [];
    filters.forEach(f => {
      if (f.type === 'product') {
        ids.push(...f.selectedItems);
      }
    });
    return ids;
  }, [filters]);

  // Fetch products - shared for all product filters
  // When editing, fetch all products (no search) to ensure selected items are available
  const shouldFetchAllProducts = discount && selectedProductIds.length > 0 && !productSearch;
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    // When editing and no search, fetch all to include selected items
    search: shouldFetchAllProducts ? undefined : (productSearch || undefined),
    limit: shouldFetchAllProducts ? 1000 : 100, // Fetch more when editing to include selected items
    offset: 0,
  });

  // Fetch products for "Buy items"
  const { data: buyProductsData, isLoading: isLoadingBuyProducts } = useProducts({
    search: buyProductSearch || undefined,
    limit: 100,
    offset: 0,
  });

  // Fetch products for "Get items"
  const { data: getProductsData, isLoading: isLoadingGetProducts } = useProducts({
    search: getProductSearch || undefined,
    limit: 100,
    offset: 0,
  });

  // Fetch categories
  const { data: categoriesData, isLoading: isLoadingCategories } = useCategories(false);

  // Convert to options
  // Ensure selected items are always in options (even if not yet fetched)
  const productOptions: MultiSelectOption[] = useMemo(() => {
    const optionsMap = new Map<string, MultiSelectOption>();
    
    // Add fetched products
    if (productsData?.products) {
      productsData.products.forEach((product: any) => {
        optionsMap.set(product.id.toString(), {
          label: `${product.name} (${product.sku})`,
          value: product.id.toString(),
        });
      });
    }
    
    // Add selected items that might not be in fetched list (for editing)
    // These will be fetched separately or shown with placeholder
    selectedProductIds.forEach(productId => {
      if (!optionsMap.has(productId)) {
        // Fetch individual product if needed, or show placeholder
        // For now, add placeholder - will be replaced when product is fetched
        optionsMap.set(productId, {
          label: `Product ${productId}`, // Placeholder
          value: productId,
        });
      }
    });
    
    return Array.from(optionsMap.values());
  }, [productsData, selectedProductIds]);

  const buyProductOptions: MultiSelectOption[] = useMemo(() => {
    if (!buyProductsData?.products) return [];
    return buyProductsData.products.map((product: any) => ({
      label: `${product.name} (${product.sku})`,
      value: product.id.toString(),
    }));
  }, [buyProductsData]);

  const getProductOptions: MultiSelectOption[] = useMemo(() => {
    if (!getProductsData?.products) return [];
    return getProductsData.products.map((product: any) => ({
      label: `${product.name} (${product.sku})`,
      value: product.id.toString(),
    }));
  }, [getProductsData]);

  // Get selected collection IDs from filters (for editing)
  const selectedCollectionIds = useMemo(() => {
    const ids: string[] = [];
    filters.forEach(f => {
      if (f.type === 'collection') {
        ids.push(...f.selectedItems);
      }
    });
    return ids;
  }, [filters]);

  const collectionOptions: MultiSelectOption[] = useMemo(() => {
    const optionsMap = new Map<string, MultiSelectOption>();
    
    // Add fetched categories
    if (categoriesData) {
      categoriesData.forEach((category: any) => {
        optionsMap.set(category.id.toString(), {
          label: category.name,
          value: category.id.toString(),
        });
      });
    }
    
    // Add selected items that might not be in fetched list (for editing)
    selectedCollectionIds.forEach(collectionId => {
      if (!optionsMap.has(collectionId)) {
        // Add placeholder - will be replaced when category is fetched
        optionsMap.set(collectionId, {
          label: `Collection ${collectionId}`, // Placeholder
          value: collectionId,
        });
      }
    });
    
    return Array.from(optionsMap.values());
  }, [categoriesData, selectedCollectionIds]);

  // Functions to manage filters
  const addFilter = () => {
    const newFilter: FilterRow = {
      id: `filter_${Date.now()}_${Math.random()}`,
      type: 'product',
      inclusion_type: 'include',
      selectedItems: [],
      search: '',
    };
    setFilters([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterRow>) => {
    setFilters(filters.map(f => {
      if (f.id === id) {
        const updated = { ...f, ...updates };
        // Clear selectedItems when type changes
        if (updates.type && updates.type !== f.type) {
          updated.selectedItems = [];
        }
        return updated;
      }
      return f;
    }));
  };

  const updateFilterSearch = (id: string, search: string) => {
    updateFilter(id, { search });
  };

  const promoType = discount?.promo_type || (displayType === 'free_shipping' ? 'free_shipping' : 'discount');
  const isBogo = promoType === 'bogo' || displayType === 'buy_x_get_y';
  const isAmountOffOrder = displayType === 'amount_off_order';
  const isAmountOffProducts = displayType === 'amount_off_products' || (!displayType && !isBogo && promoType === 'discount');
  const isFreeShipping = promoType === 'free_shipping' || displayType === 'free_shipping';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Use code as promo_code if promo_code is not set, or generate one
    const promo_code = formData.promo_code || formData.code || `PROMO-${Date.now()}`;
    
    // Auto-generate promo_name for discount code method if not set
    const promo_name = discountMethod === 'discount_code' 
      ? (formData.promo_name.trim() || `coupon-${formData.code || promo_code}`)
      : formData.promo_name.trim();

    // Determine promo_type and discount_type
    let promo_type: string;
    let discount_type: 'products' | 'orders' | undefined;
    
    if (isBogo) {
      promo_type = 'bogo';
      discount_type = undefined;
    } else if (isFreeShipping) {
      promo_type = 'free_shipping';
      discount_type = undefined;
    } else {
      // For discount type, always use 'discount' and set discount_type
      promo_type = 'discount';
      discount_type = isAmountOffOrder ? 'orders' : 'products';
    }

    const submitData: any = {
      promo_code: promo_code,
      promo_name: promo_name,
      promo_type: promo_type,
      discount_type: discount_type,
      status: formData.status === 'ready_to_update' ? 'update' : formData.status, // Convert ready_to_update to update
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      usage_limit_total: formData.usage_limit_total ? parseInt(formData.usage_limit_total) : null,
      usage_limit_per_customer: formData.usage_limit_per_customer ? parseInt(formData.usage_limit_per_customer) : null,
      codes: formData.code ? [{ code: formData.code }] : [],
    };

    // Build eligible_products array from filters
    const eligible_products: any[] = [];

    filters.forEach((filter) => {
      filter.selectedItems.forEach((itemId) => {
        if (filter.type === 'product') {
          eligible_products.push({
            product_id: itemId,
            inclusion_type: filter.inclusion_type,
          });
        } else {
          eligible_products.push({
            collection_id: itemId,
            inclusion_type: filter.inclusion_type,
          });
        }
      });
    });

    submitData.eligible_products = eligible_products;

    // Add eligibility_rules with combination settings
    const existingRules = discount?.eligibility_rules || {};
    // Remove old structure fields if they exist
    const { 
      can_combine_with_product_discounts: _old1, 
      can_combine_with_order_discounts: _old2, 
      can_combine_with_shipping_discounts: _old3,
      combinesWith: _existingCombinesWith,
      max_combinations: _maxCombinations,
      ...otherRules 
    } = existingRules as any;

    submitData.eligibility_rules = {
      ...otherRules,
      combinesWith: {
        productDiscounts: formData.can_combine_with_product_discounts,
        orderDiscounts: formData.can_combine_with_order_discounts,
        shippingDiscounts: formData.can_combine_with_shipping_discounts,
      },
      // max_combinations is not saved to database
    };

    if (isBogo) {
      submitData.bogo_rule = {
        buy_type: formData.buy_type,
        buy_quantity: formData.buy_type === 'quantity' && formData.buy_quantity ? parseInt(formData.buy_quantity) : null,
        buy_amount: formData.buy_type === 'amount' && formData.buy_amount ? parseFloat(formData.buy_amount) : null,
        get_type: 'same_product', // Default
        get_quantity: formData.get_quantity ? parseInt(formData.get_quantity) : 1,
      };
    } else {
      submitData.discount_rule = {
        discount_type: isFreeShipping ? 'free_shipping' : formData.discount_type,
        discount_value: isFreeShipping ? null : (formData.discount_value ? parseFloat(formData.discount_value) : null),
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        apply_to: isAmountOffOrder ? 'order' : 'line_item',
        minimum_purchase_type: formData.minimum_purchase_type || 'none',
        minimum_purchase_amount: formData.minimum_purchase_type === 'amount' && formData.minimum_purchase_amount 
          ? parseFloat(formData.minimum_purchase_amount) 
          : null,
        minimum_purchase_quantity: formData.minimum_purchase_type === 'quantity' && formData.minimum_purchase_quantity 
          ? parseInt(formData.minimum_purchase_quantity) 
          : null,
      };
    }

    if (discount) {
      (submitData as UpdatePromotionInput).id = discount.id;
    }

    onSubmit(submitData);
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isBogo
              ? 'Buy X get Y'
              : isAmountOffOrder
              ? 'Amount off order'
              : isAmountOffProducts
              ? 'Amount off products'
              : isFreeShipping
              ? 'Free shipping'
              : 'Discount'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Method - Discount code or Automatic - Hide buttons when editing */}
          {!discount && (
            <div>
              <Label>Method</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={discountMethod === 'discount_code' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setDiscountMethod('discount_code')}
                >
                  Discount code
                </Button>
                <Button
                  type="button"
                  variant={discountMethod === 'automatic' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setDiscountMethod('automatic')}
                >
                  Automatic discount
                </Button>
              </div>
            </div>
          )}

          {/* Discount Code */}
          {discountMethod === 'discount_code' && (
            <div>
              <Label>Discount code</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter discount code"
                  required
                  disabled={!!discount} // Disable khi đang edit
                />
                {!discount && (
                  <Button type="button" variant="outline" onClick={generateRandomCode}>
                    Generate random code
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Customers must enter this code at checkout.
              </p>
              {discount && (
                <p className="text-sm text-muted-foreground mt-1">
                  Discount code cannot be changed after creation.
                </p>
              )}
            </div>
          )}
          {discountMethod === 'automatic' && (
            <div>
              <Label>Title</Label>
              <Input
                value={formData.promo_name}
                onChange={(e) => setFormData({ ...formData, promo_name: e.target.value })}
                placeholder="Enter discount title"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Customers will see this in their cart and at checkout.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discount Value (for non-BOGO) */}
      {!isBogo && !isFreeShipping && (
        <Card>
          <CardHeader>
            <CardTitle>Discount value</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value: 'percentage' | 'fixed_amount') =>
                    setFormData({ ...formData, discount_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed_amount">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Value</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder="0"
                    required
                  />
                  <span className="text-muted-foreground">
                    {formData.discount_type === 'percentage' ? '%' : '$'}
                  </span>
                </div>
              </div>
            </div>

            {formData.discount_type === 'percentage' && (
              <div>
                <Label>Maximum discount amount (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_discount_amount}
                  onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}

            {/* Minimum purchase requirements */}
            <div>
              <Label>Minimum purchase requirements</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={formData.minimum_purchase_type === 'none' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, minimum_purchase_type: 'none' })}
                >
                  No minimum requirements
                </Button>
                <Button
                  type="button"
                  variant={formData.minimum_purchase_type === 'amount' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, minimum_purchase_type: 'amount' })}
                >
                  Minimum purchase amount ($)
                </Button>
                <Button
                  type="button"
                  variant={formData.minimum_purchase_type === 'quantity' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, minimum_purchase_type: 'quantity' })}
                >
                  Minimum quantity of items
                </Button>
              </div>

              {formData.minimum_purchase_type === 'amount' && (
                <div className="mt-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.minimum_purchase_amount}
                    onChange={(e) => setFormData({ ...formData, minimum_purchase_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              )}

              {formData.minimum_purchase_type === 'quantity' && (
                <div className="mt-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={formData.minimum_purchase_quantity}
                    onChange={(e) => setFormData({ ...formData, minimum_purchase_quantity: e.target.value })}
                    placeholder="1"
                  />
                </div>
              )}
            </div>

            {isAmountOffProducts && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Filter</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addFilter}
                      className="text-primary"
                    >
                      + New filter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {filters.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No filters added. Click "+ New filter" to add one.</p>
                    </div>
                  ) : (
                    filters.map((filter) => (
                      <div key={filter.id} className="flex gap-2 items-start">
                        <Select
                          value={filter.type}
                          onValueChange={(value: 'product' | 'collection') =>
                            updateFilter(filter.id, { type: value })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="product">Product</SelectItem>
                            <SelectItem value="collection">Collection</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select
                          value={filter.inclusion_type}
                          onValueChange={(value: 'include' | 'exclude') =>
                            updateFilter(filter.id, { inclusion_type: value })
                          }
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="include">Include</SelectItem>
                            <SelectItem value="exclude">Exclude</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <div className="flex-1">
                          <MultiSelect
                            options={filter.type === 'product' ? productOptions : collectionOptions}
                            selected={filter.selectedItems}
                            onChange={(items) => updateFilter(filter.id, { selectedItems: items })}
                            placeholder={
                              filter.type === 'product'
                                ? 'Search and select products...'
                                : 'Search and select collections...'
                            }
                            onSearchChange={(search) => updateFilterSearch(filter.id, search)}
                            isLoading={
                              filter.type === 'product'
                                ? isLoadingProducts
                                : isLoadingCategories
                            }
                          />
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFilter(filter.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

          </CardContent>
        </Card>
      )}

      {/* BOGO Rules */}
      {isBogo && (
        <Card>
          <CardHeader>
            <CardTitle>Customer buys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Condition</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={formData.buy_type === 'quantity' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, buy_type: 'quantity' })}
                >
                  Minimum quantity of items
                </Button>
                <Button
                  type="button"
                  variant={formData.buy_type === 'amount' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, buy_type: 'amount' })}
                >
                  Minimum purchase amount
                </Button>
              </div>
            </div>

            {formData.buy_type === 'quantity' && (
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={formData.buy_quantity}
                  onChange={(e) => setFormData({ ...formData, buy_quantity: e.target.value })}
                  placeholder="1"
                  required
                />
              </div>
            )}

            {formData.buy_type === 'amount' && (
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.buy_amount}
                  onChange={(e) => setFormData({ ...formData, buy_amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            )}

            <div>
              <Label>Any items from</Label>
              <Select 
                value={formData.buy_items_from}
                onValueChange={(value: 'all_products' | 'specific_products' | 'specific_collections') =>
                  setFormData({ ...formData, buy_items_from: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_products">All products</SelectItem>
                  <SelectItem value="specific_products">Specific products</SelectItem>
                  <SelectItem value="specific_collections">Specific collections</SelectItem>
                </SelectContent>
              </Select>
              {formData.buy_items_from !== 'all_products' && (
                <div className="mt-2">
                  <MultiSelect
                    options={
                      formData.buy_items_from === 'specific_products'
                        ? buyProductOptions
                        : collectionOptions
                    }
                    selected={selectedBuyItems}
                    onChange={setSelectedBuyItems}
                    placeholder={
                      formData.buy_items_from === 'specific_products'
                        ? 'Search products...'
                        : 'Search collections...'
                    }
                    onSearchChange={
                      formData.buy_items_from === 'specific_products'
                        ? setBuyProductSearch
                        : undefined // Categories filter locally
                    }
                    isLoading={
                      formData.buy_items_from === 'specific_products'
                        ? isLoadingBuyProducts
                        : isLoadingCategories
                    }
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isBogo && (
        <Card>
          <CardHeader>
            <CardTitle>Customer gets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Customers must add the quantity of items specified below to their cart.
            </p>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                value={formData.get_quantity}
                onChange={(e) => setFormData({ ...formData, get_quantity: e.target.value })}
                placeholder="1"
                required
              />
            </div>
            <div>
              <Label>Any items from</Label>
              <Select 
                value={formData.get_items_from}
                onValueChange={(value: 'same_products' | 'specific_products' | 'cheapest') =>
                  setFormData({ ...formData, get_items_from: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same_products">Same products</SelectItem>
                  <SelectItem value="specific_products">Specific products</SelectItem>
                  <SelectItem value="cheapest">Cheapest items</SelectItem>
                </SelectContent>
              </Select>
              {formData.get_items_from === 'specific_products' && (
                <div className="mt-2">
                  <MultiSelect
                    options={getProductOptions}
                    selected={selectedGetItems}
                    onChange={setSelectedGetItems}
                    placeholder="Search products..."
                    onSearchChange={setGetProductSearch}
                    isLoading={isLoadingGetProducts}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combinations */}
      <Card>
        <CardHeader>
          <CardTitle>Combinations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Product discounts checkbox */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="product_discounts"
                checked={formData.can_combine_with_product_discounts}
                onChange={(e) =>
                  setFormData({ ...formData, can_combine_with_product_discounts: e.target.checked })
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <div className="flex-1">
                <label htmlFor="product_discounts" className="text-sm font-medium cursor-pointer">
                  Product discounts
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  Eligible product discounts will apply first
                </p>
              </div>
            </div>

            {/* Order discounts checkbox */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="order_discounts"
                checked={formData.can_combine_with_order_discounts}
                onChange={(e) =>
                  setFormData({ ...formData, can_combine_with_order_discounts: e.target.checked })
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <div className="flex-1">
                <label htmlFor="order_discounts" className="text-sm font-medium cursor-pointer">
                  Order discounts
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  All eligible order discounts will apply
                </p>
              </div>
            </div>

            {/* Shipping discounts checkbox */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="shipping_discounts"
                checked={formData.can_combine_with_shipping_discounts}
                onChange={(e) =>
                  setFormData({ ...formData, can_combine_with_shipping_discounts: e.target.checked })
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <div className="flex-1">
                <label htmlFor="shipping_discounts" className="text-sm font-medium cursor-pointer">
                  Shipping discounts
                </label>
              </div>
            </div>
          </div>

          {/* Combination info */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {formData.promo_name || formData.code || 'This discount'} could combine with{' '}
              <button
                type="button"
                onClick={() => {
                  const newValue = formData.max_combinations >= 10 ? 1 : formData.max_combinations + 1;
                  setFormData({ ...formData, max_combinations: newValue });
                }}
                className="text-primary underline font-medium hover:no-underline"
              >
                {formData.max_combinations}
              </button>{' '}
              discount{formData.max_combinations !== 1 ? 's' : ''} at checkout
            </p>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
            <svg
              className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-blue-700">
              Test different combinations to avoid unexpected reductions
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Eligibility */}
      <Card>
        <CardHeader>
          <CardTitle>Eligibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Available on all sales channels</p>
          <div>
            <Label>Customer eligibility</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={customerEligibility === 'all_customers' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setCustomerEligibility('all_customers')}
              >
                All customers
              </Button>
              <Button
                type="button"
                variant={customerEligibility === 'specific_segments' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setCustomerEligibility('specific_segments')}
              >
                Specific customer segments
              </Button>
              <Button
                type="button"
                variant={customerEligibility === 'specific_customers' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setCustomerEligibility('specific_customers')}
              >
                Specific customers
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: any) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="ready_to_update">Ready to Update</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start date</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>End date</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Usage limit (total)</Label>
              <Input
                type="number"
                value={formData.usage_limit_total}
                onChange={(e) => setFormData({ ...formData, usage_limit_total: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <Label>Usage limit per customer</Label>
              <Input
                type="number"
                value={formData.usage_limit_per_customer}
                onChange={(e) => setFormData({ ...formData, usage_limit_per_customer: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : discount ? 'Update Discount' : 'Create Discount'}
        </Button>
      </div>
    </form>
  );
}

