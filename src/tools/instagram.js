import { z } from "zod";

export function registerInstagramTools(server, wpFetch) {
  // ---------------------------------------------------------
  // Tool: Get_Instagram_Accounts
  // ---------------------------------------------------------
  server.tool(
    "Get_Instagram_Accounts",
    "Get the list of Instagram Accounts configured by the admin.",
    {},
    async () => {
      try {
        const data = await wpFetch(`/wp-json/assist-agent/v1/instagram/accounts`);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error fetching Instagram Accounts: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // ---------------------------------------------------------
  // Tool: Post_To_Instagram
  // ---------------------------------------------------------
  server.tool(
    "Post_To_Instagram",
    "Post text, links and media to one or multiple Instagram Accounts. Instagram requires at least 1 image or video.",
    {
      content: z
        .string()
        .describe("The caption or content for the post."),
      media_urls: z
        .array(z.string())
        .describe(
          "Array of image or video URLs to attach. MUST NOT be empty for Instagram. Max 10 items for a carousel.",
        ),
      account_ids: z
        .array(z.string())
        .describe("Array of Instagram User IDs to publish this post to."),
    },
    async (args) => {
      try {
        const data = await wpFetch(`/wp-json/assist-agent/v1/instagram/post`, {
          method: "POST",
          body: JSON.stringify({
            content: args.content,
            media_urls: args.media_urls,
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
            { type: "text", text: `Error posting to Instagram: ${error.message}` },
          ],
        };
      }
    },
  );
}
