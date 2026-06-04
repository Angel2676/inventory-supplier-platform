require("dotenv").config();

const {
  searchTicomboListings,
} = require("./src/services/integrations/ticombo/ticomboListings");

async function main() {
  const result = await searchTicomboListings({
    page: 1,
    limit: 10,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("TICOMBO LISTINGS ERROR:");
  console.error(JSON.stringify(error.response?.data || error.message, null, 2));
});
