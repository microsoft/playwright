#!/bin/bash

echo "-- tagging: $1"
docker tag playwright:localbuild $1
docker push $1
