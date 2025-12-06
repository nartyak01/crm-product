'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useDiscount } from '@/hooks/use-discounts';
import { formatDate, formatDateShort } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DiscountDetailDialogProps {
  discountId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscountDetailDialog({ discountId, open, onOpenChange }: DiscountDetailDialogProps) {
  const { data: discount, isLoading } = useDiscount(discountId || 0);

  if (!discountId) return null;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div>Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!discount) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div>Discount not found</div>
        </DialogContent>
      </Dialog>
    );
  }

  const platformSync = discount.platform_sync as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{discount.promo_name}</DialogTitle>
          <DialogDescription>Discount Code: {discount.promo_code}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label>Type</Label>
                <div className="mt-1">
                  <Badge variant="outline">{discount.promo_type}</Badge>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <div className="mt-1">
                  <Badge
                    variant={
                      discount.status === 'active'
                        ? 'default'
                        : discount.status === 'draft'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {discount.status}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Start Date</Label>
                <div className="mt-1">{discount.start_date ? formatDate(discount.start_date) : 'Not set'}</div>
              </div>
              <div>
                <Label>End Date</Label>
                <div className="mt-1">{discount.end_date ? formatDate(discount.end_date) : 'Not set'}</div>
              </div>
              <div>
                <Label>Usage Count</Label>
                <div className="mt-1">
                  {discount.usage_count} / {discount.usage_limit_total || '∞'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Discount Rules */}
          {discount.discount_rule && (
            <Card>
              <CardHeader>
                <CardTitle>Discount Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label>Discount Type</Label>
                  <div className="mt-1">{discount.discount_rule.discount_type}</div>
                </div>
                <div>
                  <Label>Discount Value</Label>
                  <div className="mt-1">
                    {discount.discount_rule.discount_type === 'percentage'
                      ? `${discount.discount_rule.discount_value}%`
                      : `$${discount.discount_rule.discount_value}`}
                  </div>
                </div>
                <div>
                  <Label>Apply To</Label>
                  <div className="mt-1">{discount.discount_rule.apply_to}</div>
                </div>
                {discount.discount_rule.max_discount_amount && (
                  <div>
                    <Label>Max Discount Amount</Label>
                    <div className="mt-1">${discount.discount_rule.max_discount_amount}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* BOGO Rules */}
          {discount.bogo_rule && (
            <Card>
              <CardHeader>
                <CardTitle>Buy X Get Y Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label>Buy Type</Label>
                  <div className="mt-1">{discount.bogo_rule.buy_type}</div>
                </div>
                {discount.bogo_rule.buy_quantity && (
                  <div>
                    <Label>Buy Quantity</Label>
                    <div className="mt-1">{discount.bogo_rule.buy_quantity}</div>
                  </div>
                )}
                {discount.bogo_rule.buy_amount && (
                  <div>
                    <Label>Buy Amount</Label>
                    <div className="mt-1">${discount.bogo_rule.buy_amount}</div>
                  </div>
                )}
                <div>
                  <Label>Get Type</Label>
                  <div className="mt-1">{discount.bogo_rule.get_type}</div>
                </div>
                <div>
                  <Label>Get Quantity</Label>
                  <div className="mt-1">{discount.bogo_rule.get_quantity}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Codes */}
          {discount.codes && discount.codes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Discount Codes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {discount.codes.map((code) => (
                    <div key={code.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-mono font-medium">{code.code}</div>
                        <div className="text-sm text-muted-foreground">
                          Used: {code.usage_count} / {code.usage_limit || '∞'}
                        </div>
                      </div>
                      <Badge variant={code.status === 'active' ? 'default' : 'secondary'}>
                        {code.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shopify Sync Status */}
          {platformSync && (
            <Card>
              <CardHeader>
                <CardTitle>Shopify Sync</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    <Badge variant={platformSync.status === 'synced' ? 'default' : 'secondary'}>
                      {platformSync.status}
                    </Badge>
                  </div>
                </div>
                {(discount.shopify_discount_id || platformSync?.shopify_discount_id) && (
                  <div>
                    <Label>Shopify Discount ID</Label>
                    <div className="mt-1 font-mono text-sm">{discount.shopify_discount_id || platformSync?.shopify_discount_id}</div>
                  </div>
                )}
                {platformSync.last_synced && (
                  <div>
                    <Label>Last Synced</Label>
                    <div className="mt-1">{formatDate(platformSync.last_synced)}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

