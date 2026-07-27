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
kubectl patch deploy cartservice -n boutique --type strategic --patch-file instrumentation/cartservice/otel-env-patch.yaml
kubectl patch deploy cartservice -n boutique --type strategic --patch-file instrumentation/cartservice/stability-patch.yaml
```

Apply source-level patches to the upstream Online Boutique checkout/payment/cart services when rebuilding service images:

```bash
git -C microservices-demo apply ../instrumentation/frontend/custom-checkout-span.patch
git -C microservices-demo apply ../instrumentation/frontend/rum-template.patch
git -C microservices-demo apply ../instrumentation/paymentservice/custom-charge-span.patch
git -C microservices-demo apply ../instrumentation/cartservice/custom-cart-telemetry.patch
cp rum/browser-rum.js microservices-demo/src/frontend/static/rum.js
```

## Kibana

Import saved objects from `dashboards/*.ndjson` and `infrastructure/alerting-rules/*.ndjson`.

After generating fresh traffic, use a short time range such as Last 15 minutes and verify that new traces appear under `frontend` and `paymentservice`. Older `unknown_service` entries can remain visible if the selected time window includes data from before `OTEL_SERVICE_NAME` was added.

The alert export includes APM rules for checkout and payment, plus ES query rules for host CPU/disk/memory, PostgreSQL connection/cache health, Redis memory/evictions, Kubernetes network-policy egress, and NGINX 5xx/upstream failures.

## RUM

Wire `rum/browser-rum.js` into the frontend bundle and set `window.__ELASTIC_APM_RUM_SERVER_URL__` to the Elastic APM RUM endpoint.

For the upstream Go frontend, apply `instrumentation/frontend/rum-template.patch` and copy `rum/browser-rum.js` to `microservices-demo/src/frontend/static/rum.js` before rebuilding the frontend image.

## What to Demonstrate

During review, walk through these checks:

1. `frontend` and `paymentservice` appear as named APM services after fresh traffic.
2. Frontend, paymentservice, and cartservice have language-specific instrumentation patches with business spans and metrics.
3. Checkout traces flow through frontend, cart, checkout, payment, and downstream services.
4. Error and slow traces are retained by the gateway tail-sampling policy.
5. Collector self-metrics are exposed on port `8888`.
6. Infrastructure files show how host metrics, Kubernetes logs/audit/flow logs, Postgres, Redis, and NGINX metrics/logs would be collected by Elastic Agent.
7. Alert rules cover application, host, database, cache, network-policy, and load-balancer failure modes.
8. `docs/EVIDENCE.md` contains the final checklist for screenshots and live verification notes.

## Key Tradeoffs

The node-local collector agent gives each workload a nearby OTLP endpoint and handles Kubernetes enrichment close to the pod. The gateway centralizes Elastic export and tail sampling because it sees complete traces. Normal successful traffic is sampled to control storage cost, while errors, slow requests, and checkout/payment traces are retained because they carry the most incident value.

Elastic Agent configuration is committed as reusable policy YAML rather than embedding credentials. The policy separates system metrics/logs, Kubernetes container logs, audit/flow logs, and component-specific integrations so each signal lands in a predictable dataset.
