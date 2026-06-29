import { z } from "zod";
import { wpFetch } from "../utils/wpFetch.js";

export function registerMediaTools(server) {
    // ---------------------------------------------------------
    // Tool: Search_Media
    // ---------------------------------------------------------
    server.tool(
        "Search_Media",
        "Search the WordPress Media Library by ID, keyword, or prompt.",
        {
            id: z.number().optional().describe("Media ID to fetch exactly one item"),
            search: z.string().optional().describe("Keyword to search in title/filename"),
            prompt: z.string().optional().describe("Keyword to search in AI generated prompt meta")
        },
        async ({ id, search, prompt }) => {
            try {
                let url = `/wp-json/assist-agent/v1/media?`;
                const params = [];
                if (id) params.push(`id=${id}`);
                if (search) params.push(`search=${encodeURIComponent(search)}`);
                if (prompt) params.push(`prompt=${encodeURIComponent(prompt)}`);
                url += params.join('&');

                const data = await wpFetch(url);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error searching media: ${error.message}` }]
                };
            }
        }
    );

    // ---------------------------------------------------------
    // Tool: Upload_Media
    // ---------------------------------------------------------
    server.tool(
        "Upload_Media",
        "Upload an image to the WordPress Media Library via URL. Does NOT accept base64. The server will download the image and convert it to WebP.",
        {
            file_url: z.string().describe("Absolute URL of the image to download and upload"),
            file_name: z.string().optional().describe("Desired filename (without extension)"),
            alt_text: z.string().optional().describe("Image alt text for SEO"),
            title: z.string().optional().describe("Image title"),
            caption: z.string().optional().describe("Image caption"),
            description: z.string().optional().describe("Image description"),
            prompt: z.string().optional().describe("The AI prompt used to generate this image (saved for reference)")
        },
        async (args) => {
            try {
                const result = await wpFetch(`/wp-json/assist-agent/v1/media`, {
                    method: 'POST',
                    body: JSON.stringify(args)
                });

                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error uploading media: ${error.message}` }]
                };
            }
        }
    );
}
