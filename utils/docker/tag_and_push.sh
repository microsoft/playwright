#!/bin/bash

echo "-- tagging: $2"
docker tag $1 $2
docker push $2
