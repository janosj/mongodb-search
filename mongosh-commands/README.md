A collection of scripts to run vector queries within the MongoDB Shell. 

As provided, these scripts query the `sample_mflix.embedded_movies` collection, included with the Atlas sample datasets. Run the scripts in order to define a query string, vectorize the query string using a remote embedding service, and run an aggregation pipeline containing a `$vectorSearch` stage. 

Within the MongoDB shell, scripts can be executed using the following command:

```
load('./<script-name.js>')
```


## Prerequisites

1. An Atlas cluster, with the sample datasets loaded and a Vector Index created. The vector index should be named `vector_index`, and it should be created on the `sample_mflix.embedded_movied` using the following index definition:

```
{
  "fields": [
    {
      "numDimensions": 1536,
      "path": "plot_embedding",
      "similarity": "cosine",
      "type": "vector"
    },
    {
      "path": "genres",
      "type": "filter"
    }
  ]
}
```

2. The mongo shell. See the [MongoDB Download Center](https://www.mongodb.com/try/download/shell). 

3. Node.js and npm installed. The MongoDB shell includes a complete JavaScript execution environment. JavaScript is used in one of the scripts to call a remote embedding service to vectorize a search query.

