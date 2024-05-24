// Run this within mongosh to see output.
// Or, use an $out stage in the pipeline to store the results,
// and then view those results via mongosh, Compass, or Atlas.

use sample_mflix
db.embedded_movies.aggregate(pipeline)
