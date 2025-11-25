import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import tw from 'twrnc';
import { MapPin, ChevronDown, X } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { getAddressSuggestionsNominatim } from '../../lib/geocode';
import { logger } from '../../lib/logger';

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export function LocationInput({
  value,
  onChange,
  placeholder = "Enter your address...",
  error,
  disabled = false
}: LocationInputProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced search function
  const searchAddresses = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const results = await getAddressSuggestionsNominatim(query);
      setSuggestions(results);
    } catch (error) {
      logger.error('Error searching addresses:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only search if query is long enough and not empty
    if (searchQuery && searchQuery.length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        searchAddresses(searchQuery);
      }, 500); // Increased debounce time to 500ms
    } else if (searchQuery.length === 0) {
      // Clear suggestions immediately when input is empty
      setSuggestions([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.display_name);
    setModalVisible(false);
    setSearchQuery('');
    setSuggestions([]);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSearchQuery('');
    setSuggestions([]);
    // Clear any pending debounced searches
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const formatSuggestion = (suggestion: Suggestion) => {
    const parts = suggestion.display_name.split(', ');
    if (parts.length > 3) {
      return parts.slice(0, 3).join(', ') + '...';
    }
    return suggestion.display_name;
  };

  const renderSuggestion = ({ item }: { item: Suggestion }) => (
    <TouchableOpacity
      style={[
        tw`p-4 border-b`,
        { borderBottomColor: 'rgba(255,255,255,0.1)' }
      ]}
      onPress={() => handleSelectSuggestion(item)}
    >
      <View style={tw`flex-row items-start`}>
        <MapPin size={16} color={theme.colors.mutedForeground} style={tw`mr-3 mt-1`} />
        <View style={tw`flex-1`}>
          <Text style={[tw`text-base`, { color: theme.colors.foreground }]}>
            {formatSuggestion(item)}
          </Text>
          {item.address && (
            <Text style={[tw`text-sm mt-1`, { color: theme.colors.mutedForeground }]}>
              {[
                item.address.house_number,
                item.address.road,
                item.address.city,
                item.address.state,
                item.address.postcode
              ].filter(Boolean).join(', ')}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={tw`space-y-2`}>
      <TouchableOpacity
        style={[
          tw`flex-row items-center justify-between p-3 rounded-xl border`,
          { 
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderColor: error ? theme.colors.destructive : 'rgba(255,255,255,0.2)',
            opacity: disabled ? 0.5 : 1
          }
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <View style={tw`flex-1 flex-row items-center`}>
          <MapPin size={18} color={theme.colors.mutedForeground} style={tw`mr-3`} />
          <Text 
            style={[
              tw`text-base flex-1`,
              { 
                color: value ? theme.colors.foreground : 'rgba(255,255,255,0.6)'
              }
            ]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </View>
        <ChevronDown size={16} color={theme.colors.mutedForeground} />
      </TouchableOpacity>

      {error && (
        <Text style={[tw`text-sm`, { color: theme.colors.destructive }]}>
          {error}
        </Text>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
          {/* Header */}
          <View style={tw`flex-row items-center justify-between p-4 border-b border-white/10`}>
            <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
              Select Location
            </Text>
            <TouchableOpacity onPress={handleCloseModal}>
              <X size={24} color={theme.colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={tw`p-4`}>
            <TextInput
              style={[
                tw`p-3 rounded-xl border`,
                { 
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: theme.colors.foreground
                }
              ]}
              placeholder="Search for an address..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {/* Suggestions List */}
          {loading ? (
            <View style={tw`flex-1 justify-center items-center`}>
              <ActivityIndicator size="large" color={theme.colors.secondary} />
              <Text style={[tw`mt-4 text-sm`, { color: theme.colors.mutedForeground }]}>
                Searching addresses...
              </Text>
            </View>
          ) : (
            <FlatList
              data={suggestions}
              renderItem={renderSuggestion}
              keyExtractor={(item) => item.place_id.toString()}
              style={tw`flex-1`}
              contentContainerStyle={tw`pb-4`}
              ListEmptyComponent={
                searchQuery.length >= 3 ? (
                  <View style={tw`flex-1 justify-center items-center p-8`}>
                    <Text style={[tw`text-center text-sm`, { color: theme.colors.mutedForeground }]}>
                      No addresses found for "{searchQuery}"
                    </Text>
                  </View>
                ) : (
                  <View style={tw`flex-1 justify-center items-center p-8`}>
                    <Text style={[tw`text-center text-sm`, { color: theme.colors.mutedForeground }]}>
                      Start typing to search for addresses
                    </Text>
                  </View>
                )
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
} 