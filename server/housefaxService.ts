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

// Zillow API via RapidAPI - using Real Estate 101 property-details endpoint
export async function fetchZillowPropertyData(address: string): Promise<ZillowPropertyData | null> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  
  if (!rapidApiKey) {
    console.error('RAPIDAPI_KEY not configured');
    return null;
  }

  try {
    // Format address for Real Estate 101 API: replace spaces/commas with dashes
    // Example: "188 Shaw St, New London, CT 06320" -> "188-Shaw-St-New-London-CT-06320"
    const formattedAddress = address
      .replace(/,/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-');
    
    const apiUrl = `https://real-estate101.p.rapidapi.com/api/property-details/byaddress?address=${encodeURIComponent(formattedAddress)}`;
    
    console.log('Calling Real Estate 101 API for:', address, '-> Formatted:', formattedAddress);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'real-estate101.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zillow API failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    
    // Check if we got valid property data
    if (!data || data.error || !data.success === false) {
      console.log('No property data returned for:', address);
      if (data.error) console.log('API error:', data.error);
    }

    // Extract property details from Real Estate 101 response
    // The response structure may vary, so we handle multiple formats
    const property = data.property || data.data || data;
    
    if (!property || typeof property !== 'object') {
      console.log('Invalid property data structure for:', address);
      return null;
    }

    console.log('Zillow data received for property');

    // Handle nested address object
    let addressStr = '';
    if (typeof property.address === 'object' && property.address) {
      const addr = property.address;
      addressStr = [addr.streetAddress, addr.city, addr.state, addr.zipcode].filter(Boolean).join(', ');
    } else {
      addressStr = property.streetAddress || property.address || property.fullAddress || '';
    }

    // Handle nested livingArea object
    let livingAreaValue: number | undefined;
    if (typeof property.livingArea === 'object' && property.livingArea) {
      livingAreaValue = property.livingArea.value;
    } else {
      livingAreaValue = property.livingArea || property.livingAreaValue || property.sqft || property.squareFeet;
    }

    // Handle nested lotSize object
    let lotSizeValue: number | undefined;
    if (typeof property.lotSize === 'object' && property.lotSize) {
      lotSizeValue = property.lotSize.value;
    } else {
      lotSizeValue = property.lotSize || property.lotAreaValue || property.lotSqft;
    }

    return {
      zpid: String(property.zpid || property.zillowId || property.id || ''),
      address: addressStr,
      bedrooms: property.bedrooms || property.beds || property.bedroomCount,
      bathrooms: property.bathrooms || property.baths || property.bathroomCount,
      livingArea: livingAreaValue,
      lotSize: lotSizeValue,
      yearBuilt: property.yearBuilt || property.yearBuiltRange,
      propertyType: property.homeType || property.propertyType || property.propertyTypeDimension,
      zestimate: property.zestimate || property.price || property.estimatedValue || property.priceEstimate,
      taxAssessedValue: property.taxAssessedValue || property.taxAssessment,
      lastSoldDate: property.lastSoldDate || property.dateSold,
      lastSoldPrice: property.lastSoldPrice || property.soldPrice,
      homeStatus: property.homeStatus || property.status,
      url: property.url || property.hdpUrl || property.zillowUrl
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
