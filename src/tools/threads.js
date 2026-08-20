import { z } from "zod";

export function registerThreadsTools(server, wpFetch) {
  // ---------------------------------------------------------
  // Tool: Get_Threads_Accounts
  // ---------------------------------------------------------
  server.tool(
    "Get_Threads_Accounts",
    "Get the list of Threads Accounts configured by the admin.",
    {},
    async () => {
      try {
        const data = await wpFetch(`/wp-json/assist-agent/v1/threads/accounts`);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error fetching Threads Accounts: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // ---------------------------------------------------------
  // Tool: Post_To_Threads
  // ---------------------------------------------------------
  server.tool(
    "Post_To_Threads",
    "Post text and optionally media to one or multiple Threads Accounts.",
    {
      content: z
        .string()
        .describe("The text content for the Threads post."),
      media_urls: z
        .array(z.string())
        .optional()
        .describe(
          "Optional array of image or video URLs to attach. Max 10 items for a carousel.",
        ),
      account_ids: z
        .array(z.string())
        .describe("Array of Threads User IDs to publish this post to."),
    },
    async (args) => {
      try {
        const data = await wpFetch(`/wp-json/assist-agent/v1/threads/post`, {
          method: "POST",
          body: JSON.stringify({
            content: args.content,
            media_urls: args.media_urls || [],
            account_ids: args.account_ids,
          }),
        });

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text", text: `Error posting to Threads: ${error.message}` },
          ],
        };
      }
    },
  );
}
