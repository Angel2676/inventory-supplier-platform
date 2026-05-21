require("dotenv").config();

const {
  testTicomboConnection,
} = require("./src/services/integrations/ticombo/ticomboApi");

async function run() {
  try {
    const path = process.argv[2] || "/api";

    console.log("Testing Ticombo API...");
    console.log("Base URL:", process.env.TICOMBO_BASE_URL);
    console.log("Token present:", Boolean(process.env.TICOMBO_API_TOKEN));
    console.log("Path:", path);

    const result = await testTicomboConnection(path);

    console.log("SUCCESS");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Ticombo connection failed");

    if (error.response) {
      console.error("STATUS:", error.response.status);
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

run();
