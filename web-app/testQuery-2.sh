# For testing search pipelines via command shell.

# Not obvious how to parse json config file from bash,
# so using standard config file vs. node config file in current directory.
# (not ideal)
source ../demo.conf

mongo $MDB_CONNECT_URI --eval '

db = db.getSiblingDB("sample_mflix");

let aggPipeline = [{"$search":{"compound":{"filter":[{"text":{"query":["Action"],"path":"genres"}}],"should":[{"text":{"query":"hamlet","path":["title","fullplot"]}}]}}},{"$addFields":{"highlights":{"$meta":"searchHighlights"}}},{"$skip":0},{"$limit":11}]

let stageOut = {"$out":"testOutput"}

db.movies.aggregate(aggPipeline);


'

echo
echo "Pipeline finished, check database for output."
echo 

