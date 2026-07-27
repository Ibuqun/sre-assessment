# SRE Assessment

This repository contains the observability configuration and assessment artifacts for the Online Boutique deployment.

## Layout

- `otel-collector/`: OpenTelemetry Collector Helm values for the node-local agent and central gateway.
- `instrumentation/`: Per-service Kubernetes overlays and source patches.
- `rum/`: Elastic browser RUM bootstrap code.
- `dashboards/`: Kibana saved object exports.
- `infrastructure/`: Elastic Agent integrations and alerting rule exports.
- `docs/`: Architectural decision log.

## Collector Deployment

Create the Elastic APM API key secret in the collector namespace:

```bash
kubectl create namespace observability
kubectl create secret generic elastic-apm-credentials \
  -n observability \
  --from-literal=api-key="$ELASTIC_APM_API_KEY"
```

Install the gateway and agent with the OpenTelemetry Helm chart:

```bash
helm upgrade --install otel-gateway open-telemetry/opentelemetry-collector \
  -n observability \
  -f otel-collector/values-gateway.yaml

helm upgrade --install otel-agent open-telemetry/opentelemetry-collector \
  -n observability \
  -f otel-collector/values-agent.yaml
```

## Service Instrumentation

Apply the service overlays:

```bash
kubectl patch deploy frontend -n boutique --type merge --patch-file instrumentation/frontend/otel-env-patch.yaml
kubectl patch deploy paymentservice -n boutique --type merge --patch-file instrumentation/paymentservice/otel-env-patch.yaml
kubectl patch deploy cartservice -n boutique --type merge --patch-file instrumentation/cartservice/stability-patch.yaml
```

Apply source-level patches to the upstream Online Boutique checkout/payment services when rebuilding service images:

```bash
git -C microservices-demo apply ../instrumentation/frontend/custom-checkout-span.patch
git -C microservices-demo apply ../instrumentation/paymentservice/custom-charge-span.patch
```

## Kibana

Import saved objects from `dashboards/*.ndjson` and `infrastructure/alerting-rules/*.ndjson`.

## RUM

Wire `rum/browser-rum.js` into the frontend bundle and set `window.__ELASTIC_APM_RUM_SERVER_URL__` to the Elastic APM RUM endpoint.
