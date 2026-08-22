import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPostsTools } from "./posts.js";
import { registerMediaTools } from "./media.js";
import { registerTaxonomiesTools } from "./taxonomies.js";
import { registerFacebookTools } from "./facebook.js";
import { registerInstagramTools } from "./instagram.js";
import { registerThreadsTools } from "./threads.js";
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

    // Fetch config for social tools
    try {
        const configData = await wpFetch(`/wp-json/assist-agent/v1/mcp-config`);
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
    } catch (error) {
        console.error("Failed to fetch mcp-config, skipping social tools registration.", error.message);
    }

    return server;
}
