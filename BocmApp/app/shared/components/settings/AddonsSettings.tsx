import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import tw from 'twrnc';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../lib/logger';
import { Button, Card, CardContent, LoadingSpinner } from '../ui';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react-native';
import type { ServiceAddon } from '../../types/settings.types';

interface AddonsSettingsProps {
  onUpdate?: () => void;
}

export function AddonsSettings({ onUpdate }: AddonsSettingsProps) {
  const { user } = useAuth();
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [formData, setFormData] = useState<ServiceAddon>({
    name: '',
    description: '',
    price: 0,
    is_active: true
  });

  useEffect(() => {
    if (user) {
      loadBarberId();
    }
  }, [user]);

  const loadBarberId = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      if (data) {
        setBarberId(data.id);
        loadAddons(data.id);
      }
    } catch (error) {
      logger.error('Error loading barber ID:', error);
      Alert.alert('Error', 'Failed to load barber information.');
    }
  };

  const loadAddons = async (barberId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('*')
        .eq('barber_id', barberId)
        .order('name');

      if (error) throw error;
      setAddons(data || []);
    } catch (error) {
      logger.error('Error loading add-ons:', error);
      Alert.alert('Error', 'Failed to load add-ons.');
    }
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name?.trim()) errors.name = 'Add-on name is required';
    if (formData.price < 0) errors.price = 'Price must be at least $0';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!barberId) {
      Alert.alert('Error', 'Barber information not found.');
      return;
    }

    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    try {
      setIsLoading(true);
      if (editingAddon) {
        // Update existing add-on
        const { error } = await supabase
          .from('service_addons')
          .update({
            name: formData.name,
            description: formData.description,
            price: formData.price,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAddon.id);

        if (error) throw error;
        Alert.alert('Success', 'Add-on updated successfully');
      } else {
        // Add new add-on
        const { error } = await supabase
          .from('service_addons')
          .insert({
            barber_id: barberId,
            name: formData.name,
            description: formData.description,
            price: formData.price,
            is_active: formData.is_active,
          });

        if (error) throw error;
        Alert.alert('Success', 'Add-on added successfully');
      }
      
      await loadAddons(barberId);
      resetForm();
      onUpdate?.();
    } catch (error) {
      logger.error('Error saving add-on:', error);
      Alert.alert('Error', 'Failed to save add-on.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (addonId: string) => {
    Alert.alert(
      'Delete Add-on',
      'Are you sure you want to delete this add-on?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_addons')
                .delete()
                .eq('id', addonId);

              if (error) throw error;

              Alert.alert('Success', 'Add-on deleted successfully');
              await loadAddons(barberId!);
              onUpdate?.();
            } catch (error) {
              logger.error('Error deleting add-on:', error);
              Alert.alert('Error', 'Failed to delete add-on.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (addon: ServiceAddon) => {
    setEditingAddon(addon);
    setFormData({
      name: addon.name,
      description: addon.description || '',
      price: addon.price,
      is_active: addon.is_active
    });
  };

  const resetForm = () => {
    setEditingAddon(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      is_active: true
    });
    setValidationErrors({});
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={tw`flex-1`}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
        {/* Header */}
        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center mb-4`}>
              <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: theme.colors.secondary + '20' }]}>
                <Package size={20} color={theme.colors.secondary} />
              </View>
              <View>
                <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                  Service Add-ons
                </Text>
                <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                  Manage additional services and items
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Add/Edit Form */}
        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <CardContent style={tw`p-4`}>
            <Text style={[tw`text-base font-semibold mb-4`, { color: theme.colors.foreground }]}>
              {editingAddon ? 'Edit Add-on' : 'Add New Add-on'}
            </Text>

            <View style={tw`mb-4`}>
              <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                Add-on Name *
              </Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g., Fresh Towel, Premium Shampoo"
                placeholderTextColor={theme.colors.mutedForeground}
                style={[
                  tw`px-4 py-3 rounded-xl text-base`,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    color: theme.colors.foreground,
                    borderWidth: 1,
                    borderColor: validationErrors.name ? theme.colors.destructive : 'rgba(255,255,255,0.1)'
                  }
                ]}
              />
              {validationErrors.name && (
                <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>{validationErrors.name}</Text>
              )}
            </View>

            <View style={tw`mb-4`}>
              <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                Price ($) *
              </Text>
              <TextInput
                value={formData.price.toString()}
                onChangeText={(text) => setFormData({ ...formData, price: parseFloat(text) || 0 })}
                placeholder="5.00"
                placeholderTextColor={theme.colors.mutedForeground}
                keyboardType="numeric"
                style={[
                  tw`px-4 py-3 rounded-xl text-base`,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    color: theme.colors.foreground,
                    borderWidth: 1,
                    borderColor: validationErrors.price ? theme.colors.destructive : 'rgba(255,255,255,0.1)'
                  }
                ]}
              />
              {validationErrors.price && (
                <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>{validationErrors.price}</Text>
              )}
            </View>

            <View style={tw`mb-4`}>
              <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                Description (Optional)
              </Text>
              <TextInput
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Brief description of what this add-on includes..."
                placeholderTextColor={theme.colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[
                  tw`px-4 py-3 rounded-xl text-base`,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    color: theme.colors.foreground,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    minHeight: 80,
                    textAlignVertical: 'top'
                  }
                ]}
              />
            </View>

            <View style={tw`flex-row items-center justify-between mb-4`}>
              <Text style={[tw`font-medium`, { color: theme.colors.foreground }]}>
                Active (available for booking)
              </Text>
              <Switch
                value={formData.is_active}
                onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                trackColor={{ false: theme.colors.input, true: theme.colors.secondary }}
                thumbColor={theme.colors.foreground}
              />
            </View>

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                style={[tw`flex-1 py-3 rounded-xl flex-row items-center justify-center`, { backgroundColor: theme.colors.secondary }]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoadingSpinner color={theme.colors.primaryForeground} />
                ) : (
                  <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
                    {editingAddon ? 'Update Add-on' : 'Add Add-on'}
                  </Text>
                )}
              </TouchableOpacity>

              {editingAddon && (
                <TouchableOpacity
                  style={[tw`px-4 py-3 rounded-xl`, { borderWidth: 1, borderColor: theme.colors.mutedForeground }]}
                  onPress={resetForm}
                >
                  <Text style={{ color: theme.colors.foreground }}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </CardContent>
        </Card>

        {/* Add-ons List */}
        <View>
          <View style={tw`flex-row items-center mb-4`}>
            <Package size={18} color={theme.colors.secondary} style={tw`mr-2`} />
            <Text style={[tw`text-base font-semibold`, { color: theme.colors.foreground }]}>
              Your Add-ons ({addons.length})
            </Text>
          </View>

          {addons.length === 0 ? (
            <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <CardContent style={tw`p-6 items-center`}>
                <Package size={32} color={theme.colors.mutedForeground} style={tw`mb-3`} />
                <Text style={[tw`text-center`, { color: theme.colors.mutedForeground }]}>
                  No add-ons created yet. Add your first add-on above to get started.
                </Text>
              </CardContent>
            </Card>
          ) : (
            <View style={tw`gap-3`}>
              {addons.map((addon) => (
                <Card key={addon.id} style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <CardContent style={tw`p-4`}>
                    <View style={tw`flex-row justify-between items-start`}>
                      <View style={tw`flex-1 pr-2`}>
                        <View style={tw`flex-row items-center flex-wrap mb-1`}>
                          <Text style={[tw`font-semibold text-base mr-2`, { color: theme.colors.foreground }]} numberOfLines={1}>
                            {addon.name}
                          </Text>
                          <View style={[
                            tw`px-2 py-0.5 rounded-full`,
                            { backgroundColor: addon.is_active ? theme.colors.secondary + '20' : theme.colors.mutedForeground + '20' }
                          ]}>
                            <Text style={[
                              tw`text-xs`,
                              { color: addon.is_active ? theme.colors.secondary : theme.colors.mutedForeground }
                            ]}>
                              {addon.is_active ? 'Active' : 'Inactive'}
                            </Text>
                          </View>
                        </View>
                        {addon.description && (
                          <Text style={[tw`text-sm mb-2`, { color: theme.colors.mutedForeground }]} numberOfLines={2}>
                            {addon.description}
                          </Text>
                        )}
                        <View style={tw`flex-row items-center`}>
                          <DollarSign size={16} color={theme.colors.secondary} />
                          <Text style={[tw`font-semibold`, { color: theme.colors.secondary }]}>
                            {addon.price.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={tw`flex-row gap-2`}>
                        <TouchableOpacity
                          onPress={() => handleEdit(addon)}
                          style={[tw`p-2 rounded-xl`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                        >
                          <Edit size={18} color={theme.colors.foreground} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(addon.id!)}
                          style={[tw`p-2 rounded-xl`, { backgroundColor: theme.colors.destructive + '10' }]}
                        >
                          <Trash2 size={18} color={theme.colors.destructive} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
} 