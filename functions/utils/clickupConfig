// Config loader with caching
let configCache = null;
let cacheExpiry = 0;

export async function loadClickUpConfig() {
  // Return cached config if still valid
  if (configCache && Date.now() < cacheExpiry) {
    return configCache;
  }

  // Load from environment variable (can be replaced with Edge Config/KV/DB later)
  const configJson = Deno.env.get('CLICKUP_MAPPING_JSON');
  
  if (!configJson) {
    // Default empty config
    configCache = { lists: [] };
  } else {
    try {
      configCache = JSON.parse(configJson);
    } catch (error) {
      console.error('Failed to parse CLICKUP_MAPPING_JSON:', error);
      configCache = { lists: [] };
    }
  }

  // Cache for 5 minutes
  cacheExpiry = Date.now() + (5 * 60 * 1000);
  
  return configCache;
}

export function getListConfig(listId, config) {
  return config.lists.find(l => l.list_id === String(listId));
}

export function getListConfigByTeamAndFolder(teamId, folderId, config) {
  return config.lists.find(l => 
    l.team_id === String(teamId) && 
    l.folder_id === String(folderId)
  );
}