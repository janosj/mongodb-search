// For testing search pipelines via mongosh.


db = db.getSiblingDB("sample_mflix");

let stageSearch = 
{
 "$search":{
   "text":{
     "query":"hamlet",
     "path":["title","fullplot"],
     "fuzzy":{"maxEdits":2}
   },
   "highlight":{
     "path":["title","fullplot"]}
  }
}

let altFacets = 
{
 "$search":{
   "facet": {
      "operator": {
         "text":{
            "query":"hamlet",
            "path":["title","fullplot"],
            "fuzzy":{"maxEdits":2}
         }
       },
       "facets": {
           genresFacet: {type: "string", path: "genres"},
       }
   }
 }
}

let stageIncludeHighlights = 
{
 "$addFields":{
   "highlights":
     {"$meta":"searchHighlights"}
  }
}

let stageSkip = {"$skip":0}

let stageLimit = {"$limit":2}

let stageOut = {"$out":"testOutput"}

db.embedded_movies.aggregate([ altFacets, stageLimit, stageOut ]);

console.log("output written to testOutput collection.");

