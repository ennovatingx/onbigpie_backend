import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Authentication & Payment APIs",
      version: "1.0.0",
      description: "REST API for user authentication, OneCard Nigeria payment services (mobile top-ups, data bundles, electricity bills, cable TV subscriptions), and OneBigPie user/voucher management",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "/api",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            universityName: { type: "string" },
            matriculationNumber: { type: "string", nullable: true },
            phoneNumber: { type: "string" },
            email: { type: "string", format: "email" },
          },
        },
         
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "john.doe@example.com" },
            password: { type: "string", format: "password", example: "securePassword123" },
          },
        },
        ForgotPasswordRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email", example: "john.doe@example.com" },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", format: "password", example: "currentPassword123" },
            newPassword: { type: "string", format: "password", minLength: 8, example: "newSecurePassword456" },
          },
        },
        ResetPasswordRequest: {
          type: "object",
          required: ["token", "newPassword"],
          properties: {
            token: { type: "string", example: "reset-token-uuid" },
            newPassword: { type: "string", format: "password", minLength: 8, example: "newSecurePassword456" },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
            user: { $ref: "#/components/schemas/User" },
            oneBigPieUser: {
              oneOf: [
                { $ref: "#/components/schemas/OneBigPieUser" },
                { type: "null" },
              ],
              description: "Linked OneBigPie user data (null if not found)",
            },
            token: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
            success: { type: "boolean", example: false },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        OneCardLoginResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "OneCard login successful" },
            data: {
              type: "object",
              properties: {
                userId: { type: "string" },
                expiresAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        OneCardBalanceResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  RESPONSE: { type: "boolean" },
                  RESPONSE_TOTAL: { type: "string", example: "0.00" },
                  LOCK_FUND: { type: "string", example: "0.00" },
                  RESPONSE_MSG: { type: "string" },
                  STOCK_BAL: { type: "string", example: "0.00" },
                  TOTAL_SALES: { type: "string", example: "0.00" },
                  TOTAL_PROFIT: { type: "string", example: "0.00" },
                },
              },
            },
          },
        },
        OneCardServicesResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      Service: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "1" },
                          title: { type: "string", example: "Mobile" },
                          icon: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        OneCardProductsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "object",
                  properties: {
                    Operator: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "2" },
                          service_id: { type: "string", example: "1" },
                          title: { type: "string", example: "MTN" },
                          type: { type: "string", example: "Prepaid" },
                          logo: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        OneCardProductItemsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "object",
                  properties: {
                    Operator: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        Denominations: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              denomination: { type: "string" },
                              selling_price: { type: "string" },
                              title: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        OneCardProductParamsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "object",
                  properties: {
                    params: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          keyname: { type: "string" },
                          type: { type: "string" },
                          required: { type: "string" },
                          min_len: { type: "string" },
                          max_len: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        OneCardCommissionsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      operator_id: { type: "string" },
                      operator_title: { type: "string" },
                      commission_type: { type: "string" },
                      commission: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
        OneCardRechargeRequest: {
          type: "object",
          required: ["productId", "amount", "mobile"],
          properties: {
            productId: { type: "string", example: "2", description: "Product/Operator ID (e.g., MTN = 2)" },
            amount: { type: "string", example: "100", description: "Recharge amount in Naira" },
            mobile: { type: "string", example: "08012345678", description: "Phone number to recharge" },
            referenceId: { type: "string", description: "Optional unique reference ID" },
          },
        },
        OneCardRechargeResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "object",
                  properties: {
                    transaction_id: { type: "string" },
                    status: { type: "string" },
                  },
                },
              },
            },
          },
        },
        OneCardBillFetchRequest: {
          type: "object",
          required: ["productId", "mobile"],
          properties: {
            productId: { type: "string", example: "10", description: "Product ID (e.g., DSTV = 10)" },
            mobile: { type: "string", example: "1234567890", description: "Meter number or smart card number" },
          },
        },
        OneCardBillFetchResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "object",
                  properties: {
                    customer_name: { type: "string" },
                    outstanding_balance: { type: "string" },
                  },
                },
              },
            },
          },
        },
        OneCardBillPayRequest: {
          type: "object",
          required: ["productId", "amount", "mobile"],
          properties: {
            productId: { type: "string", example: "10", description: "Product ID" },
            amount: { type: "string", example: "5000", description: "Payment amount in Naira" },
            mobile: { type: "string", example: "1234567890", description: "Meter number or smart card number" },
            referenceId: { type: "string", description: "Optional unique reference ID" },
          },
        },
        OneCardBillPayResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "object",
                  properties: {
                    transaction_id: { type: "string" },
                    token: { type: "string", description: "Electricity token or subscription confirmation" },
                  },
                },
              },
            },
          },
        },
        OneCardTransactionsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                RESPONSE: { type: "boolean" },
                RESPONSE_MSG: { type: "string" },
                RESPONSE_DATA: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      amount: { type: "string" },
                      status: { type: "string" },
                      created_at: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        WalletBalanceResponse: {
          type: "object",
          properties: {
            balance: { type: "string", example: "5000.00" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        FundWalletRequest: {
          type: "object",
          required: ["amount"],
          properties: {
            amount: { type: "number", minimum: 100, example: 1000, description: "Amount in Naira (minimum 100)" },
            callbackUrl: { type: "string", format: "uri", description: "URL to redirect after payment" },
          },
        },
        FundWalletResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Payment initialized" },
            reference: { type: "string", example: "WF-abc123" },
            authorizationUrl: { type: "string", format: "uri", description: "Paystack checkout URL - redirect user here to pay" },
            accessCode: { type: "string", description: "Paystack access code for inline payment" },
          },
        },
        VerifyPaymentResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
            status: { type: "string", enum: ["success", "failed", "pending", "abandoned"] },
            amountCredited: { type: "string", example: "1000.00" },
            balance: { type: "string", example: "6000.00" },
            gatewayResponse: { type: "string" },
          },
        },
        DeductWalletRequest: {
          type: "object",
          required: ["amount", "description"],
          properties: {
            amount: { type: "number", minimum: 1, example: 500, description: "Amount to deduct in Naira" },
            description: { type: "string", example: "MTN Airtime purchase" },
            reference: { type: "string", description: "Optional custom reference" },
          },
        },
        DeductWalletResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Deduction successful" },
            reference: { type: "string" },
            amountDeducted: { type: "string", example: "500.00" },
            balance: { type: "string", example: "5500.00" },
          },
        },
        WalletTransaction: {
          type: "object",
          properties: {
            id: { type: "integer" },
            walletId: { type: "integer" },
            userId: { type: "string" },
            type: { type: "string", enum: ["credit", "debit"] },
            amount: { type: "string", example: "1000.00" },
            reference: { type: "string" },
            status: { type: "string", enum: ["pending", "success", "failed"] },
            description: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        WalletTransactionsResponse: {
          type: "object",
          properties: {
            transactions: {
              type: "array",
              items: { $ref: "#/components/schemas/WalletTransaction" },
            },
          },
        },
        PaystackCustomerData: {
          type: "object",
          properties: {
            id: { type: "integer", example: 123456789 },
            first_name: { type: "string", nullable: true, example: "John" },
            last_name: { type: "string", nullable: true, example: "Doe" },
            email: { type: "string", format: "email", example: "john.doe@example.com" },
            customer_code: { type: "string", example: "CUS_xxxxxxxxxx" },
            phone: { type: "string", nullable: true, example: "+2348012345678" },
            metadata: { type: "object", nullable: true, additionalProperties: true },
            risk_action: { type: "string", example: "default" },
            international_format_phone: { type: "string", nullable: true, example: "+2348012345678" },
            identified: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        FetchPaystackCustomerResponse: {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            message: { type: "string", example: "Customer retrieved" },
            data: { $ref: "#/components/schemas/PaystackCustomerData" },
          },
        },
        PaystackTransactionItem: {
          type: "object",
          properties: {
            id: { type: "integer", example: 391238123 },
            status: { type: "string", example: "success" },
            reference: { type: "string", example: "WF-abc123" },
            amount: { type: "integer", example: 250000 },
            currency: { type: "string", example: "NGN" },
            channel: { type: "string", example: "bank_transfer" },
            paid_at: { type: "string", format: "date-time", nullable: true },
            created_at: { type: "string", format: "date-time" },
            gateway_response: { type: "string", example: "Successful" },
          },
        },
        FetchCustomerTransactionsResponse: {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            message: { type: "string", example: "Transactions retrieved" },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/PaystackTransactionItem" },
            },
            meta: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
          },
        },
        OneBigPieCreateUserRequest: {
          type: "object",
          required: ["email", "firstname", "lastname", "phone", "password"],
          properties: {
            email: { type: "string", format: "email", example: "john@example.com" },
            firstname: { type: "string", example: "John" },
            lastname: { type: "string", example: "Doe" },
            phone: { type: "string", example: "08012345678" },
            password: { type: "string", example: "123@@abc" },
          },
        },
        OneBigPieUser: {
          type: "object",
          properties: {
            id: { type: "integer", example: 8452 },
            firstname: { type: "string", example: "John" },
            lastname: { type: "string", example: "Doe" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            usercode: { type: "string", example: "RROBP9503284" },
            created_at: { type: "string", format: "date-time" },
            role: { type: "integer" },
            accounttype: { type: "string" },
            refereecode: { type: "string" },
          },
        },
        OneBigPieUserResponse: {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            message: { type: "string", example: "User created successfully" },
            data: { $ref: "#/components/schemas/OneBigPieUser" },
          },
        },
        OneBigPieUsersListResponse: {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            message: { type: "string", example: "Users fetched successfully" },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/OneBigPieUser" },
            },
          },
        },
        OneBigPieSubscribeRequest: {
          type: "object",
          required: ["email", "voucher"],
          properties: {
            email: { type: "string", format: "email", example: "john@example.com" },
            voucher: { type: "string", example: "1387103511120401" },
          },
        },
        OneBigPieSubscriptionBalance: {
          type: "object",
          properties: {
            userid: { type: "integer" },
            amount: { type: "string", example: "20000.00" },
            bankdump: { type: "string" },
            date: { type: "string", format: "date" },
            method: { type: "string", example: "voucher" },
            type: { type: "string", example: "smart" },
            expirydate: { type: "string", format: "date" },
            state_id: { type: "string", nullable: true },
            voucher_info: { type: "string" },
            refereecode: { type: "string" },
            id: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        OneBigPieSubscribeResponse: {
          type: "object",
          properties: {
            success: { type: "string", example: "success" },
            balance: { $ref: "#/components/schemas/OneBigPieSubscriptionBalance" },
          },
        },
        OneBigPieSubscribedUser: {
          type: "object",
          properties: {
            userid: { type: "integer" },
            amount: { type: "string", example: "20000.00" },
            date: { type: "string", format: "date" },
            expirydate: { type: "string", format: "date" },
            user: {
              type: "object",
              properties: {
                id: { type: "integer" },
                firstname: { type: "string" },
                lastname: { type: "string" },
                email: { type: "string", format: "email" },
                phone: { type: "string" },
                usercode: { type: "string" },
              },
            },
          },
        },
        OneBigPieSubscribedUsersResponse: {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            message: { type: "string", example: "Subscribed Users fetched successfully" },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/OneBigPieSubscribedUser" },
            },
          },
        },
        OneBigPieGenerateVouchersRequest: {
          type: "object",
          required: ["quantity"],
          properties: {
            quantity: { type: "integer", minimum: 1, example: 10 },
          },
        },
        OneBigPieVoucherBulkPurchase: {
          type: "object",
          properties: {
            type_id: { type: "string", nullable: true },
            type: { type: "string", example: "Smart Subscription" },
            amount: { type: "number", example: 196500 },
            quantity: { type: "string" },
            user_id: { type: "integer" },
            requested_date: { type: "string", format: "date-time" },
            payment_method: { type: "string", example: "safe" },
            uploaded_file_name: { type: "string", nullable: true },
            serial: { type: "string", example: "ONEBIGPIE46109678" },
            status: { type: "string", example: "Approved" },
            generated_date: { type: "string", format: "date-time" },
            generated_by: { type: "integer" },
            id: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        OneBigPieGenerateVouchersResponse: {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            message: { type: "string", example: "Bulk Voucher purchase request successful" },
            data: { $ref: "#/components/schemas/OneBigPieVoucherBulkPurchase" },
          },
        },
        OneBigPieVoucher: {
          type: "object",
          properties: {
            id: { type: "integer" },
            code: { type: "string", example: "1687412096955954" },
            stringed: { type: "string", example: "1687-4120-9695-5954" },
            amount: { type: "string", example: "20000.00" },
            used: { type: "string", example: "no" },
            used_date: { type: "string", format: "date-time", nullable: true },
            used_by: { type: "string", nullable: true },
            deactivated: { type: "string", example: "NO" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        OneBigPieVouchersListResponse: {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            message: { type: "string", example: "Vouchers fetched successfully" },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/OneBigPieVoucher" },
            },
          },
        },
        CreateQuoteRequest: {
          type: "object",
          required: ["quoteType", "fullName", "phone", "email"],
          properties: {
            quoteType: { type: "string", example: "standard_ride", description: "Type of quote requested" },
            fullName: { type: "string", example: "John Doe", minLength: 2 },
            phone: { type: "string", example: "08012345678", minLength: 10 },
            email: { type: "string", format: "email", example: "john@example.com" },
            notes: { type: "string", example: "Extra luggage needed", nullable: true },
            requestData: { type: "object", description: "Dynamic fields for the quote form", additionalProperties: true, nullable: true },
          },
        },
        UpdateQuoteRequest: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "accepted", "rejected", "completed"], example: "accepted" },
            notes: { type: "string", example: "Driver confirmed" },
            requestData: { type: "object", description: "Updated dynamic fields", additionalProperties: true },
          },
        },
        QuoteResponse: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
            quoteType: { type: "string", example: "standard_ride" },
            fullName: { type: "string", example: "John Doe" },
            phone: { type: "string", example: "08012345678" },
            email: { type: "string", format: "email", example: "john@example.com" },
            notes: { type: "string", nullable: true },
            status: { type: "string", example: "pending" },
            requestData: { type: "object", additionalProperties: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateSocialLinkRequest: {
          type: "object",
          required: ["name", "socialOrigin", "whatsappNumber", "socialName"],
          properties: {
            name: { type: "string", example: "Facebook Community" },
            socialOrigin: { type: "string", example: "facebook" },
            whatsappNumber: { type: "string", example: "+2348012345678" },
            socialName: { type: "string", example: "@my_community" },
          },
        },
        UpdateSocialLinkRequest: {
          type: "object",
          properties: {
            name: { type: "string", example: "Updated Community Name" },
            socialOrigin: { type: "string", example: "instagram" },
            whatsappNumber: { type: "string", example: "+2348098765432" },
            socialName: { type: "string", example: "@updated_handle" },
            status: { type: "string", enum: ["active", "inactive"], example: "active" },
          },
        },
        SocialLinkResponse: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            userId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
            name: { type: "string", example: "Facebook Community" },
            socialOrigin: { type: "string", example: "facebook" },
            whatsappNumber: { type: "string", example: "+2348012345678" },
            socialName: { type: "string", example: "@my_community" },
            socialCode: { type: "string", example: "FAC-1234567890-ABC123DEF" },
            status: { type: "string", enum: ["active", "inactive"], example: "active" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication endpoints",
      },
      {
        name: "OneCard",
        description: "OneCard Nigeria payment services - Mobile top-ups, Data bundles, Electricity bills, Cable TV subscriptions, and E-vouchers",
      },
      {
        name: "OneBigPie",
        description: "OneBigPie user management and voucher subscription services",
      },
      {
        name: "Wallet",
        description: "Wallet management with Paystack payment integration - fund wallet, check balance, deduct, and view transactions",
      },
      {
        name: "Ridera",
        description: "Ridera ride-sharing quote request and management",
      },
      {
        name: "Social Links",
        description: "Social link management for social media referral codes and WhatsApp integration",
      },
    ],
  },
  apis: ["./server/routes.ts", "./server/onecard/routes.ts", "./server/onebigpie/routes.ts", "./server/paystack/routes.ts", "./server/ridera/routes.ts"],

}
export const swaggerSpec = swaggerJsdoc(options);
