const { resolveCaa } = require('dns');
const express = require('express');
const { MONGO_CLIENT_EVENTS } = require('mongodb');
const path = require('path')
const app = express()

// Note: uses 8081 to leave 8080 available for Ops Manager or anything else.
const port = 8081

// Establish MDB connection on startup.
// Specify Atlas connect string in the demo-conf.json file.
const config = require('./demo-conf.json');
const uri = config.uri;

const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect( (err,client) => {
    if(err) return console.error(err);
    console.log('Connected to MongoDB\n'); 
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/web/index.html'));
})

app.use(express.static('web'));
app.use(express.json());

app.post('/runQuery', async (request, response) => {

    try {

        //const query = "hamlet"
        //const query = "baseball";

        console.log("Processing request: /runQuery");
        console.log("Request Body was: " + JSON.stringify(request.body) );

        let queryText = request.body.queryText;
        console.log("Query text is: " + queryText);

        let pageSize = request.body.pageSize;
        let numberToSkip = request.body.pageNumber * pageSize;
        // Return 1 more than the allowed page size, 
        // so the app knows whether to include a "next page" link.
        let pageLimit = pageSize + 1;

        let stageSearch = "";

        let facets = request.body.facets;

        if (facets) {

            console.log("Query has facets:");
            console.log(facets);

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

            console.log("Query does not have facets.");

            stageSearch = 
            {
                "$search": {
                    "text": {
                        "query": queryText,
                        "path": ["title", "fullplot"]
                        /*,"fuzzy": {
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

        let aggPipeline = [ stageSearch, stageIncludeHighlights, stageSkip, stageLimit ];

        /* For testing and debugging:
        let stageOut = { "$out": "testOutput" }
        aggPipeline = [ stageSearch, stageIncludeHighlights, stageOut ];
        */

        console.log( "Running pipeline: ", JSON.stringify(aggPipeline) );

        const movies = client.db("sample_mflix").collection("movies");
        let result = await movies.aggregate( aggPipeline ).toArray();
        //console.log(result);
        response.send(result);
        console.log("Search results delivered to web client.\n");

    } catch (e) {
        console.log("error caught in index.js (/runQuery):", e.message);
        response.status(500).send({ message: e.message });
    };

});


// Gets the list of movie genres and associated counts for the given query.
app.post('/getFacets', async (request, response) => {

    try {

        console.log("Processing request: /getFacets");
        console.log("Request Body was: " + JSON.stringify(request.body) );

        let queryText = request.body.queryText;
        console.log("Query text is: " + queryText);

        const movies = client.db("sample_mflix").collection("movies");

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

        let aggPipeline = [ stageSearchMeta ];
        console.log( "Running pipeline: ", JSON.stringify(aggPipeline) );

        let result = await movies.aggregate( aggPipeline ).toArray();
        //console.log(result);
        response.send(result);
        console.log("List of facets sent back to front-end app.\n");

    } catch (e) {
        console.log("error caught in index.js (/getFacets):", e.message);
        response.status(500).send({ message: e.message });
    };

})

app.listen(port, () => console.log(`App listening on port ${port}! Access from browser at http://localhost:${port}/`))

