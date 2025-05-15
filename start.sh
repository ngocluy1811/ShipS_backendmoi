#!/bin/bash

# Start Python service in the background
python3 calc_distance_api.py &
PYTHON_PID=$!

# Start Node.js service
npm start &
NODE_PID=$!

# Function to handle shutdown
function shutdown {
    echo "Shutting down services..."
    kill $PYTHON_PID
    kill $NODE_PID
    exit 0
}

# Trap SIGTERM and SIGINT
trap shutdown SIGTERM SIGINT

# Wait for either process to exit
wait $PYTHON_PID $NODE_PID 