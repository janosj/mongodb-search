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
    console.log('Connected to MongoDB'); 
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/web/index.html'));
})

app.use(express.static('web'));
app.use(express.json());

app.post('/runQuery', async (request, response) => {

    try {

        //const query = { title: 'Back to the Future' }
        //const query = "baseball";

        console.log("Request Body was: " + JSON.stringify(request.body) );

        let queryText = request.body.queryText;
        let pageSize = request.body.pageSize;
        let numberToSkip = request.body.pageNumber * pageSize;
        // Return 1 more than the allowed page size, 
        // so the app knows whether to include a "next page" link.
        let pageLimit = pageSize + 1;

        console.log("Query text is: " + queryText);

        const movies = client.db("sample_mflix").collection("movies");

        /*
        // This approach would leverage standard indexing.
        let searchStage = {
            "$match": { 'title': 'Hamlet' }
        }
        */

        let stageSearch = 
        {
            "$search": {
                "text": {
                    "query": queryText,
                    "path": ["title", "fullplot"],
                    "fuzzy": {
                        "maxEdits": 2
                    }
                },
                "highlight": {
                    "path": ["title", "fullplot"]
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
        console.log( "Running pipeline: ", JSON.stringify(aggPipeline) );

        let result = await movies.aggregate( aggPipeline ).toArray();
        console.log(result);
        response.send(result);
        console.log("Results sent back to front end app.");

        /*
        let result = await movies.findOne(query).then(
            function(mdbResponse) {
                console.log(mdbResponse);
                response.send(mdbResponse);
            }
        );
        */

    } catch (e) {
        console.log("error caught in index.js (/runQuery):", e.message);
        response.status(500).send({ message: e.message });
    };

})

app.listen(port, () => console.log(`App listening on port ${port}! Access from browser at http://localhost:${port}/`))

