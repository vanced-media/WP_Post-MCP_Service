import { z } from "zod";

export function registerMediaTools(server, wpFetch) {
  // ---------------------------------------------------------
  // Tool: Search_Media
  // ---------------------------------------------------------
  server.tool(
    "Search_Media",
    "Search the WordPress Media Library by ID, keyword, or prompt.",
    {
      id: z.number().optional().describe("Media ID to fetch exactly one item"),
      search: z
        .string()
        .optional()
        .describe("Keyword to search in title/filename"),
      prompt: z
        .string()
        .optional()
        .describe("Keyword to search in AI generated prompt meta"),
    },
    async ({ id, search, prompt }) => {
      try {
        let url = `/wp-json/assist-agent/v1/media?`;
        const params = [];
        if (id) params.push(`id=${id}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (prompt) params.push(`prompt=${encodeURIComponent(prompt)}`);
        url += params.join("&");

        const data = await wpFetch(url);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text", text: `Error searching media: ${error.message}` },
          ],
        };
      }
    },
  );

  // ---------------------------------------------------------
  // Tool: Upload_Media
  // ---------------------------------------------------------
  server.tool(
    "Upload_Media",
    "Upload an image to the WordPress Media Library. You can provide an absolute URL OR a base64 string. The server will compress images > 1.3MB to WebP. NOTE: Only upload 1 file at a time. Wait for the file finish upload before upload another.",
    {
      file_url: z
        .string()
        .optional()
        .describe("Absolute URL of the image to download"),
      file_base64: z
        .string()
        .max(4194304)
        .optional()
        .describe(
          "Base64 string of the image (max 3MB / ~4M chars). Use this for IDE/direct uploads.",
        ),
      upload_purpose: z
        .enum(["normal_upload", "facebook_upload"])
        .optional()
        .describe(
          "Specify facebook_upload if the image is strictly for posting to Facebook, allowing admins to easily clean it up later.",
        ),
      file_name: z
        .string()
        .optional()
        .describe("Desired filename (without extension)"),
      alt_text: z.string().optional().describe("Image alt text for SEO"),
      title: z.string().optional().describe("Image title"),
      caption: z.string().optional().describe("Image caption"),
      description: z.string().optional().describe("Image description"),
      prompt: z
        .string()
        .optional()
        .describe(
          "The AI prompt used to generate this image (saved for reference)",
        ),
    },
    async (args) => {
      try {
        const result = await wpFetch(`/wp-json/assist-agent/v1/media`, {
          method: "POST",
          body: JSON.stringify(args),
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text", text: `Error uploading media: ${error.message}` },
          ],
        };
      }
    },
  );
}
