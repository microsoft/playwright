```sh
# Create resource group
az group create --name group-grid-001 --location westus3

# Create ACR
az acr create --resource-group group-grid-001 --name acrgrid001 --sku Basic
az acr login --name acrgrid001
az acr list --resource-group group-grid-001 --query "[].{acrLoginServer:loginServer}" --output table

# Create AKS
az aks create --resource-group group-grid-001 --name aks-grid-001 --node-count 4 --enable-addons monitoring --generate-ssh-keys
az aks get-credentials --resource-group group-grid-001 --name aks-grid-001

# Grant AKS access to ACR
az aks show --resource-group group-grid-001 --name aks-grid-001 --query "servicePrincipalProfile.clientId" --output tsv
# az aks show --resource-group group-grid-001 --name aks-grid-001 --query "identityProfile.kubeletidentity.clientId" -o tsv
# az acr show --name acrgrid001 --resource-group group-grid-001 --query "id" -o tsv
# az role assignment create --assignee <GUID> --role AcrPull --scope <SCOP PATH>

# Create secrets
kubectl create secret generic access-key-secret --from-literal=access-key=$PLAYWRIGHT_GRID_ACCESS_KEY

# Create TLS
# kubectl create secret tls grid-tls-secret --cert=../../tests/config/testserver/cert.pem --key=../../tests/config/testserver/key.pem
# az network public-ip create --resource-group MC_group-grid-001_aks-grid-001_westus3 --name public-ip-grid-001 --sku Standard --allocation-method static
# az network public-ip show --resource-group MC_group-grid-001_aks-grid-001_westus3 --name public-ip-grid-001 --query ipAddress --output tsv
# # use output below
# helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
# helm install nginx-ingress ingress-nginx/ingress-nginx \
#     --set controller.replicaCount=1 \
#     --set controller.nodeSelector."beta\.kubernetes\.io/os"=linux \
#     --set defaultBackend.nodeSelector."beta\.kubernetes\.io/os"=linux \
#     --set controller.service.loadBalancerIP="20.118.130.255"

# Push Docker container
docker build -t playwright-grid:latest -f Dockerfile .
docker tag playwright-grid acrgrid001.azurecr.io/playwright-grid
docker push acrgrid001.azurecr.io/playwright-grid

# Delete deployment
kubectl delete deployment grid-deployment
kubectl delete deployment worker-deployment
kubectl delete svc grid-service

# Update deployment
kubectl apply -f deployment-grid.yaml
kubectl apply -f deployment-worker.yaml

# Debug
kubectl config
kubectl get pods -l app=grid
kubectl logs grid-6cbbfc866c-wh8dw
kubectl get pods -n ingress-basic
kubectl get svc grid-service
kubectl describe node
az aks show --resource-group group-grid-001 --name aks-grid-001 --query fqdn --output tsv
```
