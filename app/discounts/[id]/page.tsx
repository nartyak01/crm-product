'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { DiscountForm } from '@/components/discount-form';
import { useDiscount, useUpdateDiscount } from '@/hooks/use-discounts';
import { UpdatePromotionInput } from '@/types/database';
import { useParams } from 'next/navigation';

export default function EditDiscountPage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);
  const { data: discount, isLoading } = useDiscount(id);
  const updateMutation = useUpdateDiscount();

  const handleSubmit = async (data: UpdatePromotionInput) => {
    try {
      await updateMutation.mutateAsync(data);
      router.push('/discounts');
    } catch (error: any) {
      alert(`Failed to update discount: ${error.message}`);
    }
  };

  const handleCancel = () => {
    router.push('/discounts');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-4xl">
            <div>Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (!discount) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-4xl">
            <div>Discount not found</div>
          </div>
        </main>
      </div>
    );
  }

  // Determine display type based on discount
  let displayType = '';
  if (discount.promo_type === 'bogo') {
    displayType = 'buy_x_get_y';
  } else if (discount.promo_type === 'free_shipping') {
    displayType = 'free_shipping';
  } else if (discount.discount_rule?.apply_to === 'order') {
    displayType = 'amount_off_order';
  } else {
    displayType = 'amount_off_products';
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Edit Discount</h1>
          <DiscountForm
            discount={discount}
            displayType={displayType}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={updateMutation.isPending}
          />
        </div>
      </main>
    </div>
  );
}

