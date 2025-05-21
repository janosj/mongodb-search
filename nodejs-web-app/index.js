const { resolveCaa } = require('dns')
const express = require('express')
const { MONGO_CLIENT_EVENTS } = require('mongodb')
const path = require('path')
const app = express()

// Note: uses 8082 to leave 8080 available for Ops Manager or anything else.
const port = 8082

// Pick up environment variables.
const usage = "Usage: URI=<mdb-uri> OPENAI_KEY=<your-openai-key> node index.js\n"

// Process the MongoDB URI.
uri = process.env.URI
if (uri) {
    // redact passwords.
    var redacted = uri.replace(/:([a-zA-Z0-9_\.!-]+)@/, ":<redacted>@")
    console.log(`Starting app with MONGODB URI = ${redacted}`)
} else {
    console.log("ERROR! No MongoDB URI provided.")
    console.log(usage)
    console.log("")
    process.exit(1)
}

// Process the OpenAI key..
openaiKey = process.env.OPENAI_KEY
if (!openaiKey) {
    console.log("\n***No OpenAI Key provided - Vector Search will not be available.")
    console.log(usage)
}

const MongoClient = require('mongodb').MongoClient
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })
client.connect( (err,client) => {
    if(err) return console.error(err)
    console.log('Connected to MongoDB\n') 
})

const dbName = "sample_mflix"
const dataCollection = "embedded_movies"
const movieCollection = client.db(dbName).collection(dataCollection)
const auditCollection = client.db(dbName).collection("searchHistory")

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/web/index.html'))
})

app.use(express.static('web'))
app.use(express.json())

const axios = require('axios');

// Calls an embedding function with the provided query text
// See here: https://www.mongodb.com/developer/products/atlas/semantic-search-mongodb-atlas-vector-search/
async function getEmbedding(query) {

    // Define the OpenAI API url and key.
    const openai_url = 'https://api.openai.com/v1/embeddings';

    // Call the OpenAI API to get the embeddings.
    // The embedding model has to match the model used to create 
    // the document embeddings for the collection.
    console.log(`Retrieving query embedding from OpenAI ("${query}")...`);
    let response = await axios.post(openai_url, {
        input: query,
        model: "text-embedding-ada-002"
    }, {
        headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
        }
    });

    if(response.status === 200) {
        console.log("... Success! Embedding received.")
        return response.data.data[0].embedding;
    } else {
        console.log(`Failed to get embedding. Status code: ${response.status}`);
        throw new Error(`Failed to get embedding. Status code: ${response.status}`);
    }

}

// Log the search, maybe use it for LLM Memory ...
async function logSearch( query, queryVector ) {

    let auditDoc = {
        timestamp: new Date(),
        username: "test-user",
        query: query,
        queryVector: queryVector
    }

    try {
        let result = await auditCollection.insertOne(auditDoc);
    } catch (err) {
        console.error(`Error logging search history: ${err}`);
    } 

}


app.post('/runVectorQuery', async (request, response) => {

    // Runs a vector search.
    // From this blog:
    // https://www.mongodb.com/developer/products/atlas/semantic-search-mongodb-atlas-vector-search/

    try {

        if (!openaiKey) {

            console.log("No OpenAI key, vector search not available.\n");

        } else {

            //const query = "sports"

            console.log("Processing request: /runVectorQuery");
            console.log("Request Body was: " + JSON.stringify(request.body) );

            let queryText = request.body.queryText;

            // Vectorize the query string. 
            const embedding = await getEmbedding(queryText);
            console.log(embedding);

            await logSearch(queryText, embedding);

            let pageSize = request.body.pageSize
            let numberToSkip = request.body.pageNumber * pageSize
            // Return 1 more than the allowed page size, 
            // so the app knows whether to include a "next page" link.
            let pageLimit = pageSize + 1

            let stageSearch = 
            {
                "$vectorSearch": {
                    "queryVector": embedding,
                    "path": "plot_embedding",
                    "numCandidates": 100,
                    "limit": 15,
                    "index": "vector_index",
                }
            }
            
            // Pagination
            let stageSkip = 
            {
                "$skip": numberToSkip
            }
            let stageLimit = 
            {
                "$limit": pageLimit
            }

            let aggPipeline = [ stageSearch, stageSkip, stageLimit ]

            /* For testing and debugging:
            let stageOut = { "$out": "testOutput" }
            aggPipeline = [ stageSearch, stageOut ]
            */

            console.log( "Running pipeline: ", JSON.stringify(aggPipeline) )

            let result = await movieCollection.aggregate( aggPipeline ).toArray()
            //console.log(result);
            response.send(result);
            console.log("Search results delivered to web client.\n")

        }


    } catch (e) {
        console.log("error caught in index.js (/runVectorQuery):", e.message)
        response.status(500).send({ message: e.message })
    };

});

app.post('/runQuery', async (request, response) => {

    try {

        //const query = "hamlet"
        //const query = "baseball"

        console.log("Processing request: /runQuery")
        console.log("Request Body was: " + JSON.stringify(request.body) )

        let queryText = request.body.queryText
        console.log("Query text is: " + queryText)

        let pageSize = request.body.pageSize
        let numberToSkip = request.body.pageNumber * pageSize
        // Return 1 more than the allowed page size, 
        // so the app knows whether to include a "next page" link.
        let pageLimit = pageSize + 1

        let stageSearch = ""

        let facets = request.body.facets

        if (facets) {

            console.log("Query has facets:")
            console.log(facets)

            // https://www.mongodb.com/docs/atlas/atlas-search/compound/
            stageSearch = 
            {
                "$search": {
                    "compound": {
                        "filter": [{
                            "text": { 
                                "query": facets, 
                                "path": "genres" 
                            }
                          }],
                        "must": [{
                            "text": {
                                "query": queryText,
                                "path": ["title", "fullplot"]
                            }
                        }]
                    },
                    "highlight": {
                        "path": ["title", "fullplot"]
                    }
                }
            }

        } else {

            console.log("Query does not have facets.")

            stageSearch = 
            {
                "$search": {
                    "text": {
                        "query": queryText,
                        "path": ["title", "fullplot"]
                        // There are several search queries used across this app.
                        // Make sure they all use the same features consistently, 
                        // or you'll end up with inconsistent results! sorting, counts, etc.
                        /*
                        ,"fuzzy": {
                            "maxEdits": 2
                        }*/
                    },
                    "highlight": {
                        "path": ["title", "fullplot"]
                    }
                }
            }
    
        }
        
        let stageIncludeHighlights = 
        {
            "$addFields": {
                "highlights": {
                    "$meta": "searchHighlights"
                }
            }
        }

        /*
        // This approach would leverage standard indexing (highlighting not supported).
        stageSearch = {
            "$match": { 'title': 'Hamlet' }
        }
        */
        
        // Pagination
        let stageSkip = 
        {
            "$skip": numberToSkip
        }
        let stageLimit = 
        {
            "$limit": pageLimit
        }

        // A $project stage (not used) would look something like this (test for accuracy)
        let stageProject = 
        {
            "$project": {
                "title": 1,
                "fullplot": 1,
                "poster": 1,
                "highlights": { "$meta": "searchHighlights" },  // <-- Include highlights if needed
                "score": { "$meta": "searchScore" }             // <-- Optional: include the score
            }
        }

        let aggPipeline = [ stageSearch, stageIncludeHighlights, stageSkip, stageLimit ]

        /* For testing and debugging:
        let stageOut = { "$out": "testOutput" }
        aggPipeline = [ stageSearch, stageIncludeHighlights, stageOut ]
        */

        console.log( "Running pipeline: ", JSON.stringify(aggPipeline) )

        let result = await movieCollection.aggregate( aggPipeline ).toArray()
        
        //console.log(result);
        response.send(result);
        console.log("Search results delivered to web client.\n")

    } catch (e) {
        console.log("error caught in index.js (/runQuery):", e.message)
        response.status(500).send({ message: e.message })
    };

});


// Gets the list of movie genres and associated counts for the given query.
app.post('/getFacets', async (request, response) => {

    try {

        console.log("Processing request: /getFacets")
        console.log("Request Body was: " + JSON.stringify(request.body) )

        let queryText = request.body.queryText
        console.log("Query text is: " + queryText)

        /* 
            Facet resources: 
            https://www.mongodb.com/docs/atlas/atlas-search/tutorial/facet-tutorial/
            https://www.mongodb.com/docs/atlas/atlas-search/facet/
        */
        let stageSearchMeta = 
        {
            "$searchMeta": {
                "facet": {
                    "operator": {
                        "text": {
                            "query": queryText,
                            "path": ["title", "fullplot"]
                            // There are several search queries used across this app.
                            // Make sure they all use the same features consistently, 
                            // or you'll end up with inconsistent results! sorting, counts, etc.
                            /*,
                            "fuzzy": {
                                "maxEdits": 2
                            }*/
                        }
                    },
                    "facets": {
                      "genresFacet": {"type": "string", "path": "genres"},
                    }
                }
            }
        }

        let aggPipeline = [ stageSearchMeta ]
        console.log( "Running pipeline: ", JSON.stringify(aggPipeline) )

        let result = await movieCollection.aggregate( aggPipeline ).toArray()
        //console.log(result);
        response.send(result);
        console.log("List of facets with counts delivered to web client.\n")

    } catch (e) {
        console.log("error caught in index.js (/getFacets):", e.message)
        response.status(500).send({ message: e.message })
    }

})

app.listen(port, () => console.log(`App listening on port ${port}! Access from browser at http://localhost:${port}/`))

