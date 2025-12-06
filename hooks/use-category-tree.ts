'use client';

import { useCategories } from './use-categories';
import { CategoryTree } from '@/types/database';

export function useCategoryTree() {
  const { data, ...rest } = useCategories(true);
  return {
    ...rest,
    data: data as CategoryTree[] | undefined,
  };
}

export function flattenCategoryTree(
  tree: CategoryTree[],
  result: CategoryTree[] = []
): CategoryTree[] {
  tree.forEach((category) => {
    result.push(category);
    if (category.children && category.children.length > 0) {
      flattenCategoryTree(category.children, result);
    }
  });
  return result;
}

