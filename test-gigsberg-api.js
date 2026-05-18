require("dotenv").config();

const {
  getCurrentUser,
  searchEvents,
  getEventCategories
} = require("./src/services/integrations/gigsberg/gigsbergApi");

async function runTests() {
  try {
    console.log("\n==============================");
    console.log("GIGSBERG API TEST");
    console.log("==============================\n");

    /**
     * TEST 1
     * CURRENT USER
     */

    console.log("TEST 1 → Get current user\n");

    const currentUser = await getCurrentUser();

    console.log("Current user:");
    console.dir(currentUser, { depth: null });

    /**
     * TEST 2
     * SEARCH EVENTS
     */

    console.log("\n==============================");
    console.log("TEST 2 → Search events");
    console.log("==============================\n");

    const searchResult = await searchEvents({
      keyword: "Inter Milan",
      future_events_only: true,
      per_page: 5
    });

    console.log("Search result:");
    console.dir(searchResult, { depth: null });

    /**
     * TEST 3
     * EVENT CATEGORIES
     */

    const firstEvent =
      searchResult?.data &&
      Array.isArray(searchResult.data) &&
      searchResult.data.length > 0
        ? searchResult.data[0]
        : null;

    if (firstEvent?.id) {
      console.log("\n==============================");
      console.log("TEST 3 → Event categories");
      console.log("==============================\n");

      console.log(
        `Loading categories for event ID ${firstEvent.id}...\n`
      );

      const categories = await getEventCategories(firstEvent.id);

      console.log("Categories:");
      console.dir(categories, { depth: null });
    } else {
      console.log(
        "\nNessun evento trovato → impossibile testare getEventCategories"
      );
    }

    console.log("\n==============================");
    console.log("ALL TEST COMPLETED");
    console.log("==============================\n");
  } catch (error) {
    console.error("\nTEST FAILED\n");

    console.error(
      error.response?.data || error.message || error
    );
  }
}

runTests();