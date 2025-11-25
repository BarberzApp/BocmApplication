import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
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
  Scissors, 
  DollarSign, 
  Clock,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Package
} from 'lucide-react-native';
import type { Service } from '../../types/settings.types';

interface ServicesSettingsProps {
  onUpdate?: () => void;
}

export function ServicesSettings({ onUpdate }: ServicesSettingsProps) {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [formData, setFormData] = useState<Service>({
    name: '',
    price: 0,
    duration: 30,
    description: ''
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
        loadServices(data.id);
      }
    } catch (error) {
      logger.error('Error loading barber ID:', error);
      Alert.alert('Error', 'Failed to load barber information.');
    }
  };

  const loadServices = async (barberId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('barber_id', barberId)
        .order('name');

      if (error) throw error;
      if (data) setServices(data);
    } catch (error) {
      logger.error('Error loading services:', error);
      Alert.alert('Error', 'Failed to load services.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name?.trim()) errors.name = 'Service name is required';
    if (!formData.duration || formData.duration < 1) errors.duration = 'Duration must be at least 1 minute';
    if (!formData.price || formData.price < 0) errors.price = 'Price must be at least $0';
    
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
      if (editingService) {
        // Update existing service
        const { error } = await supabase
          .from('services')
          .update({
            name: formData.name,
            price: formData.price,
            duration: formData.duration,
            description: formData.description,
          })
          .eq('id', editingService.id);

        if (error) throw error;
        Alert.alert('Success', 'Service updated successfully');
      } else {
        // Add new service
        const { error } = await supabase
          .from('services')
          .insert({
            barber_id: barberId,
            name: formData.name,
            price: formData.price,
            duration: formData.duration,
            description: formData.description,
          });

        if (error) throw error;
        Alert.alert('Success', 'Service added successfully');
      }
      
      await loadServices(barberId);
      resetForm();
      onUpdate?.();
    } catch (error) {
      logger.error('Error saving service:', error);
      Alert.alert('Error', 'Failed to save service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    Alert.alert(
      'Delete Service',
      'Are you sure you want to delete this service?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', serviceId);

              if (error) throw error;

              Alert.alert('Success', 'Service deleted successfully');
              await loadServices(barberId!);
              onUpdate?.();
            } catch (error) {
              logger.error('Error deleting service:', error);
              Alert.alert('Error', 'Failed to delete service.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price,
      duration: service.duration,
      description: service.description || ''
    });
  };

  const resetForm = () => {
    setEditingService(null);
    setFormData({
      name: '',
      price: 0,
      duration: 30,
      description: ''
    });
    setValidationErrors({});
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
    }
    return `${mins}m`;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={tw`flex-1`}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
        {/* Add/Edit Service Form */}
        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center mb-4`}>
              <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: theme.colors.secondary + '20' }]}>
                {editingService ? <Edit size={20} color={theme.colors.secondary} /> : <Plus size={20} color={theme.colors.secondary} />}
              </View>
              <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                {editingService ? 'Edit Service' : 'Add New Service'}
              </Text>
            </View>

            <View style={tw`mb-4`}>
              <View style={tw`flex-row items-center mb-2`}>
                <Scissors size={14} color={theme.colors.secondary} style={tw`mr-2`} />
                <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                  Service Name *
                </Text>
              </View>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g., Haircut, Beard Trim"
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

            <View style={tw`flex-row gap-3 mb-4`}>
              <View style={tw`flex-1`}>
                <View style={tw`flex-row items-center mb-2`}>
                  <DollarSign size={14} color={theme.colors.secondary} style={tw`mr-2`} />
                  <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                    Price ($) *
                  </Text>
                </View>
                <TextInput
                  value={formData.price.toString()}
                  onChangeText={(text) => setFormData({ ...formData, price: parseFloat(text) || 0 })}
                  placeholder="25.00"
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

              <View style={tw`flex-1`}>
                <View style={tw`flex-row items-center mb-2`}>
                  <Clock size={14} color={theme.colors.secondary} style={tw`mr-2`} />
                  <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                    Duration (min) *
                  </Text>
                </View>
                <TextInput
                  value={formData.duration.toString()}
                  onChangeText={(text) => setFormData({ ...formData, duration: parseInt(text) || 30 })}
                  placeholder="30"
                  placeholderTextColor={theme.colors.mutedForeground}
                  keyboardType="numeric"
                  style={[
                    tw`px-4 py-3 rounded-xl text-base`,
                    { 
                      backgroundColor: 'rgba(255,255,255,0.05)', 
                      color: theme.colors.foreground,
                      borderWidth: 1,
                      borderColor: validationErrors.duration ? theme.colors.destructive : 'rgba(255,255,255,0.1)'
                    }
                  ]}
                />
                {validationErrors.duration && (
                  <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>{validationErrors.duration}</Text>
                )}
              </View>
            </View>

            <View style={tw`mb-4`}>
              <View style={tw`flex-row items-center mb-2`}>
                <Package size={14} color={theme.colors.secondary} style={tw`mr-2`} />
                <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                  Description
                </Text>
              </View>
              <TextInput
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Brief description of the service"
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

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                style={[tw`flex-1 py-3 rounded-xl flex-row items-center justify-center`, { backgroundColor: theme.colors.secondary }]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoadingSpinner color={theme.colors.primaryForeground} />
                ) : (
                  <>
                    <CheckCircle size={18} color={theme.colors.primaryForeground} style={tw`mr-2`} />
                    <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
                      {editingService ? 'Update Service' : 'Add Service'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {editingService && (
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

        {/* Services List */}
        <View>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <View style={tw`flex-row items-center`}>
              <Scissors size={18} color={theme.colors.secondary} style={tw`mr-2`} />
              <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                Your Services
              </Text>
            </View>
            <View style={[tw`px-3 py-1 rounded-full`, { backgroundColor: theme.colors.secondary + '20' }]}>
              <Text style={[tw`text-sm font-bold`, { color: theme.colors.secondary }]}>
                {services.length} {services.length === 1 ? 'Service' : 'Services'}
              </Text>
            </View>
          </View>

          {services.length === 0 ? (
            <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <CardContent style={tw`p-8 items-center`}>
                <View style={[tw`p-4 rounded-3xl mb-4`, { backgroundColor: theme.colors.secondary + '20' }]}>
                  <Sparkles size={32} color={theme.colors.secondary} />
                </View>
                <Text style={[tw`text-xl font-bold mb-2`, { color: theme.colors.foreground }]}>
                  No Services Yet
                </Text>
                <Text style={[tw`text-center mb-6`, { color: theme.colors.mutedForeground }]}>
                  Add your first service to start accepting bookings
                </Text>
                <TouchableOpacity
                  style={[tw`px-6 py-3 rounded-xl flex-row items-center`, { backgroundColor: theme.colors.secondary }]}
                  onPress={() => setFormData({ name: '', price: 0, duration: 30, description: '' })}
                >
                  <Plus size={18} color={theme.colors.primaryForeground} style={tw`mr-2`} />
                  <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
                    Add Your First Service
                  </Text>
                </TouchableOpacity>
              </CardContent>
            </Card>
          ) : (
            <View style={tw`gap-3`}>
              {services.map((service) => (
                <Card key={service.id} style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <CardContent style={tw`p-4`}>
                    <View style={tw`flex-row justify-between items-start`}>
                      <View style={tw`flex-1`}>
                        <Text style={[tw`text-lg font-semibold mb-1`, { color: theme.colors.foreground }]}>
                          {service.name}
                        </Text>
                        <View style={tw`flex-row items-center gap-4 mb-2`}>
                          <View style={[tw`px-3 py-1 rounded-full flex-row items-center`, { backgroundColor: theme.colors.secondary + '20' }]}>
                            <DollarSign size={14} color={theme.colors.secondary} />
                            <Text style={[tw`ml-1 font-bold`, { color: theme.colors.secondary }]}>
                              {service.price}
                            </Text>
                          </View>
                          <View style={tw`flex-row items-center`}>
                            <Clock size={14} color={theme.colors.mutedForeground} style={tw`mr-1`} />
                            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                              {formatDuration(service.duration)}
                            </Text>
                          </View>
                        </View>
                        {service.description && (
                          <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                            {service.description}
                          </Text>
                        )}
                      </View>
                      
                      <View style={tw`flex-row gap-2 ml-4`}>
                        <TouchableOpacity
                          onPress={() => handleEdit(service)}
                          style={[tw`p-2 rounded-xl`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                        >
                          <Edit size={18} color={theme.colors.foreground} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(service.id!)}
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

        {/* Tips Section */}
        <Card style={[tw`mt-8`, { backgroundColor: theme.colors.secondary + '10', borderColor: theme.colors.secondary + '20' }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-start`}>
              <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: theme.colors.secondary + '20' }]}>
                <Sparkles size={20} color={theme.colors.secondary} />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-base font-semibold mb-3`, { color: theme.colors.foreground }]}>
                  Pro Tips for Success
                </Text>
                <View style={tw`gap-2`}>
                  {[
                    'Set competitive prices based on your location and experience level',
                    'Be accurate with duration estimates to avoid scheduling conflicts',
                    'Add detailed descriptions to help clients understand your services',
                    'Consider offering package deals for multiple services'
                  ].map((tip, index) => (
                    <View key={index} style={tw`flex-row items-start`}>
                      <View style={[tw`w-1.5 h-1.5 rounded-full mt-1.5 mr-2`, { backgroundColor: theme.colors.secondary }]} />
                      <Text style={[tw`flex-1 text-sm`, { color: theme.colors.foreground }]}>
                        {tip}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
} 