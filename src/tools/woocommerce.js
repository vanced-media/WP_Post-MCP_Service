import { z } from "zod";

export function registerWooCommerceTools(server, wpFetch, permissions = {}) {
    // -------------------------------------------------------------
    // 1. PRODUCT MANAGEMENT TOOLS
    // -------------------------------------------------------------

    // Tool: Get_Woo_Products
    if (permissions.product_read) {
        server.tool(
            "Get_Woo_Products",
            "Search and list WooCommerce products with support for keyword search, category filtering, status filtering, and pagination.",
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
            "Get comprehensive details of a single WooCommerce product by its ID (including SKU, stock quantity, regular & sale prices, description, categories, and tags).",
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
            "Create a new WooCommerce product. By default saved as 'draft' for safety unless 'publish' is explicitly specified.",
            {
                name: z.string().describe("The name or title of the product"),
                regular_price: z.number().optional().describe("Standard regular selling price"),
                sale_price: z.number().optional().describe("Discounted/Sale price"),
                description: z.string().optional().describe("Full HTML or text description of the product"),
                short_description: z.string().optional().describe("Short excerpt summary of the product"),
                sku: z.string().optional().describe("Stock Keeping Unit (SKU) identifier"),
                stock_status: z.enum(['instock', 'outofstock', 'onbackorder']).optional().describe("Stock status"),
                stock_quantity: z.number().optional().describe("Initial stock quantity count"),
                status: z.enum(['draft', 'publish']).optional().describe("Product publication status (default: 'draft')"),
                category_ids: z.array(z.number()).optional().describe("Array of category IDs to assign to this product")
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
            "Update an existing WooCommerce product's details such as title, description, pricing, inventory stock, SKU, or category assignment.",
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
                category_ids: z.array(z.number()).optional().describe("Updated array of category IDs")
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
}
