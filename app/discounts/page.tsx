'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDiscounts } from '@/hooks/use-discounts';
import { useSyncDiscountToShopify } from '@/hooks/use-discount-sync';
import { formatDateShort } from '@/lib/utils';
import Link from 'next/link';
import { Tag, Plus, Search, Edit, Eye, Trash2 } from 'lucide-react';
import { ShopifySyncStatus } from '@/components/shopify-sync-status';
import { SyncButton } from '@/components/sync-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DiscountDetailDialog } from '@/components/discount-detail-dialog';
import { Badge } from '@/components/ui/badge';
import { useDeleteDiscount } from '@/hooks/use-discounts';

export default function DiscountsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [promoType, setPromoType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [syncingDiscountId, setSyncingDiscountId] = useState<number | null>(null);
  const limit = 20;

  const { data, isLoading } = useDiscounts({
    search: search || undefined,
    status: status !== 'all' ? status : undefined,
    promo_type: promoType !== 'all' ? promoType : undefined,
    limit,
    offset: page * limit,
  });

  const syncMutation = useSyncDiscountToShopify();
  const deleteMutation = useDeleteDiscount();

  const discounts = data?.promotions || [];
  const pagination = data?.pagination;

  const handleViewDetail = (discountId: number) => {
    setSelectedDiscountId(discountId);
    setIsDetailDialogOpen(true);
  };

  const handleSync = async (id: number) => {
    setSyncingDiscountId(id);
    try {
      await syncMutation.mutateAsync(id);
      alert('Discount synced to Shopify successfully!');
    } catch (error: any) {
      alert(`Failed to sync discount: ${error.message}`);
    } finally {
      setSyncingDiscountId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this discount?')) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
      alert('Discount deleted successfully!');
    } catch (error: any) {
      alert(`Failed to delete discount: ${error.message}`);
    }
  };

  const getDiscountTypeLabel = (promoType: string, discountType?: string) => {
    switch (promoType) {
      case 'discount':
        // Phân biệt "Amount off products" vs "Amount off orders"
        if (discountType === 'products') {
          return 'Amount off products';
        } else if (discountType === 'orders') {
          return 'Amount off orders';
        }
        return 'Amount off'; // Fallback nếu không có discount_type
      case 'bogo':
        return 'Buy X Get Y';
      case 'free_shipping':
        return 'Free shipping';
      default:
        return promoType;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Discounts</h1>
            </div>
            <Link href="/discounts/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Discount
              </Button>
            </Link>
          </div>

          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search discounts..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={promoType}
              onValueChange={(value) => {
                setPromoType(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="discount">Amount off</SelectItem>
                <SelectItem value="bogo">Buy X Get Y</SelectItem>
                <SelectItem value="free_shipping">Free shipping</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Shopify</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No discounts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      discounts.map((discount: any) => {
                        const platformSync = discount.platform_sync as any;
                        // Priority: use shopify_discount_id column first, then fallback to platform_sync
                        const shopifyId = discount.shopify_discount_id || platformSync?.shopify_discount_id;

                        return (
                          <TableRow key={discount.id}>
                            <TableCell className="font-mono text-sm">{discount.promo_code}</TableCell>
                            <TableCell>
                              <button
                                onClick={() => handleViewDetail(discount.id)}
                                className="font-medium hover:underline text-left"
                              >
                                {discount.promo_name}
                              </button>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getDiscountTypeLabel(discount.promo_type, discount.discount_type)}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`rounded-full px-2 py-1 text-xs ${getStatusColor(discount.status)}`}>
                                {discount.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {discount.usage_count} / {discount.usage_limit_total || '∞'}
                            </TableCell>
                            <TableCell>
                              <ShopifySyncStatus
                                shopifyId={shopifyId}
                                isLoading={syncingDiscountId === discount.id}
                              />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateShort(discount.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <SyncButton
                                  onSync={() => handleSync(discount.id)}
                                  isLoading={syncingDiscountId === discount.id}
                                  isSynced={!!shopifyId}
                                  size="icon"
                                  variant="ghost"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDetail(discount.id)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Link href={`/discounts/${discount.id}`}>
                                  <Button variant="ghost" size="icon" title="Edit">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(discount.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.total > limit && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {page * limit + 1} to {Math.min((page + 1) * limit, pagination.total)} of{' '}
                    {pagination.total} discounts
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!pagination.hasMore}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <DiscountDetailDialog
        discountId={selectedDiscountId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
      />
    </div>
  );
}

