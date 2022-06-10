# For testing search pipelines via command shell.

# Not obvious how to parse json config file from bash, 
# so using standard config file vs. node config file in current directory.
# (not ideal)
source ../demo.conf

mongo $MDB_CONNECT_URI --eval '

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

db.movies.aggregate([ altFacets, stageLimit, stageOut ]);


'

echo
echo "Pipeline finished, check database for output."
echo

