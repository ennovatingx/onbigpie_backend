import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Authentication & OneCard API",
      version: "1.0.0",
      description: "REST API for user authentication and OneCard Nigeria payment services including mobile top-ups, data bundles, electricity bills, and cable TV subscriptions",
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
        RegisterRequest: {
          type: "object",
          required: ["firstName", "lastName", "universityName", "phoneNumber", "email", "password"],
          properties: {
            firstName: { type: "string", example: "John" },
            lastName: { type: "string", example: "Doe" },
            universityName: { type: "string", example: "Harvard University" },
            matriculationNumber: { type: "string", example: "MAT123456", nullable: true },
            phoneNumber: { type: "string", example: "+1234567890" },
            email: { type: "string", format: "email", example: "john.doe@example.com" },
            password: { type: "string", format: "password", minLength: 8, example: "securePassword123" },
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
    ],
  },
  apis: ["./server/routes.ts", "./server/onecard/routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
