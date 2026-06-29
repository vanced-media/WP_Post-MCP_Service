import dotenv from 'dotenv';
dotenv.config();

const WP_URL = process.env.WP_BASE_URL?.replace(/\/$/, '');
const AUTH_HEADER = 'Basic ' + Buffer.from(`${process.env.WP_APP_USER}:${process.env.WP_APP_PASS}`).toString('base64');

export async function wpFetch(path, options = {}) {
    const url = `${WP_URL}${path}`;
    const headers = {
        'Authorization': AUTH_HEADER,
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
}
