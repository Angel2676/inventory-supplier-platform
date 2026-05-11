const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory Supplier API",
      version: "1.0.0",
      description: "API for ticket inventory, reservations and supplier stock management"
    },
    servers: [
      {
        url: "http://127.0.0.1:3000",
        description: "Local server"
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key"
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: ["./src/routes/*.js"]
});

module.exports = swaggerSpec;