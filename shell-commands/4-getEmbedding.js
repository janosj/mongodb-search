// Converts QUERY_STRING into a vector embedding.
// QUERY_STRING and OPENAI_KEY must be set in advance.
// Vector embedding will be saved as QUERY_VECTOR variable.

const openai_url = 'https://api.openai.com/v1/embeddings';
const axios = require('axios');

async function getEmbedding(query) {

  let response = await axios.post(openai_url, {
      input: QUERY_STRING,
      model: "text-embedding-ada-002"
  }, {
      headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
      }
  });

  // Set a global variable with the query vector.
  QUERY_VECTOR = response.data.data[0].embedding;

  console.log("Query vector now accessible through QUERY_VECTOR variable.");

}

getEmbedding(QUERY_STRING);

