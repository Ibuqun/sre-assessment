# SRE Assessment Decisions

## Collector Topology

The OpenTelemetry Collector is deployed as an agent DaemonSet plus a gateway Deployment. Application telemetry is sent to the node-local agent on `$(HOST_IP):4317`, where host metrics and Kubernetes resource enrichment are cheap and close to the workload. The agent forwards to the central gateway, which owns Elastic export and tail-based sampling.

The agent ClusterRole explicitly grants read access to Kubernetes `nodes` because the `resourcedetection` processor's Kubernetes API detector needs node metadata such as `k8s.node.uid`. The Helm chart's `kubernetesAttributes` preset only grants pods, namespaces, and replicasets, so without this rule the agent exits during startup with `nodes is forbidden`.

## Elastic APM Authentication

Elastic Cloud APM is reached through the managed HTTPS endpoint on port 443. The Kubernetes Secret stores the Elastic API key created from Kibana, so the gateway uses `Authorization: ApiKey ${env:ELASTIC_APM_API_KEY}`. This differs from an APM secret token, which would use a `Bearer` authorization header.

## Tail Sampling

Tail sampling is configured at the gateway because sampling decisions need the complete trace. Error traces, slow traces, and checkout/payment traces are always retained; normal successful traffic is sampled at 10% to control Elasticsearch storage and ingestion cost.

## Current Scope

The collector pipeline has been smoke-tested with a synthetic `test-service` span and live Online Boutique services have tracing enabled for `frontend`, `recommendationservice`, and `paymentservice`. The committed instrumentation artifacts focus on the expected assessment services: frontend checkout spans, payment authorization spans, and cartservice memory stability.

## Repository Boundary

The upstream `microservices-demo/` checkout is kept out of the assessment repository. Source-level instrumentation is stored as patch files under `instrumentation/<service>/` so the changes remain reviewable without vendoring the application source.

## Service Naming

Each instrumented deployment sets `OTEL_SERVICE_NAME` explicitly. This prevents Elastic APM from grouping spans under OpenTelemetry fallback names such as `unknown_service` or `unknown_service_server`.

## RUM and Dashboards

RUM is represented as a frontend bootstrap module that initializes Elastic APM RUM with the assessment environment and service version. Kibana dashboards and alerting rules are committed as saved-object NDJSON artifacts so they can be imported, reviewed, and versioned with the rest of the observability configuration.
