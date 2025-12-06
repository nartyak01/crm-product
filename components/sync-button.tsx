'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncButtonProps {
  onSync: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  isSynced?: boolean;
}

export function SyncButton({
  onSync,
  isLoading = false,
  disabled = false,
  variant = 'outline',
  size = 'default',
  className,
  isSynced = false,
}: SyncButtonProps) {
  const isIconOnly = size === 'icon';
  const buttonText = isSynced ? 'Unsync from Shopify' : 'Sync to Shopify';
  
  return (
    <Button
      onClick={onSync}
      disabled={disabled || isLoading}
      variant={variant}
      size={size}
      className={cn(!isIconOnly && 'gap-2', className)}
      title={isIconOnly ? buttonText : undefined}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {!isIconOnly && 'Syncing...'}
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          {!isIconOnly && buttonText}
        </>
      )}
    </Button>
  );
}

