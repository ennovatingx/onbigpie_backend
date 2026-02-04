import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Authentication API",
      version: "1.0.0",
      description: "REST API for user authentication with registration, login, and password management",
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
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication endpoints",
      },
    ],
  },
  apis: ["./server/routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
