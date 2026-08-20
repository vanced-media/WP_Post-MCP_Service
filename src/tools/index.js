import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPostsTools } from "./posts.js";
import { registerMediaTools } from "./media.js";
import { registerTaxonomiesTools } from "./taxonomies.js";
import { registerFacebookTools } from "./facebook.js";
import { registerInstagramTools } from "./instagram.js";
import { registerThreadsTools } from "./threads.js";
import { createWpFetch } from "../utils/wpFetch.js";

export function createMcpServer(siteConfig) {
    const server = new McpServer({
        name: "WP-MCP Service",
        version: "1.0.0"
    });

    const wpFetch = createWpFetch(siteConfig.url, siteConfig.authHeader);

    registerPostsTools(server, wpFetch);
    registerMediaTools(server, wpFetch);
    registerTaxonomiesTools(server, wpFetch);
    registerFacebookTools(server, wpFetch);
    registerInstagramTools(server, wpFetch);
    registerThreadsTools(server, wpFetch);

    return server;
}
