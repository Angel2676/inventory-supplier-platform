const { searchListings } = require("./src/services/integrations/gigsberg/gigsbergApi");

async function main() {
  const result = await searchListings({
    event_id: 249705,
    page: 1,
    per_page: 100,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err.response?.data || err.message);
  process.exit(1);
});
