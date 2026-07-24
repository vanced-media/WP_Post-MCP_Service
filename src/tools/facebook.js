import { z } from "zod";

export function registerFacebookTools(server, wpFetch) {
    // ---------------------------------------------------------
    // Tool: Get_Facebook_Pages
    // ---------------------------------------------------------
    server.tool(
        "Get_Facebook_Pages",
        "Retrieve a list of available Facebook Pages (Fanpages) that have been configured and enabled in WordPress. Use this tool before posting to know which pages the user can post to.",
        {},
        async () => {
            try {
                const data = await wpFetch(`/wp-json/assist-agent/v1/facebook/pages`);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error fetching facebook pages: ${error.message}` }]
                };
            }
        }
    );

    // ---------------------------------------------------------
    // Tool: Post_To_Facebook
    // ---------------------------------------------------------
    server.tool(
        "Post_To_Facebook",
        "Post content to one or more Facebook Pages. You must provide the content, optional media URLs, and an array of target Page IDs. The system will automatically attach the configured footer for each page.",
        {
            content: z.string().describe("The text content of the Facebook post. Keep it engaging, concise, and use emojis or hashtags if appropriate."),
            media_urls: z.array(z.string()).optional().describe("Optional array of absolute image URLs to attach to the post. Use this to post single or multiple images."),
            page_ids: z.array(z.string()).describe("An array of Facebook Page IDs to post to. You can get these IDs from the Get_Facebook_Pages tool."),
            publish_mode: z.enum(['published', 'scheduled']).optional().describe("Mode to publish. Defaults to 'published'. Use 'scheduled' for scheduled posts."),
            scheduled_publish_time: z.string().optional().describe("ISO 8601 string containing timezone (e.g., '2026-07-25T15:30:00+07:00'). Required ONLY if publish_mode is 'scheduled'. Time must be between 10 mins and 75 days from now.")
        },
        async (args) => {
            try {
                const data = await wpFetch(`/wp-json/assist-agent/v1/facebook/post`, {
                    method: 'POST',
                    body: JSON.stringify({
                        content: args.content,
                        media_urls: args.media_urls || [],
                        page_ids: args.page_ids,
                        publish_mode: args.publish_mode,
                        scheduled_publish_time: args.scheduled_publish_time
                    })
                });

                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error posting to Facebook: ${error.message}` }]
                };
            }
        }
    );
}
