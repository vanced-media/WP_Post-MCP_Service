export function registerTaxonomiesTools(server, wpFetch) {
    // ---------------------------------------------------------
    // Tool: get_Taxonomies
    // ---------------------------------------------------------
    server.tool(
        "get_Taxonomies",
        "Get a list of all categories and tags from WordPress.",
        {},
        async () => {
            try {
                const data = await wpFetch(`/wp-json/assist-agent/v1/taxonomies`);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error fetching taxonomies: ${error.message}` }]
                };
            }
        }
    );
}
