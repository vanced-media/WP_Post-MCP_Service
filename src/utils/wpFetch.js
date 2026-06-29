export function createWpFetch(wpUrl, authHeader) {
    const WP_URL = wpUrl.replace(/\/$/, '');
    
    return async function wpFetch(path, options = {}) {
        const url = `${WP_URL}${path}`;
        const headers = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        const response = await fetch(url, { ...options, headers });
        const text = await response.text();
        
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            throw new Error(`WP API Error ${response.status}: Failed to parse JSON. Response: ${text.substring(0, 200)}`);
        }

        if (!response.ok) {
            throw new Error(`WP API Error ${response.status}: ${JSON.stringify(json)}`);
        }
        return json;
    };
}
