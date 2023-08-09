```sh
minikube config set memory 65536
minikube config set cpus 12
minikube start
minikube dashboard

# Point docker to minikube
minikube -p minikube docker-env
eval $(minikube docker-env)
kubectl config use-context minikube
kubectl create secret generic access-key-secret --from-literal=access-key=$PLAYWRIGHT_GRID_ACCESS_KEY

# Push Docker container
docker build -t playwright-grid:latest -f Dockerfile .

# Delete deployment
kubectl delete deployment grid-deployment
kubectl delete deployment worker-deployment
kubectl delete svc grid-service

# Update deployment

kubectl apply -f deployment-grid.yaml
kubectl apply -f deployment-worker.yaml

# Debug
minikube ip
kubectl get svc grid-service
kubectl get pods -l app=grid
kubectl logs grid-6cbbfc866c-wh8dw
```