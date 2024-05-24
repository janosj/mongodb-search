let stgVectorSearch=
{ 
  $vectorSearch: { 
        "index": "vector_index",
        "path" : "plot_embedding",
        "queryVector": QUERY_VECTOR,
        "numCandidates": 150,
        "limit": 10
     }
}
console.log("Set stgVectorSearch");

let stgVectorSearchFilter=
{
  $vectorSearch: { 
        "index": "vector_index",
        "path" : "plot_embedding",
        "queryVector": QUERY_VECTOR,
        "numCandidates": 150,
        "limit": 10,
        "filter": { genres: "Action" } 
     }
}
console.log("Set stgVectorSearchFilter");

let stgProject=
{
  $project: { "title": 1 , "plot": 1, "genres": 1, "score": { $meta: "vectorSearchScore" } }
}
console.log("Set stgProject");

let stgOut=
{
  $out: "queryResults"
}

//let pipeline = [ stgVectorSearch, stgProject, stgOut ]
//let pipeline = [ stgVectorSearch, stgProject ]
let pipeline = [ stgVectorSearchFilter, stgProject ]

console.log("set pipeline = ")
console.log(pipeline)

