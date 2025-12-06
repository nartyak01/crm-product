'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tag, ShoppingBag, Truck, Gift } from 'lucide-react';
import { PromotionType } from '@/types/database';

interface DiscountType {
  id: PromotionType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const discountTypes: DiscountType[] = [
  {
    id: 'discount',
    title: 'Amount off products',
    description: 'Discount specific products or collections of products',
    icon: <Tag className="h-6 w-6" />,
  },
  {
    id: 'bogo',
    title: 'Buy X get Y',
    description: 'Discount specific products or collections of products',
    icon: <Gift className="h-6 w-6" />,
  },
  {
    id: 'discount',
    title: 'Amount off order',
    description: 'Discount the total order amount',
    icon: <ShoppingBag className="h-6 w-6" />,
  },
  {
    id: 'free_shipping',
    title: 'Free shipping',
    description: 'Offer free shipping on an order',
    icon: <Truck className="h-6 w-6" />,
  },
];

interface DiscountTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: PromotionType, displayType: string) => void;
}

export function DiscountTypeSelector({ open, onOpenChange, onSelect }: DiscountTypeSelectorProps) {
  const handleSelect = (type: DiscountType) => {
    // For "Amount off order", we still use 'discount' type but with apply_to='order'
    // We'll pass a display type to distinguish
    let promoType: PromotionType = type.id;
    let displayType = type.title;

    if (type.title === 'Amount off order') {
      promoType = 'discount';
      displayType = 'amount_off_order';
    } else if (type.title === 'Amount off products') {
      promoType = 'discount';
      displayType = 'amount_off_products';
    }

    onSelect(promoType, displayType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select discount type</DialogTitle>
          <DialogDescription>Choose the type of discount you want to create</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          {discountTypes.map((type) => (
            <button
              key={type.title}
              onClick={() => handleSelect(type)}
              className="flex w-full items-center gap-4 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
            >
              <div className="flex-shrink-0 text-muted-foreground">{type.icon}</div>
              <div className="flex-1">
                <div className="font-medium">{type.title}</div>
                <div className="text-sm text-muted-foreground">{type.description}</div>
              </div>
              <div className="flex-shrink-0">→</div>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

