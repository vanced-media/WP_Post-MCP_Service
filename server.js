import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./src/tools/index.js";

dotenv.config();

const app = express();
app.use(cors());

// Load sites configuration
const sitesConfigPath = path.resolve('./sites.json');
let sitesConfig = {};
try {
    if (fs.existsSync(sitesConfigPath)) {
        sitesConfig = JSON.parse(fs.readFileSync(sitesConfigPath, 'utf8'));
    }
} catch (e) {
    console.error("Failed to load sites.json:", e);
}

// ---------------------------------------------------------
// Express Routes for SSE Transport
// ---------------------------------------------------------
const transports = new Map();

app.get('/sse', async (req, res) => {
    try {
        const apiKey = req.query.apiKey;
        if (!apiKey) {
            return res.status(401).send("Unauthorized: Missing apiKey parameter.");
        }

        const siteConfig = sitesConfig[apiKey];
        if (!siteConfig) {
            return res.status(401).send("Unauthorized: Invalid apiKey.");
        }
        
        // Calculate auth header
        const authHeader = 'Basic ' + Buffer.from(`${siteConfig.user}:${siteConfig.pass}`).toString('base64');
        const finalSiteConfig = {
            url: siteConfig.url,
            authHeader: authHeader
        };

        const transport = new SSEServerTransport('/messages', res);
        const server = createMcpServer(finalSiteConfig);
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
