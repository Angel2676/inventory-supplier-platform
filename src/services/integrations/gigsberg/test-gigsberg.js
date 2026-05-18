require("dotenv").config();

const {
  authenticateGigsberg
} = require("./src/services/integrations/gigsberg/gigsbergAuth");

async function test() {
  try {
    const auth = await authenticateGigsberg();

    console.log("Gigsberg authentication successful");

    console.log(auth);
  } catch (error) {
    console.error("Authentication failed");
  }
}

test();