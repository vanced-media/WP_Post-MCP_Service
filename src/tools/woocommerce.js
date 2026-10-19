import { z } from "zod";

export function registerWooCommerceTools(server, wpFetch, permissions = {}) {
    const canVar = !!permissions.product_variation_manage;
    const canSeo = !!permissions.product_use_rankmath;

    const imageFields = {
        image_id: z.number().int().nonnegative().optional().describe("Main product image attachment ID on this website. Omit to keep unchanged; 0 removes the image. Find IDs with Search_Media or Upload_Media (normal_upload)."),
        gallery_image_ids: z.array(z.number().int().positive()).optional().describe("Ordered image attachment IDs on this website. Replaces the entire gallery; omit to keep, [] to clear. To add images, read current IDs with Get_Woo_Product_Detail and send the merged list. Use normal_upload, not social_upload.")
    };

    // Attribute schema: chỉ cung cấp is_variation cho Agent khi có quyền product_variation_manage
    const attributeItemSchema = z.object({
        attribute_id: z.number().optional().describe("Global attribute ID (if using an existing global attribute)"),
        name: z.string().describe("Attribute name or taxonomy (e.g. 'Color', 'Size', or 'pa_color')"),
        options: z.array(z.string()).describe("Array of attribute term values or text options (e.g. ['Red', 'Blue'])"),
        visible: z.boolean().optional().describe("Whether this attribute is visible on the product page (default: true)"),
        ...(canVar ? {
            is_variation: z.boolean().optional().describe("Whether this attribute is used for product variations (default: false)")
        } : {})
    });

    const UNCHANGED = z.literal('mode_unchange');
    const seoText = (d) => z.string().optional().describe(`${d} Send 'mode_unchange' to keep, '' to reset to RankMath default.`);
    const seoSchema = z.object({
        focus_keyword: seoText("Focus keywords (comma-separated, first is primary)."),
        seo_title: seoText("SEO title tag (supports RankMath variables %title% %sep% %sitename%)."),
        seo_description: seoText("SEO meta description (~150-160 chars)."),
        canonical_url: seoText("Custom canonical URL."),
        robots: z.union([UNCHANGED, z.array(z.enum(['index', 'noindex', 'follow', 'nofollow', 'noarchive', 'noimageindex', 'nosnippet']))]).optional()
            .describe("Robots directives array. Send 'mode_unchange' to keep, [] to reset to default."),
        pillar_content: z.union([UNCHANGED, z.boolean()]).optional()
            .describe("Mark product as pillar content. Send 'mode_unchange' to keep."),
        facebook_title: seoText("Facebook Open Graph title."),
        facebook_description: seoText("Facebook Open Graph description."),
        facebook_image_id: z.union([UNCHANGED, z.number()]).optional()
            .describe("Media attachment ID for Facebook OG image. Send 'mode_unchange' to keep, 0 to reset.")
    }).describe("RankMath SEO configuration. Send 'mode_unchange' for any fields you want to leave intact.");

    // -------------------------------------------------------------
    // 1. PRODUCT MANAGEMENT TOOLS
    // -------------------------------------------------------------

    // Tool: Get_Woo_Products
    if (permissions.product_read) {
        server.tool(
            "Get_Woo_Products",
            "Search and list WooCommerce products with support for keyword search, category filtering, status filtering, and pagination. Products with variations will include 'has_variations: true' and 'variations' (list of ID and name only).",
            {
                search: z.string().optional().describe("Keyword to search in product title or description"),
                category_id: z.number().optional().describe("Filter by WooCommerce product category ID"),
                status: z.enum(['publish', 'draft', 'any']).optional().describe("Filter by product status. Defaults to 'publish'."),
                limit: z.number().optional().describe("Max number of products to return (default: 10)"),
                page: z.number().optional().describe("Page number for pagination (default: 1)")
            },
            async ({ search, category_id, status = 'publish', limit = 10, page = 1 }) => {
                try {
                    let url = `/wp-json/assist-agent/v1/products?limit=${limit}&page=${page}&status=${encodeURIComponent(status)}`;
                    if (search) {
                        url += `&search=${encodeURIComponent(search)}`;
                    }
                    if (category_id) {
                        url += `&category_id=${category_id}`;
                    }
                    const data = await wpFetch(url);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching products: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Get_Woo_Product_Detail
        server.tool(
            "Get_Woo_Product_Detail",
            `Get comprehensive details of a single WooCommerce product by its ID (including SKU, stock quantity, regular & sale prices, description, categories, tags, image_id, image, ordered gallery_image_ids and gallery_images). Read the current gallery before adding or reordering images. Products with variations will include 'has_variations: true' and 'variations' (list of ID and name only). For full variation details, use Get_Woo_Products_with_variations.${canSeo ? " Includes RankMath 'seo' block with seo_score (read-only, computed in WP editor)." : ""}`,
            {
                id: z.number().describe("The WooCommerce Product ID")
            },
            async ({ id }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/${id}`);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching product details: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Tool: Create_Woo_Product
    if (permissions.product_create) {
        server.tool(
            "Create_Woo_Product",
            "Create a new WooCommerce product with optional main image and gallery attachment IDs. Upload URL/base64 images first with Upload_Media using normal_upload. By default saved as 'draft' unless 'publish' is explicitly specified.",
            {
                name: z.string().describe("The name or title of the product"),
                regular_price: z.number().optional().describe("Standard regular selling price (for simple products, or fallback price for variations)"),
                sale_price: z.number().optional().describe("Discounted/Sale price"),
                description: z.string().optional().describe("Full HTML or text description of the product"),
                short_description: z.string().optional().describe("Short excerpt summary of the product"),
                sku: z.string().optional().describe("Stock Keeping Unit (SKU) identifier"),
                stock_status: z.enum(['instock', 'outofstock', 'onbackorder']).optional().describe("Stock status"),
                stock_quantity: z.number().optional().describe("Initial stock quantity count"),
                status: z.enum(['draft', 'publish']).optional().describe("Product publication status (default: 'draft')"),
                category_ids: z.array(z.number()).optional().describe("Array of category IDs to assign to this product"),
                tag_ids: z.array(z.number()).optional().describe("Array of product tag IDs to assign to this product"),
                ...imageFields,
                attributes: z.array(attributeItemSchema).optional().describe("Array of product attributes to assign"),
                ...(canVar ? {
                    type: z.enum(['simple', 'variable']).optional().describe("Product type: 'simple' (default) or 'variable' (for products with variations)"),
                    auto_generate_variations: z.boolean().optional().describe("If true and type is variable, automatically generate all variation combinations from attributes with is_variation=true (max 24). You MUST review generated variations afterwards."),
                    default_regular_price: z.number().optional().describe("Price to apply to all automatically generated variations. If omitted, inherits parent's regular price."),
                    variation_status: z.enum(['publish', 'private']).optional().describe("Publication status for generated variations (default: 'publish'). If variations have no price, they are automatically set to 'private'.")
                } : {}),
                ...(canSeo ? {
                    seo: seoSchema.optional()
                } : {})
            },
            async (args) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/create`, {
                        method: 'POST',
                        body: JSON.stringify(args)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error creating product: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Tool: Update_Woo_Product
    if (permissions.product_edit) {
        server.tool(
            "Update_Woo_Product",
            "Update an existing WooCommerce product's details, main image or gallery. Omitted image fields remain unchanged. image_id=0 removes the main image; gallery_image_ids=[] clears the gallery. A supplied gallery replaces the full ordered list without deleting media files.",
            {
                id: z.number().describe("Product ID to update"),
                name: z.string().optional().describe("Updated product title"),
                description: z.string().optional().describe("Updated product description"),
                short_description: z.string().optional().describe("Updated short summary"),
                regular_price: z.number().optional().describe("Updated regular price"),
                sale_price: z.number().optional().describe("Updated sale price"),
                stock_status: z.enum(['instock', 'outofstock', 'onbackorder']).optional().describe("Updated stock status"),
                stock_quantity: z.number().optional().describe("Updated stock quantity"),
                sku: z.string().optional().describe("Updated SKU"),
                status: z.enum(['draft', 'publish', 'private']).optional().describe("Updated status"),
                category_ids: z.array(z.number()).optional().describe("Updated array of category IDs"),
                tag_ids: z.array(z.number()).optional().describe("Updated array of product tag IDs"),
                ...imageFields,
                attributes: z.array(attributeItemSchema).optional().describe("Updated array of product attributes (replaces existing attributes if provided)"),
                ...(canVar ? {
                    type: z.enum(['simple', 'variable']).optional().describe("Product type. Can convert from 'simple' to 'variable' (one-way only)."),
                    auto_generate_variations: z.boolean().optional().describe("If true, automatically generate all missing variation combinations (max 24 total). You MUST review results via Get_Woo_Products_with_variations afterwards."),
                    default_regular_price: z.number().optional().describe("Price for generated variations. If omitted, inherits parent's regular price."),
                    variation_status: z.enum(['publish', 'private']).optional().describe("Status for generated variations (default: 'publish').")
                } : {}),
                ...(canSeo ? {
                    seo: seoSchema.optional()
                } : {})
            },
            async ({ id, ...body }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/update/${id}`, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error updating product #${id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Tool: Delete_Woo_Product
    if (permissions.product_delete) {
        server.tool(
            "Delete_Woo_Product",
            "Delete or move a WooCommerce product to trash. By default, moves product to trash. Set force=true to permanently delete.",
            {
                id: z.number().describe("Product ID to delete"),
                force: z.boolean().optional().describe("Whether to permanently delete (true) or move to trash (false, default)")
            },
            async ({ id, force = false }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/${id}?force=${force}`, {
                        method: 'DELETE'
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error deleting product #${id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // -------------------------------------------------------------
    // 2. ORDER MANAGEMENT TOOLS
    // -------------------------------------------------------------

    // Tool: List_Woo_Orders
    if (permissions.order_list) {
        server.tool(
            "List_Woo_Orders",
            "List and filter WooCommerce orders by status, customer ID, or search query.",
            {
                status: z.enum(['any', 'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed']).optional().describe("Filter by order status (default: 'any')"),
                search: z.string().optional().describe("Search keyword (order ID, customer name, email, or phone)"),
                customer_id: z.number().optional().describe("Filter orders belonging to a specific customer ID"),
                limit: z.number().optional().describe("Number of orders to retrieve (default: 10)"),
                page: z.number().optional().describe("Pagination page number (default: 1)")
            },
            async ({ status = 'any', search, customer_id, limit = 10, page = 1 }) => {
                try {
                    let url = `/wp-json/assist-agent/v1/orders?status=${encodeURIComponent(status)}&limit=${limit}&page=${page}`;
                    if (search) {
                        url += `&search=${encodeURIComponent(search)}`;
                    }
                    if (customer_id) {
                        url += `&customer_id=${customer_id}`;
                    }
                    const data = await wpFetch(url);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching orders: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Tool: Get_Woo_Order_Detail
    if (permissions.order_read) {
        server.tool(
            "Get_Woo_Order_Detail",
            "Get full details of a specific WooCommerce order (including line items, quantities, totals, shipping/billing address, notes, and custom fields).",
            {
                id: z.number().describe("Order ID")
            },
            async ({ id }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/orders/${id}`);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching order #${id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Tool: Update_Woo_Order
    if (permissions.order_update) {
        server.tool(
            "Update_Woo_Order",
            "Update WooCommerce order information, including order status, customer-facing note, internal staff note, custom fields (metadata), and completion/paid dates.",
            {
                id: z.number().describe("Order ID to update"),
                status: z.enum(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed']).optional().describe("New status for the order"),
                customer_note: z.string().optional().describe("Customer note visible on the order receipt"),
                internal_note: z.string().optional().describe("Internal staff note logged into the order history"),
                is_customer_note: z.boolean().optional().describe("If true, internal_note is marked as a customer-facing note"),
                custom_fields: z.record(z.any()).optional().describe("Key-value object of custom meta fields to attach or update (e.g. {'delivery_time': '14:00', 'tracking_code': 'VN12345'})"),
                date_completed: z.string().optional().describe("Order completion date string (e.g. 'YYYY-MM-DD HH:MM:SS')"),
                date_paid: z.string().optional().describe("Order paid date string (e.g. 'YYYY-MM-DD HH:MM:SS')")
            },
            async ({ id, ...body }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/orders/${id}/update`, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error updating order #${id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // -------------------------------------------------------------
    // 3. CLIENT / CUSTOMER MANAGEMENT TOOLS
    // -------------------------------------------------------------

    // Tool: List_Woo_Customers
    if (permissions.customer_list) {
        server.tool(
            "List_Woo_Customers",
            "List and search WooCommerce customers/clients by keyword, name, or email.",
            {
                search: z.string().optional().describe("Search keyword (name, email, or username)"),
                limit: z.number().optional().describe("Number of customers to return (default: 10)"),
                page: z.number().optional().describe("Pagination page number (default: 1)")
            },
            async ({ search, limit = 10, page = 1 }) => {
                try {
                    let url = `/wp-json/assist-agent/v1/customers?limit=${limit}&page=${page}`;
                    if (search) {
                        url += `&search=${encodeURIComponent(search)}`;
                    }
                    const data = await wpFetch(url);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching customers: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Tool: Get_Woo_Customer_Detail
    if (permissions.customer_read) {
        server.tool(
            "Get_Woo_Customer_Detail",
            "Get detailed profile of a WooCommerce customer, including contact info, addresses, total spent, order count, and recent orders.",
            {
                id: z.number().describe("Customer User ID")
            },
            async ({ id }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/customers/${id}`);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching customer #${id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // -------------------------------------------------------------
    // 4. CATALOG STRUCTURE TOOLS (Categories, Tags & Attributes)
    // -------------------------------------------------------------

    // Read Catalog: Get_Woo_Categories, Get_Woo_Tags, Get_Woo_Attributes, Get_Woo_Attribute_Terms
    if (permissions.catalog_read) {
        // Tool: Get_Woo_Categories
        server.tool(
            "Get_Woo_Categories",
            "List WooCommerce product categories with support for search, parent category filtering, hide empty, and pagination.",
            {
                search: z.string().optional().describe("Search term for category name"),
                parent: z.number().optional().describe("Filter by direct parent category ID (0 for top-level only)"),
                hide_empty: z.boolean().optional().describe("Whether to hide categories that have no products (default: false)"),
                limit: z.number().optional().describe("Max number of categories to return (default: 50)"),
                page: z.number().optional().describe("Page number for pagination (default: 1)")
            },
            async ({ search, parent, hide_empty = false, limit = 50, page = 1 }) => {
                try {
                    let url = `/wp-json/assist-agent/v1/product-categories?limit=${limit}&page=${page}&hide_empty=${hide_empty ? 1 : 0}`;
                    if (search) {
                        url += `&search=${encodeURIComponent(search)}`;
                    }
                    if (parent !== undefined) {
                        url += `&parent=${parent}`;
                    }
                    const data = await wpFetch(url);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching product categories: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Get_Woo_Tags
        server.tool(
            "Get_Woo_Tags",
            "List WooCommerce product tags with search and pagination.",
            {
                search: z.string().optional().describe("Search term for tag name"),
                hide_empty: z.boolean().optional().describe("Whether to hide tags with no products (default: false)"),
                limit: z.number().optional().describe("Max number of tags to return (default: 50)"),
                page: z.number().optional().describe("Page number for pagination (default: 1)")
            },
            async ({ search, hide_empty = false, limit = 50, page = 1 }) => {
                try {
                    let url = `/wp-json/assist-agent/v1/product-tags?limit=${limit}&page=${page}&hide_empty=${hide_empty ? 1 : 0}`;
                    if (search) {
                        url += `&search=${encodeURIComponent(search)}`;
                    }
                    const data = await wpFetch(url);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching product tags: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Get_Woo_Attributes
        server.tool(
            "Get_Woo_Attributes",
            "List all WooCommerce global attributes (taxonomies starting with pa_*) and optionally their defined terms.",
            {
                with_terms: z.boolean().optional().describe("Whether to include terms for each attribute (default: true)")
            },
            async ({ with_terms = true }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/product-attributes?with_terms=${with_terms ? 1 : 0}`);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching product attributes: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Get_Woo_Attribute_Terms
        server.tool(
            "Get_Woo_Attribute_Terms",
            "List all term values of a specific global WooCommerce attribute by attribute ID.",
            {
                attribute_id: z.number().describe("The ID of the global attribute")
            },
            async ({ attribute_id }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/product-attributes/${attribute_id}/terms`);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching attribute terms for attribute #${attribute_id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Manage Categories & Tags: Create_Woo_Term, Update_Woo_Term
    if (permissions.catalog_terms_manage) {
        // Tool: Create_Woo_Term
        server.tool(
            "Create_Woo_Term",
            "Create a new WooCommerce product category or product tag.",
            {
                taxonomy: z.enum(['category', 'tag']).describe("Term type: 'category' for product category or 'tag' for product tag"),
                name: z.string().describe("Name of the category or tag"),
                slug: z.string().optional().describe("URL slug for the term"),
                description: z.string().optional().describe("Description for the term"),
                parent: z.number().optional().describe("Parent category ID (applicable to categories only)")
            },
            async ({ taxonomy, ...body }) => {
                try {
                    const path = taxonomy === 'category'
                        ? '/wp-json/assist-agent/v1/product-categories'
                        : '/wp-json/assist-agent/v1/product-tags';
                    const data = await wpFetch(path, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error creating ${taxonomy}: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Update_Woo_Term
        server.tool(
            "Update_Woo_Term",
            "Update an existing WooCommerce product category or product tag.",
            {
                taxonomy: z.enum(['category', 'tag']).describe("Term type: 'category' or 'tag'"),
                id: z.number().describe("ID of the category or tag to update"),
                name: z.string().optional().describe("Updated name"),
                slug: z.string().optional().describe("Updated slug"),
                description: z.string().optional().describe("Updated description"),
                parent: z.number().optional().describe("Updated parent category ID (categories only)")
            },
            async ({ taxonomy, id, ...body }) => {
                try {
                    const path = taxonomy === 'category'
                        ? `/wp-json/assist-agent/v1/product-categories/${id}`
                        : `/wp-json/assist-agent/v1/product-tags/${id}`;
                    const data = await wpFetch(path, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error updating ${taxonomy} #${id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Manage Attributes & Terms: Create_Woo_Attribute, Update_Woo_Attribute, Upsert_Woo_Attribute_Term
    if (permissions.catalog_attributes_manage) {
        // Tool: Create_Woo_Attribute
        server.tool(
            "Create_Woo_Attribute",
            "Create a new WooCommerce global product attribute (e.g. Color, Size, Brand).",
            {
                name: z.string().describe("Human-readable attribute name (e.g. 'Màu sắc', 'Kích cỡ')"),
                slug: z.string().optional().describe("Attribute slug without pa_ prefix (max 25 characters, e.g. 'mau-sac')"),
                type: z.enum(['select']).optional().describe("Attribute type (default: 'select')"),
                order_by: z.enum(['menu_order', 'name', 'name_num', 'id']).optional().describe("Sorting order (default: 'menu_order')"),
                has_archives: z.boolean().optional().describe("Enable archive page for this attribute (default: false)")
            },
            async (args) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/product-attributes`, {
                        method: 'POST',
                        body: JSON.stringify(args)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error creating attribute: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Update_Woo_Attribute
        server.tool(
            "Update_Woo_Attribute",
            "Update an existing global WooCommerce product attribute's name, slug, or settings.",
            {
                id: z.number().describe("The attribute ID to update"),
                name: z.string().optional().describe("Updated attribute name"),
                slug: z.string().optional().describe("Updated slug without pa_ prefix"),
                order_by: z.enum(['menu_order', 'name', 'name_num', 'id']).optional().describe("Updated sorting order"),
                has_archives: z.boolean().optional().describe("Updated archive page setting")
            },
            async ({ id, ...body }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/product-attributes/${id}`, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error updating attribute #${id}: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Upsert_Woo_Attribute_Term
        server.tool(
            "Upsert_Woo_Attribute_Term",
            "Add a term value to a global WooCommerce product attribute (e.g. add 'Đỏ' or 'Xanh' to attribute 'Color').",
            {
                attribute_id: z.number().describe("The ID of the global attribute"),
                name: z.string().describe("Term value name (e.g. 'Red', 'Blue', 'XL')"),
                slug: z.string().optional().describe("Optional URL slug for the term"),
                description: z.string().optional().describe("Optional description for the term")
            },
            async ({ attribute_id, ...body }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/product-attributes/${attribute_id}/terms`, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error adding term to attribute #${attribute_id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // Delete Catalog Items: Delete_Woo_Catalog_Item
    if (permissions.catalog_delete) {
        server.tool(
            "Delete_Woo_Catalog_Item",
            "Permanently delete a product category, tag, global attribute, or attribute term from WooCommerce. Warning: Deleting a category or attribute cannot be undone.",
            {
                type: z.enum(['category', 'tag', 'attribute', 'attribute_term']).describe("Type of item to delete: 'category', 'tag', 'attribute', or 'attribute_term'"),
                id: z.number().describe("ID of the category, tag, or attribute to delete. For 'attribute_term', this is the term ID."),
                attribute_id: z.number().optional().describe("Required ONLY when type is 'attribute_term' to identify the parent attribute ID")
            },
            async ({ type, id, attribute_id }) => {
                try {
                    let path = '';
                    switch (type) {
                        case 'category':
                            path = `/wp-json/assist-agent/v1/product-categories/${id}`;
                            break;
                        case 'tag':
                            path = `/wp-json/assist-agent/v1/product-tags/${id}`;
                            break;
                        case 'attribute':
                            path = `/wp-json/assist-agent/v1/product-attributes/${id}`;
                            break;
                        case 'attribute_term':
                            if (!attribute_id) {
                                return {
                                    isError: true,
                                    content: [{ type: "text", text: "attribute_id is required when deleting an attribute_term" }]
                                };
                            }
                            path = `/wp-json/assist-agent/v1/product-attributes/${attribute_id}/terms/${id}`;
                            break;
                    }

                    const data = await wpFetch(path, { method: 'DELETE' });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error deleting catalog ${type} #${id}: ${error.message}` }]
                    };
                }
            }
        );
    }

    // -------------------------------------------------------------
    // 5. PRODUCT VARIATIONS MANAGEMENT TOOLS
    // -------------------------------------------------------------

    if (canVar) {
        // Tool: Get_Woo_Products_with_variations
        server.tool(
            "Get_Woo_Products_with_variations",
            "Get complete details of a variable WooCommerce product, including the parent product's main image and ordered gallery, and full information of all its variations (ID, name, SKU, price, regular/sale price, stock, attributes, and status).",
            {
                id: z.number().describe("The parent variable Product ID")
            },
            async ({ id }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/${id}/full`);
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching product with variations #${id}: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Create_Woo_Variation
        server.tool(
            "Create_Woo_Variation",
            "Create a single new variation for a variable product. A product can have a maximum of 24 variations.",
            {
                product_id: z.number().describe("Parent variable product ID"),
                attributes: z.record(z.string()).describe("Key-value map of attributes for this variation, where key is attribute taxonomy/slug (e.g. 'pa_color' or 'size') and value is term slug/value (e.g. {'pa_color': 'red', 'pa_size': 'xl'})"),
                regular_price: z.number().optional().describe("Regular selling price for this variation"),
                sale_price: z.number().optional().describe("Sale price for this variation"),
                sku: z.string().optional().describe("SKU for this variation"),
                stock_status: z.enum(['instock', 'outofstock', 'onbackorder']).optional().describe("Stock status (default: 'instock')"),
                stock_quantity: z.number().optional().describe("Stock quantity count"),
                status: z.enum(['publish', 'private']).optional().describe("Publication status (default: 'publish'). If no regular_price is set, variation is automatically saved as 'private'."),
                description: z.string().optional().describe("Description specific to this variation")
            },
            async ({ product_id, ...body }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/${product_id}/variations`, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error creating variation for product #${product_id}: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Update_Woo_Variation
        server.tool(
            "Update_Woo_Variation",
            "Update an existing variation's price, stock, SKU, status, or attributes.",
            {
                product_id: z.number().describe("Parent variable product ID"),
                variation_id: z.number().describe("Variation ID to update"),
                attributes: z.record(z.string()).optional().describe("Updated attribute combination map"),
                regular_price: z.number().optional().describe("Updated regular price"),
                sale_price: z.number().optional().describe("Updated sale price"),
                sku: z.string().optional().describe("Updated SKU"),
                stock_status: z.enum(['instock', 'outofstock', 'onbackorder']).optional().describe("Updated stock status"),
                stock_quantity: z.number().optional().describe("Updated stock quantity"),
                status: z.enum(['publish', 'private']).optional().describe("Updated status"),
                description: z.string().optional().describe("Updated description")
            },
            async ({ product_id, variation_id, ...body }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/${product_id}/variations/${variation_id}`, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error updating variation #${variation_id}: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Delete_Woo_Variation
        server.tool(
            "Delete_Woo_Variation",
            "Permanently delete a single product variation from a variable product. Warning: cannot be undone.",
            {
                product_id: z.number().describe("Parent variable product ID"),
                variation_id: z.number().describe("Variation ID to delete")
            },
            async ({ product_id, variation_id }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/${product_id}/variations/${variation_id}`, {
                        method: 'DELETE'
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error deleting variation #${variation_id}: ${error.message}` }]
                    };
                }
            }
        );

        // Tool: Generate_Woo_Variations
        server.tool(
            "Generate_Woo_Variations",
            "Automatically generate all possible variations from the parent product's attributes that have is_variation=true. Maximum 24 variations total. You MUST inspect and review the generated variations via Get_Woo_Products_with_variations to adjust prices or delete unnecessary variations.",
            {
                product_id: z.number().describe("Parent variable product ID"),
                default_regular_price: z.number().optional().describe("Price to assign to all generated variations. If omitted, inherits parent's regular price."),
                variation_status: z.enum(['publish', 'private']).optional().describe("Publication status for generated variations (default: 'publish'). If no price is available, set to 'private'.")
            },
            async ({ product_id, ...body }) => {
                try {
                    const data = await wpFetch(`/wp-json/assist-agent/v1/products/${product_id}/variations/generate`, {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
                    };
                } catch (error) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error generating variations for product #${product_id}: ${error.message}` }]
                    };
                }
            }
        );
    }
}

