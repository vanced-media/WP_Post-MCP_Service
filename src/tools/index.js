import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPostsTools } from "./posts.js";
import { registerMediaTools } from "./media.js";
import { registerTaxonomiesTools } from "./taxonomies.js";
import { registerFacebookTools } from "./facebook.js";
import { registerInstagramTools } from "./instagram.js";
import { registerThreadsTools } from "./threads.js";
import { registerWooCommerceTools } from "./woocommerce.js";
import { createWpFetch } from "../utils/wpFetch.js";

export async function createMcpServer(siteConfig) {
    const server = new McpServer({
        name: "WP-MCP Service",
        version: "1.0.0"
    });

    const wpFetch = createWpFetch(siteConfig.url, siteConfig.authHeader);

    // Register basic tools always
    registerPostsTools(server, wpFetch);
    registerMediaTools(server, wpFetch);
    registerTaxonomiesTools(server, wpFetch);

    // Fetch config for social and woo tools
    try {
        const configData = await wpFetch(`/wp-json/assist-agent/v1/mcp-config`);
        
        // 1. Social Integrations
        if (configData && configData.social_enabled) {
            if (configData.social_enabled.facebook) {
                registerFacebookTools(server, wpFetch);
            }
            if (configData.social_enabled.instagram) {
                registerInstagramTools(server, wpFetch);
            }
            if (configData.social_enabled.threads) {
                registerThreadsTools(server, wpFetch);
            }
        }

        // 2. WooCommerce Management (Selective Expose)
        if (configData && configData.woo_status && configData.woo_status.is_enabled) {
            registerWooCommerceTools(server, wpFetch, configData.woo_status.permissions || {});
        }
    } catch (error) {
        console.error("Failed to fetch mcp-config, skipping dynamic tools registration.", error.message);
    }

    return server;
}
