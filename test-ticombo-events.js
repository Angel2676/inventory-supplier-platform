require("dotenv").config();

const {
  searchTicomboEvents,
} = require("./src/services/integrations/ticombo/ticomboEvents");

async function run() {
  try {
    const query = process.argv.slice(2).join(" ");

    console.log("Searching Ticombo events...");
    console.log("Query:", query || "(empty)");

    const events = await searchTicomboEvents(query);

    console.log(`Found ${events.length} events`);

    for (const event of events.slice(0, 10)) {
      console.log("----------------------------------------");
      console.log("Name:", event.name);
      console.log("Remote Event ID:", event.remote_event_id);
      console.log("Venue:", event.venue_name);
      console.log("City:", event.city);
      console.log("Country:", event.country);
      console.log("Start:", event.start_date);
      console.log("Ticket Types:");
      for (const type of event.ticket_types) {
        console.log(`- ${type.name} (${type.id})`);
      }
    }
  } catch (error) {
    console.error("Ticombo event search failed");

    if (error.response) {
      console.error("STATUS:", error.response.status);
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

run();
