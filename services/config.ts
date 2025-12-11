// Cache the API base URL to avoid multiple fetches
let cachedApiBaseUrl: string | null = null;

// Function to detect the backend URL based on current location
function getDefaultBackendUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3003';
  }
  
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3003';
  }

  return 'https://api.discover-gozo.com';
}

export function getApiBaseUrl(): string {
  // Return cached value if available
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }
  
  // Default fallback for initial load
  return getDefaultBackendUrl();
}

// Function to load configuration from backend
export async function loadApiConfig(): Promise<string> {
  try {
    // Detect the backend URL dynamically
    const backendUrl = getDefaultBackendUrl();
    const configUrl = `${backendUrl}/api/deployment/public-config`;
    
    console.log('🔍 Fetching backend config from:', configUrl);
    
    const response = await fetch(configUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.backendUrl) {
        cachedApiBaseUrl = data.backendUrl;
        console.log('✅ Loaded backend URL from config:', cachedApiBaseUrl);
        return cachedApiBaseUrl;
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to load backend config, using default:', error);
  }

  // Fallback to detected default
  cachedApiBaseUrl = getDefaultBackendUrl();
  console.log('📌 Using detected backend URL:', cachedApiBaseUrl);
  return cachedApiBaseUrl;
}

// Initialize configuration on module load
if (typeof window !== 'undefined') {
  // Load config when the app starts
  loadApiConfig();
}

export function getTileBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3003/tiles';
  }

  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3003/tiles';
  }

  return 'https://pub-20c9ec6e8dd24922b90066789419ecbe.r2.dev';
}



