echo "Select Atlas environment:"
echo " 1) Atlas Commercial"
echo " 2) Atlas for Government"

read n
case $n in
 1) echo "Launching Node app using Atlas Commercial..."
    ENV_FLAG=uri_atlas
    ;;
 2) echo "Launching Node app using Atlas for Government..."
    ENV_FLAG=uri_a4g
    ;;
 *) echo "Invalid option. Exiting.";;
esac

node index.js $ENV_FLAG

// alt for dev use (automatically restarts when changes are detected):
// nodemon index.js

