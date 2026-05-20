require("dotenv").config();

const {
  getSupplierTicketOptions
} = require("./src/services/integrations/sportevents365/sportevents365Api");

async function test() {
  try {
    const eventId = process.argv[2];

    if (!eventId) {
      console.log("Uso: node test-sportevents365-supplier.js EVENT_ID");
      process.exit(1);
    }

    const result = await getSupplierTicketOptions(eventId);

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Supplier API test failed");

    if (error.response) {
      console.error("STATUS:", error.response.status);
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

test();