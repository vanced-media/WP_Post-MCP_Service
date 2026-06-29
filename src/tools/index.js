import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPostsTools } from "./posts.js";
import { registerMediaTools } from "./media.js";
import { registerTaxonomiesTools } from "./taxonomies.js";

export function createMcpServer() {
    const server = new McpServer({
        name: "WP-MCP Service",
        version: "1.0.0"
    });

    registerPostsTools(server);
    registerMediaTools(server);
    registerTaxonomiesTools(server);

    return server;
}
