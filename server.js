import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

dotenv.config();

const app = express();
app.use(cors());

// Helper for WP API calls
const WP_URL = process.env.WP_BASE_URL?.replace(/\/$/, '');
const AUTH_HEADER = 'Basic ' + Buffer.from(`${process.env.WP_APP_USER}:${process.env.WP_APP_PASS}`).toString('base64');

async function wpFetch(path, options = {}) {
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

function createMcpServer() {
    const server = new McpServer({
        name: "WP-MCP Service",
        version: "1.0.0"
    });

    // ---------------------------------------------------------
    // Tool 1: Get_PostList
    // ---------------------------------------------------------
    server.tool(
        "Get_PostList",
        "Get a list of posts from WordPress, including a flag indicating if they were edited by this plugin.",
        {
            page: z.number().optional().describe("Page number (default 1)"),
            per_page: z.number().optional().describe("Items per page (default 10)")
        },
        async ({ page = 1, per_page = 10 }) => {
            try {
                const data = await wpFetch(`/wp-json/wp/v2/posts?page=${page}&per_page=${per_page}&_fields=id,title,content`);
                
                const posts = data.map(p => {
                    const content = p.content?.rendered || '';
                    const match = content.match(/<!-- mcp_edited:\s*(\d+)\s*-->/);
                    return {
                        id: p.id,
                        title: p.title?.rendered,
                        plugin_edited: !!match,
                        edited_timestamp: match ? parseInt(match[1]) : null
                    };
                });

                return {
                    content: [{ type: "text", text: JSON.stringify(posts, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error fetching post list: ${error.message}` }]
                };
            }
        }
    );

    // ---------------------------------------------------------
    // Tool 2: Get_SinglePost
    // ---------------------------------------------------------
    server.tool(
        "Get_SinglePost",
        "Get all detailed information about a single post via the Assist Agent API.",
        {
            id: z.number().describe("Post ID")
        },
        async ({ id }) => {
            try {
                const data = await wpFetch(`/wp-json/assist-agent/v1/posts/${id}`);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error fetching post: ${error.message}` }]
                };
            }
        }
    );

    // ---------------------------------------------------------
    // Tool 3: Edit_SinglePost
    // ---------------------------------------------------------
    server.tool(
        "Edit_SinglePost",
        "Edit a post. Only updates provided fields. Automatically records the edit history via an HTML comment.",
        {
            id: z.number().describe("Post ID"),
            title: z.string().optional().describe("New title (optional)"),
            content: z.string().optional().describe("New content (optional)"),
            status: z.string().optional().describe("New status (optional)")
        },
        async ({ id, title, content, status }) => {
            try {
                let finalContent = content;
                
                if (typeof finalContent !== 'string') {
                    const currentData = await wpFetch(`/wp-json/assist-agent/v1/posts/${id}`);
                    if (!currentData.success || !currentData.data) {
                        throw new Error("Could not fetch current post to retrieve content.");
                    }
                    finalContent = currentData.data.content || '';
                }

                finalContent = finalContent.replace(/<!-- mcp_edited:\s*\d+\s*-->\s*/g, '');
                finalContent += `\n<!-- mcp_edited: ${Date.now()} -->`;

                const payload = {};
                if (title !== undefined) payload.title = title;
                if (status !== undefined) payload.status = status;
                payload.content = finalContent;

                const result = await wpFetch(`/wp-json/assist-agent/v1/posts/update/${id}`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error updating post: ${error.message}` }]
                };
            }
        }
    );

    return server;
}

// ---------------------------------------------------------
// Express Routes for SSE Transport
// ---------------------------------------------------------
const transports = new Map();

app.get('/sse', async (req, res) => {
    try {
        const transport = new SSEServerTransport('/messages', res);
        const server = createMcpServer();
        await server.connect(transport);
        
        const sessionId = transport.sessionId;
        transports.set(sessionId, transport);
        
        req.on('close', () => {
            transports.delete(sessionId);
        });
    } catch (err) {
        console.error("SSE Connection error:", err);
        if (!res.headersSent) res.status(500).send("SSE Connection Error");
    }
});

app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return res.status(400).send("Missing sessionId query parameter");
    }

    const transport = transports.get(sessionId);
    if (!transport) {
        return res.status(404).send("Session not found");
    }

    try {
        await transport.handlePostMessage(req, res);
    } catch (err) {
        console.error("Error handling POST message:", err);
        if (!res.headersSent) res.status(500).send("Internal Error");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`WP-MCP Service is running on http://localhost:${PORT}`);
    console.log(`SSE connection endpoint: http://localhost:${PORT}/sse`);
});
