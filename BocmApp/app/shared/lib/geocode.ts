import { logger } from './logger';

// Geocoding helper using OpenStreetMap Nominatim for React Native
export async function geocodeAddress(address: string): Promise<{ lat: number, lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    logger.error('Error geocoding address:', error);
    return null;
  }
}

// Get address suggestions for autocomplete using Nominatim
export async function getAddressSuggestionsNominatim(query: string): Promise<Array<any>> {
  if (!query || query.length < 3) return [];
  
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error('Error fetching Nominatim address suggestions:', error);
    return [];
  }
}

// Get address suggestions using Photon (Komoot's geocoding service)
export async function getAddressSuggestions(query: string): Promise<Array<{ name: string, city?: string, country?: string, lat: number, lon: number }>> {
  if (!query || query.length < 3) return [];
  
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return (data.features || []).map((feature: any) => ({
      name: feature.properties.name || feature.properties.label,
      city: feature.properties.city,
      country: feature.properties.country,
      lat: feature.geometry.coordinates[1],
      lon: feature.geometry.coordinates[0],
    }));
  } catch (error) {
    logger.error('Error fetching address suggestions:', error);
    return [];
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ name: string, city?: string, country?: string } | null> {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      return {
        name: feature.properties.name || feature.properties.label,
        city: feature.properties.city,
        country: feature.properties.country,
      };
    }
    return null;
  } catch (error) {
    logger.error('Error reverse geocoding:', error);
    return null;
  }
}

// Validate address using Nominatim
export async function validateAddress(address: string): Promise<boolean> {
  const query = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    logger.error('Error validating address:', error);
    return false;
  }
} 