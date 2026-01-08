/**
 * PCO Configuration Helper
 * Fetches configuration values from IntegrationConfig entity
 */

export async function getPCOConfig(base44) {
  try {
    const configs = await base44.asServiceRole.entities.IntegrationConfig.filter({
      category: 'pco_sync'
    });

    const configMap = {};
    configs.forEach(config => {
      let value = config.value;
      
      // Parse based on type
      if (config.value_type === 'number') {
        value = parseInt(value, 10);
      } else if (config.value_type === 'boolean') {
        value = value === 'true' || value === '1';
      }
      
      configMap[config.key] = value;
    });

    // Return config with defaults
    return {
      baseUrl: configMap.PCO_SYNC_BASE_URL || 'https://api.planningcenteronline.com',
      token: configMap.PCO_SYNC_TOKEN || null,
      timeoutMs: configMap.PCO_SYNC_TIMEOUT_MS || 8000,
      cacheTtlSeconds: configMap.PCO_SYNC_CACHE_TTL_SECONDS || 120
    };
  } catch (error) {
    console.error('Error loading PCO config, using defaults:', error);
    // Return defaults if config fetch fails
    return {
      baseUrl: 'https://api.planningcenteronline.com',
      token: null,
      timeoutMs: 8000,
      cacheTtlSeconds: 120
    };
  }
}

/**
 * Make a PCO API request with config-based URL and timeout
 */
export async function fetchPCO(base44, path, accessToken, options = {}) {
  const config = await getPCOConfig(base44);
  
  const url = path.startsWith('http') ? path : `${config.baseUrl}${path}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`PCO API request timeout after ${config.timeoutMs}ms`);
    }
    throw error;
  }
}