import java.util.Arrays;
import static com.mongodb.client.model.Filters.eq;
import static com.mongodb.client.model.Aggregates.limit;
import static com.mongodb.client.model.Aggregates.project;
import static com.mongodb.client.model.Projections.excludeId;
import static com.mongodb.client.model.Projections.fields;
import static com.mongodb.client.model.Projections.include;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;

public class BasicSearchClient {
  public static void main( String[] args ) {

	if (args.length == 0) {
		System.out.println("Usage: BasicSearchClient <MongoDB-URI>");
		System.exit(1);
	}
		
	String uri = args[0];

	Document agg = new Document("query", "baseball").append("path","plot");

	try (MongoClient mongoClient = MongoClients.create(uri)) {

	  MongoDatabase database = mongoClient.getDatabase("sample_mflix");
	  MongoCollection<Document> collection = database.getCollection("movies");
					
	  collection.aggregate(Arrays.asList(
	    eq("$search", eq("text", agg)), 
	    limit(5), 
	    project(fields(excludeId(), include("title", "plot"))))
	  ).forEach(doc -> System.out.println(doc.toJson()));	

	}
  }
}
