'use client';

import { CheckCircle2 } from 'lucide-react';

interface ShopifySyncStatusProps {
  shopifyId: string | null | undefined;
  isLoading?: boolean;
}

export function ShopifySyncStatus({ shopifyId, isLoading }: ShopifySyncStatusProps) {
  // Chỉ hiển thị tick nếu đã sync và không đang loading
  if (shopifyId && !isLoading) {
    return (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    );
  }

  // Không hiển thị gì nếu chưa sync
  return null;
}

