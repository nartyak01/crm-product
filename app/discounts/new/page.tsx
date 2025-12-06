'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { DiscountTypeSelector } from '@/components/discount-type-selector';
import { DiscountForm } from '@/components/discount-form';
import { useCreateDiscount } from '@/hooks/use-discounts';
import { CreatePromotionInput, PromotionType } from '@/types/database';

export default function NewDiscountPage() {
  const router = useRouter();
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [selectedType, setSelectedType] = useState<PromotionType | null>(null);
  const [displayType, setDisplayType] = useState<string>('');
  const createMutation = useCreateDiscount();

  const handleTypeSelect = (type: PromotionType, display: string) => {
    setSelectedType(type);
    setDisplayType(display);
    setShowTypeSelector(false);
  };

  const handleSubmit = async (data: CreatePromotionInput) => {
    try {
      const result = await createMutation.mutateAsync(data);
      router.push(`/discounts/${result.id}`);
    } catch (error: any) {
      alert(`Failed to create discount: ${error.message}`);
    }
  };

  const handleCancel = () => {
    router.push('/discounts');
  };

  if (showTypeSelector) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-7xl">
            <DiscountTypeSelector
              open={showTypeSelector}
              onOpenChange={setShowTypeSelector}
              onSelect={handleTypeSelect}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Create Discount</h1>
          <DiscountForm
            displayType={displayType}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createMutation.isPending}
          />
        </div>
      </main>
    </div>
  );
}

