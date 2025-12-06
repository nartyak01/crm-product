'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategoryTree, flattenCategoryTree } from '@/hooks/use-category-tree';
import { useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-categories';
import { FolderTree, Plus, Edit, Trash2 } from 'lucide-react';
import { CategoryTree } from '@/types/database';
import { ShopifySyncStatus } from '@/components/shopify-sync-status';

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategoryTree();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedParent, setSelectedParent] = useState<number | null>(null);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const flatCategories = categories ? flattenCategoryTree(categories) : [];

  const handleCreate = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: newCategoryName,
        parent_id: selectedParent || undefined,
      });
      setNewCategoryName('');
      setSelectedParent(null);
    } catch (error: any) {
      alert(error.message || 'Failed to create category');
    }
  };

  const handleUpdate = async (id: number, name: string) => {
    try {
      await updateMutation.mutateAsync({ id, name });
      setEditingId(null);
    } catch (error: any) {
      alert(error.message || 'Failed to update category');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error: any) {
        alert(error.message || 'Failed to delete category');
      }
    }
  };

  const renderCategoryTree = (items: CategoryTree[], level = 0) => {
    return items.map((category) => (
      <div key={category.id} className="space-y-2">
        <div
          className="flex items-center gap-2 rounded-md border p-3"
          style={{ marginLeft: `${level * 20}px` }}
        >
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          {editingId === category.id ? (
            <CategoryEditForm
              category={category}
              onSave={(name) => handleUpdate(category.id, name)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <span className="flex-1 font-medium">{category.name}</span>
              <ShopifySyncStatus shopifyId={category.shopify_collection_id} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingId(category.id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(category.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
        {category.children && category.children.length > 0 && (
          <div className="ml-4">
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderTree className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Categories</h1>
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>New Category</CardTitle>
              <CardDescription>Create a new category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Category Name</Label>
                <Input
                  id="category-name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent-category">Parent Category (optional)</Label>
                <Select
                  value={selectedParent?.toString() || 'none'}
                  onValueChange={(value) => setSelectedParent(value === 'none' ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Root Category)</SelectItem>
                    {flatCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {createMutation.isPending ? 'Creating...' : 'Create Category'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category Tree</CardTitle>
              <CardDescription>Manage your category hierarchy</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading...</div>
              ) : categories && categories.length > 0 ? (
                <div className="space-y-2">
                  {renderCategoryTree(categories)}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No categories yet. Create one above.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function CategoryEditForm({
  category,
  onSave,
  onCancel,
}: {
  category: CategoryTree;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category.name);

  return (
    <div className="flex flex-1 items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
        autoFocus
      />
      <Button size="sm" onClick={() => onSave(name)}>
        Save
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

