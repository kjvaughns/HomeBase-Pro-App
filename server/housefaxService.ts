/**
 * HouseFax Service - External API integrations for property data enrichment
 * Uses Zillow (via RapidAPI) and Google APIs
 */

interface ZillowPropertyData {
  zpid?: string;
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number; // sqft
  lotSize?: number; // sqft
  yearBuilt?: number;
  propertyType?: string;
  zestimate?: number;
  taxAssessedValue?: number;
  lastSoldDate?: string;
  lastSoldPrice?: number;
  homeStatus?: string;
  url?: string;
}

interface GoogleGeocodeResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
  neighborhood?: string;
  county?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface GooglePlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface HouseFaxEnrichmentResult {
  zillow?: ZillowPropertyData;
  google?: GoogleGeocodeResult;
  success: boolean;
  errors?: string[];
}

// Zillow API via RapidAPI
// Note: Different Zillow APIs on RapidAPI have different endpoints and formats
// Set RAPIDAPI_ZILLOW_HOST to match your subscribed API
export async function fetchZillowPropertyData(address: string): Promise<ZillowPropertyData | null> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const zillowHost = process.env.RAPIDAPI_ZILLOW_HOST;
  
  if (!rapidApiKey) {
    console.error('RAPIDAPI_KEY not configured');
    return null;
  }

  // If no Zillow host configured, return null gracefully
  if (!zillowHost) {
    console.log('No RAPIDAPI_ZILLOW_HOST configured - Zillow enrichment skipped');
    return null;
  }

  try {
    // Try common Zillow API patterns based on the configured host
    let apiUrl: string;
    
    if (zillowHost.includes('real-estate101')) {
      // Real Estate 101 requires a full Zillow search URL with searchQueryState
      // This API is better for bulk search results, not individual property lookup
      console.log('Real Estate 101 API requires Zillow search URL format - not suitable for address lookup');
      return null;
    } else if (zillowHost.includes('zillow56') || zillowHost.includes('zillow-com')) {
      // Standard Zillow API format
      apiUrl = `https://${zillowHost}/search?location=${encodeURIComponent(address)}`;
    } else {
      // Generic fallback
      apiUrl = `https://${zillowHost}/search?location=${encodeURIComponent(address)}`;
    }
    
    console.log('Calling Zillow API:', zillowHost, 'for:', address);
    
    const searchResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': zillowHost
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Zillow search failed:', searchResponse.status, errorText);
      return null;
    }

    const searchData = await searchResponse.json();
    
    // Handle various response formats
    const results = searchData.results || searchData.props || searchData.data || [];
    const propertyList = Array.isArray(results) ? results : (results.properties || []);
    
    if (propertyList.length === 0) {
      console.log('No Zillow properties found for address:', address);
      return null;
    }

    const property = propertyList[0];
    
    return {
      zpid: String(property.zpid || property.id || ''),
      address: property.address || property.streetAddress || property.addressStreet,
      bedrooms: property.bedrooms || property.beds,
      bathrooms: property.bathrooms || property.baths,
      livingArea: property.livingArea || property.sqft || property.livingAreaSqFt,
      lotSize: property.lotSize || property.lotAreaSqFt,
      yearBuilt: property.yearBuilt,
      propertyType: property.propertyType || property.homeType || property.propertyTypeDimension,
      zestimate: property.zestimate || property.price || property.estimatedValue,
      taxAssessedValue: property.taxAssessedValue,
      lastSoldDate: property.dateSold || property.lastSoldDate,
      lastSoldPrice: property.lastSoldPrice,
      homeStatus: property.homeStatus || property.status,
      url: property.url || property.detailUrl || property.hdpUrl
    };

  } catch (error) {
    console.error('Zillow API error:', error);
    return null;
  }
}

// Google Geocoding API
export async function geocodeAddress(address: string): Promise<GoogleGeocodeResult | null> {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  
  if (!googleApiKey) {
    console.error('GOOGLE_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log('Google geocoding failed:', data.status);
      return null;
    }

    const result = data.results[0];
    const location = result.geometry.location;
    
    // Extract address components
    let neighborhood: string | undefined;
    let county: string | undefined;
    let city: string | undefined;
    let state: string | undefined;
    let zipCode: string | undefined;

    for (const component of result.address_components) {
      if (component.types.includes('neighborhood')) {
        neighborhood = component.long_name;
      }
      if (component.types.includes('administrative_area_level_2')) {
        county = component.long_name;
      }
      if (component.types.includes('locality')) {
        city = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        state = component.short_name;
      }
      if (component.types.includes('postal_code')) {
        zipCode = component.long_name;
      }
    }

    return {
      formattedAddress: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      placeId: result.place_id,
      neighborhood,
      county,
      city,
      state,
      zipCode
    };

  } catch (error) {
    console.error('Google Geocoding API error:', error);
    return null;
  }
}

// Google Places Autocomplete
export async function searchPlaces(query: string): Promise<GooglePlacePrediction[]> {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  
  if (!googleApiKey) {
    console.error('GOOGLE_API_KEY not configured');
    return [];
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=address&components=country:us&key=${googleApiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.predictions) {
      return [];
    }

    return data.predictions.map((p: {
      place_id: string;
      description: string;
      structured_formatting?: {
        main_text?: string;
        secondary_text?: string;
      };
    }) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || '',
      secondaryText: p.structured_formatting?.secondary_text || ''
    }));

  } catch (error) {
    console.error('Google Places API error:', error);
    return [];
  }
}

// Get place details from place ID
export async function getPlaceDetails(placeId: string): Promise<GoogleGeocodeResult | null> {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  
  if (!googleApiKey) {
    console.error('GOOGLE_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,address_components&key=${googleApiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      return null;
    }

    const result = data.result;
    const location = result.geometry?.location;
    
    let neighborhood: string | undefined;
    let county: string | undefined;
    let city: string | undefined;
    let state: string | undefined;
    let zipCode: string | undefined;

    for (const component of result.address_components || []) {
      if (component.types.includes('neighborhood')) {
        neighborhood = component.long_name;
      }
      if (component.types.includes('administrative_area_level_2')) {
        county = component.long_name;
      }
      if (component.types.includes('locality')) {
        city = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        state = component.short_name;
      }
      if (component.types.includes('postal_code')) {
        zipCode = component.long_name;
      }
    }

    return {
      formattedAddress: result.formatted_address,
      latitude: location?.lat || 0,
      longitude: location?.lng || 0,
      placeId,
      neighborhood,
      county,
      city,
      state,
      zipCode
    };

  } catch (error) {
    console.error('Google Place Details API error:', error);
    return null;
  }
}

// Full HouseFax enrichment - combines Zillow + Google data
export async function enrichPropertyData(address: string): Promise<HouseFaxEnrichmentResult> {
  const errors: string[] = [];
  
  // Fetch data from both sources in parallel
  const [zillowData, googleData] = await Promise.all([
    fetchZillowPropertyData(address),
    geocodeAddress(address)
  ]);

  if (!zillowData) {
    errors.push('Could not fetch Zillow property data');
  }

  if (!googleData) {
    errors.push('Could not geocode address');
  }

  return {
    zillow: zillowData || undefined,
    google: googleData || undefined,
    success: !!(zillowData || googleData),
    errors: errors.length > 0 ? errors : undefined
  };
}

// Build HouseFax context for AI prompts
export function buildHouseFaxContext(home: {
  label?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  yearBuilt?: number | null;
  propertyType?: string | null;
  lotSize?: number | null;
  estimatedValue?: string | null;
  neighborhoodName?: string | null;
  housefaxData?: string | null;
}): string {
  const currentYear = new Date().getFullYear();
  const homeAge = home.yearBuilt ? currentYear - home.yearBuilt : null;
  
  let context = `Property: ${home.street || 'Unknown'}, ${home.city || ''} ${home.state || ''} ${home.zip || ''}\n`;
  
  if (home.propertyType) {
    context += `Type: ${home.propertyType.replace('_', ' ')}\n`;
  }
  
  if (home.bedrooms || home.bathrooms) {
    context += `Layout: ${home.bedrooms || '?'} bed, ${home.bathrooms || '?'} bath\n`;
  }
  
  if (home.squareFeet) {
    context += `Size: ${home.squareFeet.toLocaleString()} sqft\n`;
  }
  
  if (home.lotSize) {
    context += `Lot: ${home.lotSize.toLocaleString()} sqft\n`;
  }
  
  if (home.yearBuilt) {
    context += `Built: ${home.yearBuilt} (${homeAge} years old)\n`;
  }
  
  if (home.estimatedValue) {
    const value = parseFloat(home.estimatedValue);
    if (!isNaN(value)) {
      context += `Estimated Value: $${value.toLocaleString()}\n`;
    }
  }
  
  if (home.neighborhoodName) {
    context += `Neighborhood: ${home.neighborhoodName}\n`;
  }
  
  // Parse and include any accumulated HouseFax data
  if (home.housefaxData) {
    try {
      const faxData = JSON.parse(home.housefaxData);
      if (faxData.systems) {
        context += `\nHome Systems:\n`;
        for (const [system, info] of Object.entries(faxData.systems)) {
          context += `- ${system}: ${JSON.stringify(info)}\n`;
        }
      }
      if (faxData.knownIssues && faxData.knownIssues.length > 0) {
        context += `\nKnown Issues: ${faxData.knownIssues.join(', ')}\n`;
      }
      if (faxData.recentWork && faxData.recentWork.length > 0) {
        context += `\nRecent Work: ${faxData.recentWork.join(', ')}\n`;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  return context;
}
