# SRE Assessment

This repository contains the observability configuration and assessment artifacts for Google's Online Boutique deployment: OpenTelemetry Collector gateway/agent values, service instrumentation patches, Elastic APM RUM, Kibana dashboards, and infrastructure monitoring via Elastic Agent/Fleet.

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
kubectl patch deploy frontend -n boutique --type strategic --patch-file instrumentation/frontend/otel-env-patch.yaml
kubectl patch deploy paymentservice -n boutique --type strategic --patch-file instrumentation/paymentservice/otel-env-patch.yaml
kubectl patch deploy cartservice -n boutique --type strategic --patch-file instrumentation/cartservice/stability-patch.yaml
```

Apply source-level patches to the upstream Online Boutique checkout/payment services when rebuilding service images:

```bash
git -C microservices-demo apply ../instrumentation/frontend/custom-checkout-span.patch
git -C microservices-demo apply ../instrumentation/paymentservice/custom-charge-span.patch
```

## Kibana

Import saved objects from `dashboards/*.ndjson` and `infrastructure/alerting-rules/*.ndjson`.

After generating fresh traffic, use a short time range such as Last 15 minutes and verify that new traces appear under `frontend` and `paymentservice`. Older `unknown_service` entries can remain visible if the selected time window includes data from before `OTEL_SERVICE_NAME` was added.

## RUM

Wire `rum/browser-rum.js` into the frontend bundle and set `window.__ELASTIC_APM_RUM_SERVER_URL__` to the Elastic APM RUM endpoint.

## What to Demonstrate

During review, walk through these checks:

1. `frontend` and `paymentservice` appear as named APM services after fresh traffic.
2. Checkout traces flow through frontend, cart, checkout, payment, and downstream services.
3. Error and slow traces are retained by the gateway tail-sampling policy.
4. Collector self-metrics are exposed on port `8888`.
5. Infrastructure files show how Kubernetes logs plus Postgres, Redis, and Nginx metrics would be collected by Elastic Agent.

## Key Tradeoffs

The node-local collector agent gives each workload a nearby OTLP endpoint and handles Kubernetes enrichment close to the pod. The gateway centralizes Elastic export and tail sampling because it sees complete traces. Normal successful traffic is sampled to control storage cost, while errors, slow requests, and checkout/payment traces are retained because they carry the most incident value.
