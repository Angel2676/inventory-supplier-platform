require("dotenv").config({
  path: "../../../.env",
});

const { authenticateGigsberg } = require("./gigsbergAuth");

async function test() {
  try {
    const auth = await authenticateGigsberg();

    console.log("Gigsberg authentication successful");

    console.log(auth);
  } catch (error) {
    console.error("Authentication failed");
    console.error(error.response?.data || error.message);
  }
}

test();
