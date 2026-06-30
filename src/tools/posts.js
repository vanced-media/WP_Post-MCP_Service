import { z } from "zod";

export function registerPostsTools(server, wpFetch) {
    // ---------------------------------------------------------
    // Tool: Get_PostList
    // ---------------------------------------------------------
    server.tool(
        "Get_PostList",
        "Get a list of posts or pages from WordPress, including a flag indicating if they were edited by this plugin.",
        {
            page: z.number().optional().describe("Page number (default 1)"),
            per_page: z.number().optional().describe("Items per page (default 10)"),
            filter: z.object({
                categories: z.array(z.number()).optional().describe("Array of category IDs to filter by"),
                author: z.array(z.number()).optional().describe("Array of author IDs to filter by")
            }).optional().describe("Filter options"),
            post_type: z.enum(['post', 'page']).optional().describe("Type of content to fetch (default 'post')")
        },
        async ({ page = 1, per_page = 10, filter = {}, post_type = 'post' }) => {
            try {
                let url = `/wp-json/wp/v2/${post_type === 'page' ? 'pages' : 'posts'}?page=${page}&per_page=${per_page}&_fields=id,title,content`;
                if (filter.categories && filter.categories.length > 0) {
                    url += `&categories=${filter.categories.join(',')}`;
                }
                if (filter.author && filter.author.length > 0) {
                    url += `&author=${filter.author.join(',')}`;
                }
                const data = await wpFetch(url);
                
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
    // Tool: Get_SinglePost
    // ---------------------------------------------------------
    server.tool(
        "Get_SinglePost",
        "Get all detailed information about a single post or page via the Assist Agent API.",
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
    // Tool: Create_SinglePost
    // ---------------------------------------------------------
    server.tool(
        "Create_SinglePost",
        "Create a new post or page in WordPress with optional RankMath SEO metadata.",
        {
            title: z.string().describe("Post title"),
            content: z.string().optional().describe("Post HTML content"),
            chapeau: z.string().optional().describe("Post excerpt/chapeau"),
            featured_image: z.string().optional().describe("Featured image URL"),
            status: z.string().optional().describe("Post status (draft, publish, pending, private)"),
            category_ids: z.array(z.number()).optional().describe("Array of Category IDs"),
            tags: z.array(z.string()).optional().describe("Array of tag names"),
            rankmath: z.record(z.string()).optional().describe("RankMath SEO fields (e.g., rank_math_title, rank_math_description, rank_math_focus_keyword)"),
            post_type: z.enum(['post', 'page']).optional().describe("Type of content to create (default 'post')")
        },
        async (args) => {
            try {
                let finalContent = args.content || '';
                finalContent += `\n<!-- mcp_edited: ${Date.now()} -->`;

                const payload = {
                    ...args,
                    content: finalContent
                };

                const result = await wpFetch(`/wp-json/assist-agent/v1/posts/create`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error creating post: ${error.message}` }]
                };
            }
        }
    );

    // ---------------------------------------------------------
    // Tool: Edit_SinglePost
    // ---------------------------------------------------------
    server.tool(
        "Edit_SinglePost",
        "Edit a post or page. Only updates provided fields. Automatically records the edit history via an HTML comment.",
        {
            id: z.number().describe("Post ID"),
            title: z.string().optional().describe("New title (optional)"),
            content: z.string().optional().describe("New content (optional)"),
            status: z.string().optional().describe("New status (optional)"),
            rankmath: z.record(z.string()).optional().describe("RankMath SEO fields (e.g., rank_math_title, rank_math_description, rank_math_focus_keyword)")
        },
        async ({ id, title, content, status, rankmath }) => {
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
                if (rankmath !== undefined) payload.rankmath = rankmath;
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
}
