# SRE Assessment

This repository contains the observability files for Google Online Boutique.

It includes these artifacts:

- OpenTelemetry Collector values for the agent and gateway.
- Source patches for service instrumentation.
- Elastic APM RUM bootstrap code.
- Kibana dashboard exports.
- Elastic Agent files for infrastructure monitoring.
- Kibana alert rule exports.

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

Apply the source patches before you rebuild the service images:

```bash
git -C microservices-demo apply ../instrumentation/frontend/custom-checkout-span.patch
git -C microservices-demo apply ../instrumentation/frontend/rum-template.patch
git -C microservices-demo apply ../instrumentation/paymentservice/custom-charge-span.patch
git -C microservices-demo apply ../instrumentation/cartservice/custom-cart-telemetry.patch
cp rum/browser-rum.js microservices-demo/src/frontend/static/rum.js
```

## Kibana

Import saved objects from `dashboards/*.ndjson` and `infrastructure/alerting-rules/*.ndjson`.

After you generate traffic, set the time range to Last 15 minutes.

Make sure that new traces appear under `frontend` and `paymentservice`.

Older `unknown_service` entries can remain visible in older time ranges.

Those entries came from traffic before `OTEL_SERVICE_NAME` was set.

The alert export includes APM rules for checkout and payment.

It also includes ES query rules for these failure modes:

- Host CPU, disk, and memory pressure.
- PostgreSQL connection and cache pressure.
- Redis memory pressure and evictions.
- Kubernetes network-policy egress.
- NGINX 5xx and upstream failures.

## RUM

Add `rum/browser-rum.js` to the frontend bundle.

Set `window.__ELASTIC_APM_RUM_SERVER_URL__` to the Elastic APM RUM endpoint.

For the upstream Go frontend, apply `instrumentation/frontend/rum-template.patch`.

Then copy `rum/browser-rum.js` to `microservices-demo/src/frontend/static/rum.js`.

Then rebuild the frontend image.

## What to Demonstrate

During review, walk through these checks:

1. `frontend` and `paymentservice` appear as named APM services after fresh traffic.
2. The repo has instrumentation patches for Go, Node.js, and C# services.
3. Checkout traces flow through frontend, cart, checkout, payment, and downstream services.
4. Error and slow traces are retained by the gateway tail-sampling policy.
5. Collector self-metrics are exposed on port `8888`.
6. Infrastructure files show how Elastic Agent collects host, Kubernetes, Postgres, Redis, and NGINX data.
7. Alert rules cover application, host, database, cache, network-policy, and load-balancer failure modes.
8. `docs/EVIDENCE.md` contains the final checklist and screenshots.

## Key Tradeoffs

The node-local collector agent gives each workload a nearby OTLP endpoint.

It also adds Kubernetes metadata close to the pod.

The gateway exports to Elastic and runs tail sampling.

Tail sampling runs at the gateway because the gateway sees complete traces.

Normal successful traffic is sampled at 10%.

Errors, slow requests, and checkout/payment traces are always retained.

Elastic Agent configuration is committed as policy YAML.

Credentials stay outside the repo.

The policy separates host data, Kubernetes logs, audit logs, flow logs, and component data.
