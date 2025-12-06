'use client';

import { useState } from 'react';
import * as React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useMetafields } from '@/hooks/use-metafields';
import { useCreateMetafield, useUpdateMetafield, useDeleteMetafield } from '@/hooks/use-metafields';
import { Tag, Plus, Edit, Trash2 } from 'lucide-react';
import { ShopifySyncStatus } from '@/components/shopify-sync-status';

export default function MetafieldsPage() {
  const { data: metafields, isLoading } = useMetafields();
  
  // Fetch all attributes to get IDs for values
  React.useEffect(() => {
    if (!isLoading) {
      fetch('/api/metafields/all-attributes?brand_id=4')
        .then(res => res.json())
        .then(data => setAllAttributes(data))
        .catch(err => console.error('Failed to fetch attributes:', err));
    }
  }, [isLoading, metafields]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editingAttributeId, setEditingAttributeId] = useState<number | null>(null);
  const [newMetafieldName, setNewMetafieldName] = useState('');
  const [newMetafieldType, setNewMetafieldType] = useState('');
  const [newMetafieldValue, setNewMetafieldValue] = useState('');
  const [newMetafieldDescription, setNewMetafieldDescription] = useState('');
  
  const [editMetafieldName, setEditMetafieldName] = useState('');
  const [editMetafieldType, setEditMetafieldType] = useState('');
  const [editMetafieldValue, setEditMetafieldValue] = useState('');
  const [editMetafieldDescription, setEditMetafieldDescription] = useState('');
  
  // For managing values in popup
  const [isManageValuesDialogOpen, setIsManageValuesDialogOpen] = useState(false);
  const [selectedTypeForValues, setSelectedTypeForValues] = useState<string>('');
  const [selectedTypeName, setSelectedTypeName] = useState<string>('');
  const [valuesList, setValuesList] = useState<any[]>([]);
  const [newValueName, setNewValueName] = useState('');
  const [editingValueId, setEditingValueId] = useState<number | null>(null);
  const [editingValueName, setEditingValueName] = useState('');
  const [allAttributes, setAllAttributes] = useState<any[]>([]);
  
  const createMutation = useCreateMetafield();
  const updateMutation = useUpdateMetafield();
  const deleteMutation = useDeleteMetafield();

  const handleCreate = async () => {
    if (!newMetafieldName.trim() || !newMetafieldType.trim()) return;
    
    try {
      await createMutation.mutateAsync({
        name: newMetafieldName,
        type: newMetafieldType,
        value: newMetafieldValue || undefined,
        description: newMetafieldDescription || undefined,
      });
      setNewMetafieldName('');
      setNewMetafieldType('');
      setNewMetafieldValue('');
      setNewMetafieldDescription('');
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      alert(error.message || 'Failed to create metafield');
    }
  };

  const handleEdit = async (type: string) => {
    try {
      // Fetch all attributes of this type to get the first one for editing
      const response = await fetch(`/api/metafields/all-attributes?brand_id=4`);
      if (!response.ok) throw new Error('Failed to fetch attributes');
      
      const allAttributes = await response.json();
      const firstAttribute = allAttributes.find((attr: any) => attr.type === type);

      if (!firstAttribute) {
        alert('No attributes found for this type');
        return;
      }

      setEditingAttributeId(firstAttribute.id);
      setEditMetafieldName(firstAttribute.name);
      setEditMetafieldType(firstAttribute.type);
      setEditMetafieldValue(firstAttribute.value || '');
      setEditMetafieldDescription(firstAttribute.description || '');
      setEditingType(type);
      setIsEditDialogOpen(true);
    } catch (error: any) {
      alert(error.message || 'Failed to load metafield for editing');
    }
  };

  const handleUpdate = async () => {
    if (!editingAttributeId || !editMetafieldName.trim() || !editMetafieldType.trim()) return;
    
    try {
      await updateMutation.mutateAsync({
        id: editingAttributeId,
        name: editMetafieldName,
        type: editMetafieldType,
        value: editMetafieldValue || undefined,
        description: editMetafieldDescription || undefined,
      });
      setIsEditDialogOpen(false);
      setEditingType(null);
      setEditingAttributeId(null);
    } catch (error: any) {
      alert(error.message || 'Failed to update metafield');
    }
  };

  const handleManageValues = async (type: string, typeName: string) => {
    setSelectedTypeForValues(type);
    setSelectedTypeName(typeName);
    
    // Fetch all attributes of this type
    const response = await fetch(`/api/metafields/all-attributes?brand_id=4`);
    if (response.ok) {
      const attrs = await response.json();
      const typeAttributes = attrs.filter((attr: any) => attr.type === type);
      setValuesList(typeAttributes);
    }
    
    setNewValueName('');
    setEditingValueId(null);
    setEditingValueName('');
    setIsManageValuesDialogOpen(true);
  };

  const handleCreateValue = async () => {
    if (!newValueName.trim() || !selectedTypeForValues) return;
    
    try {
      // Get first attribute of this type to get description
      const firstAttr = valuesList[0];
      
      await createMutation.mutateAsync({
        name: newValueName,
        type: selectedTypeForValues,
        value: '',
        description: firstAttr?.description || '',
      });
      
      // Refresh values list
      const response = await fetch(`/api/metafields/all-attributes?brand_id=4`);
      if (response.ok) {
        const attrs = await response.json();
        const typeAttributes = attrs.filter((attr: any) => attr.type === selectedTypeForValues);
        setValuesList(typeAttributes);
      }
      
      // Sync metafield type to Shopify to update choices
      try {
        await fetch(`/api/metafields/sync?type=${encodeURIComponent(selectedTypeForValues)}&brand_id=4`, {
          method: 'POST',
        });
      } catch (syncError) {
        console.error('Failed to sync metafield to Shopify:', syncError);
      }
      
      setNewValueName('');
    } catch (error: any) {
      alert(error.message || 'Failed to add value');
    }
  };

  const handleStartEditValue = (value: any) => {
    setEditingValueId(value.id);
    setEditingValueName(value.name);
  };

  const handleCancelEditValue = () => {
    setEditingValueId(null);
    setEditingValueName('');
  };

  const handleUpdateValue = async (valueId: number) => {
    if (!editingValueName.trim()) return;
    
    try {
      const value = valuesList.find(v => v.id === valueId);
      if (!value) return;

      await updateMutation.mutateAsync({
        id: valueId,
        name: editingValueName,
        type: value.type,
        value: value.value || undefined,
        description: value.description || undefined,
      });
      
      // Refresh values list
      const response = await fetch(`/api/metafields/all-attributes?brand_id=4`);
      if (response.ok) {
        const attrs = await response.json();
        const typeAttributes = attrs.filter((attr: any) => attr.type === selectedTypeForValues);
        setValuesList(typeAttributes);
      }
      
      // Sync metafield type to Shopify to update choices
      try {
        await fetch(`/api/metafields/sync?type=${encodeURIComponent(selectedTypeForValues)}&brand_id=4`, {
          method: 'POST',
        });
      } catch (syncError) {
        console.error('Failed to sync metafield to Shopify:', syncError);
      }
      
      setEditingValueId(null);
      setEditingValueName('');
    } catch (error: any) {
      alert(error.message || 'Failed to update value');
    }
  };

  const handleDeleteValue = async (valueId: number, valueName: string) => {
    if (!confirm(`Are you sure you want to delete value "${valueName}"?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(valueId);
      
      // Refresh values list
      const response = await fetch(`/api/metafields/all-attributes?brand_id=4`);
      if (response.ok) {
        const attrs = await response.json();
        const typeAttributes = attrs.filter((attr: any) => attr.type === selectedTypeForValues);
        setValuesList(typeAttributes);
      }
      
      // Sync metafield type to Shopify to update choices
      try {
        await fetch(`/api/metafields/sync?type=${encodeURIComponent(selectedTypeForValues)}&brand_id=4`, {
          method: 'POST',
        });
      } catch (syncError) {
        console.error('Failed to sync metafield to Shopify:', syncError);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete value');
    }
  };

  const handleDelete = async (type: string) => {
    if (!confirm(`Are you sure you want to delete all metafields of type "${type}"? This will delete all attributes of this type.`)) {
      return;
    }

    try {
      // Fetch all attributes of this type to get their IDs
      const response = await fetch(`/api/metafields/all-attributes?brand_id=4`);
      if (!response.ok) throw new Error('Failed to fetch attributes');
      
      const allAttributes = await response.json();
      const attributesToDelete = allAttributes.filter((attr: any) => attr.type === type);

      if (attributesToDelete.length === 0) {
        alert('No attributes found for this type');
        return;
      }

      // Delete all attributes of this type sequentially
      let deletedCount = 0;
      let failedCount = 0;
      
      for (const attr of attributesToDelete) {
        try {
          await deleteMutation.mutateAsync(attr.id);
          deletedCount++;
        } catch (error: any) {
          console.error(`Failed to delete attribute ${attr.id}:`, error);
          failedCount++;
        }
      }

      if (failedCount > 0) {
        alert(`Deleted ${deletedCount} attribute(s), ${failedCount} failed.`);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete metafield');
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Metafields</h1>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Metafield
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Metafield</DialogTitle>
                  <DialogDescription>
                    Create a new metafield attribute. The type will be used as the metafield name on Shopify.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="metafield-type">Type (Metafield Name)</Label>
                    <Input
                      id="metafield-type"
                      value={newMetafieldType}
                      onChange={(e) => setNewMetafieldType(e.target.value)}
                      placeholder="e.g., cut_grade, shape, color"
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be formatted as "Cut Grade", "Shape", "Color" on Shopify
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metafield-name">Name (Value)</Label>
                    <Input
                      id="metafield-name"
                      value={newMetafieldName}
                      onChange={(e) => setNewMetafieldName(e.target.value)}
                      placeholder="e.g., Excellent, Round, Red"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is a value for the metafield type above
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metafield-value">Default Value (optional)</Label>
                    <Input
                      id="metafield-value"
                      value={newMetafieldValue}
                      onChange={(e) => setNewMetafieldValue(e.target.value)}
                      placeholder="Default value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metafield-description">Description (optional)</Label>
                    <Input
                      id="metafield-description"
                      value={newMetafieldDescription}
                      onChange={(e) => setNewMetafieldDescription(e.target.value)}
                      placeholder="Description"
                    />
                  </div>
                  <Button 
                    onClick={handleCreate} 
                    disabled={createMutation.isPending || !newMetafieldName.trim() || !newMetafieldType.trim()}
                    className="w-full"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Metafield'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Manage Values Dialog */}
          <Dialog 
            open={isManageValuesDialogOpen} 
            onOpenChange={(open) => {
              setIsManageValuesDialogOpen(open);
              if (!open) {
                // Reset state when closing
                setSelectedTypeForValues('');
                setSelectedTypeName('');
                setValuesList([]);
                setNewValueName('');
                setEditingValueId(null);
                setEditingValueName('');
              }
            }}
          >
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Manage Values: {selectedTypeName}</DialogTitle>
                <DialogDescription>
                  Add, edit, or delete values for this metafield type. Changes will sync to Shopify automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Add New Value */}
                <div className="space-y-2 border-b pb-4">
                  <Label htmlFor="new-value-name" className="text-base font-semibold">Add New Value</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-value-name"
                      value={newValueName}
                      onChange={(e) => setNewValueName(e.target.value)}
                      placeholder="e.g., Excellent, Round, Red"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateValue();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleCreateValue} 
                      disabled={createMutation.isPending || !newValueName.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* Values List */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Existing Values ({valuesList.length})</Label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {valuesList.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No values yet. Add one above.
                      </p>
                    ) : (
                      valuesList.map((value) => (
                        <div
                          key={value.id}
                          className="flex items-center gap-2 p-3 border rounded-md hover:bg-accent transition-colors"
                        >
                          {editingValueId === value.id ? (
                            <>
                              <Input
                                value={editingValueName}
                                onChange={(e) => setEditingValueName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateValue(value.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditValue();
                                  }
                                }}
                                className="flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleUpdateValue(value.id)}
                                disabled={updateMutation.isPending || !editingValueName.trim()}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEditValue}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 font-medium">{value.name}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEditValue(value)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteValue(value.id, value.name)}
                                disabled={deleteMutation.isPending}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Metafield</DialogTitle>
                <DialogDescription>
                  Edit metafield attribute. Changing the type will affect all attributes of this type.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-metafield-type">Type (Metafield Name)</Label>
                  <Input
                    id="edit-metafield-type"
                    value={editMetafieldType}
                    onChange={(e) => setEditMetafieldType(e.target.value)}
                    placeholder="e.g., cut_grade, shape, color"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be formatted as "Cut Grade", "Shape", "Color" on Shopify
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-metafield-name">Name (Value)</Label>
                  <Input
                    id="edit-metafield-name"
                    value={editMetafieldName}
                    onChange={(e) => setEditMetafieldName(e.target.value)}
                    placeholder="e.g., Excellent, Round, Red"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is a value for the metafield type above
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-metafield-value">Default Value (optional)</Label>
                  <Input
                    id="edit-metafield-value"
                    value={editMetafieldValue}
                    onChange={(e) => setEditMetafieldValue(e.target.value)}
                    placeholder="Default value"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-metafield-description">Description (optional)</Label>
                  <Input
                    id="edit-metafield-description"
                    value={editMetafieldDescription}
                    onChange={(e) => setEditMetafieldDescription(e.target.value)}
                    placeholder="Description"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleUpdate} 
                    disabled={updateMutation.isPending || !editMetafieldName.trim() || !editMetafieldType.trim()}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Update Metafield'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingType(null);
                      setEditingAttributeId(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle>Metafields (Brand ID = 4)</CardTitle>
              <CardDescription>Attributes grouped by type - Each type is a metafield name, names in the same type are values</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metafield Name (Type)</TableHead>
                      <TableHead>Values</TableHead>
                      <TableHead>Shopify</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metafields && metafields.length > 0 ? (
                      metafields.map((metafield, index) => (
                        <TableRow key={`${metafield.type}-${index}`}>
                          <TableCell className="font-medium">
                            {metafield.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2 items-center">
                              {metafield.values.map((value, valueIndex) => (
                                <span
                                  key={valueIndex}
                                  className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-sm font-medium"
                                >
                                  {value}
                                </span>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => handleManageValues(metafield.type, metafield.name)}
                                title="Manage values"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Manage
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ShopifySyncStatus 
                              shopifyId={(metafield as any).shopify_metafield_definition_id}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(metafield.type)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(metafield.type)}
                                disabled={deleteMutation.isPending}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No metafields found for brand_id = 4.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}


