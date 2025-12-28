# HFT Engine Kubernetes Deployment Guide

## Prerequisites

```bash
# Required tools
- kubectl (1.25+)
- helm (3.10+)
- A Kubernetes cluster (EKS, GKE, AKS, or self-hosted)

# Install NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Install Cert-Manager for TLS
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# Install Prometheus Operator (for monitoring)
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

## Quick Start

### 1. Update Values

Edit `helm/hft-engine/values.yaml`:

```yaml
# Change these in production:
secrets:
  postgresPassword: "your-secure-password"
  secretKey: "your-secret-key"
  dhanClientId: "your-dhan-client-id"
  dhanAccessToken: "your-dhan-access-token"

ingress:
  host: api.your-domain.com
```

### 2. Deploy with Helm

```bash
# Install the chart
helm install hft-engine ./helm/hft-engine \
  --namespace hft-engine \
  --create-namespace \
  --values ./helm/hft-engine/values.yaml

# Or upgrade existing deployment
helm upgrade hft-engine ./helm/hft-engine \
  --namespace hft-engine \
  --values ./helm/hft-engine/values.yaml
```

### 3. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n hft-engine

# Check services
kubectl get svc -n hft-engine

# Check ingress
kubectl get ingress -n hft-engine

# View logs
kubectl logs -f deployment/api-gateway -n hft-engine
```

## Manual Kubernetes Deployment (without Helm)

```bash
# Apply manifests in order
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/api-gateway.yaml
kubectl apply -f k8s/base/backend-services.yaml
kubectl apply -f k8s/base/ingress.yaml

# For Kafka (using Strimzi operator)
kubectl apply -f k8s/kafka/

# For Redis (using Redis operator)
kubectl apply -f k8s/redis/

# For TimescaleDB
kubectl apply -f k8s/database/
```

## Scaling

### Manual Scaling

```bash
# Scale API Gateway to 5 replicas
kubectl scale deployment api-gateway --replicas=5 -n hft-engine

# Scale Historical Service to 8 replicas
kubectl scale deployment historical-service --replicas=8 -n hft-engine
```

### Auto-Scaling (HPA already configured)

HPA will automatically scale based on CPU/Memory:
- API Gateway: 3-10 pods (70% CPU, 80% Memory)
- Historical Service: 4-12 pods (70% CPU)

To modify HPA:

```bash
# Edit HPA
kubectl edit hpa api-gateway-hpa -n hft-engine
```

## Monitoring

```bash
# Forward Grafana port
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Forward Prometheus port
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090

# View HPA status
kubectl get hpa -n hft-engine --watch
```

## Troubleshooting

### Pods not starting

```bash
# Describe pod
kubectl describe pod <pod-name> -n hft-engine

# Check events
kubectl get events -n hft-engine --sort-by='.lastTimestamp'
```

### Check resource usage

```bash
# CPU/Memory usage per pod
kubectl top pods -n hft-engine

# Node resource usage
kubectl top nodes
```

### Logs

```bash
# Tail logs from all API Gateway pods
kubectl logs -f -l app=api-gateway -n hft-engine

# Previous pod logs (if crashed)
kubectl logs <pod-name> -n hft-engine --previous
```

## Rollback

```bash
# Helm rollback
helm rollback hft-engine -n hft-engine

# Or rollback to specific revision
helm rollback hft-engine 5 -n hft-engine

# List revisions
helm history hft-engine -n hft-engine
```

## Uninstall

```bash
# Helm uninstall
helm uninstall hft-engine -n hft-engine

# Delete namespace (WARNING: deletes all data)
kubectl delete namespace hft-engine
```

## Production Recommendations

1. **Use separate node pools**:
   - Compute-intensive: processor, analytics (high CPU nodes)
   - Memory-intensive: historical, redis (high memory nodes)
   - Database: timescaledb (SSD-backed, high I/O)

2. **Enable Pod Security Standards**:
   ```bash
   kubectl label namespace hft-engine pod-security.kubernetes.io/enforce=restricted
   ```

3. **Configure Network Policies** for service isolation

4. **Use External Secrets Operator** instead of plaintext secrets

5. **Set up backup automation** for TimescaleDB

6. **Configure resource quotas** per namespace

7. **Enable cluster autoscaling** (EKS: Cluster Autoscaler, GKE: GKE Autopilot)
