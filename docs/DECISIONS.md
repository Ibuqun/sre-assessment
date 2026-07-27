# SRE Assessment Decisions

## Collector Topology

The OpenTelemetry Collector uses an agent and gateway topology.

The agent runs as a DaemonSet.

The gateway runs as a Deployment.

Applications send telemetry to the node-local agent on `$(HOST_IP):4317`.

The agent adds Kubernetes metadata and forwards data to the gateway.

The gateway exports to Elastic and runs tail sampling.

The agent ClusterRole grants read access to Kubernetes `nodes`.

The `resourcedetection` processor needs node metadata such as `k8s.node.uid`.

The Helm chart preset grants pods, namespaces, and replicasets only.

Without the extra rule, the agent exits with `nodes is forbidden`.

## Elastic APM Authentication

Elastic Cloud APM uses the managed HTTPS endpoint on port 443.

The Kubernetes Secret stores the Elastic API key from Kibana.

The gateway uses `Authorization: ApiKey ${env:ELASTIC_APM_API_KEY}`.

## Tail Sampling

Tail sampling runs at the gateway because sampling needs the complete trace.

The policy always keeps error traces, slow traces, and checkout/payment traces.

It samples normal successful traffic at 10%.

This lowers storage and ingest cost.

## Current Scope

The collector pipeline was smoke-tested with a synthetic `test-service` span.

Live Online Boutique tracing was enabled for `frontend`, `recommendationservice`, and `paymentservice`.

The repo contains instrumentation artifacts for three languages:

- Go frontend checkout spans and checkout metrics.
- Node.js payment authorization spans, card validation spans, and payment metrics.
- C# cart operation spans and a cart item counter.

## Service Naming

Each instrumented deployment sets `OTEL_SERVICE_NAME`.

This prevents fallback service names such as `unknown_service` or `unknown_service_server`.

## RUM and Dashboards

RUM is a frontend bootstrap module.

It initializes Elastic APM RUM with the assessment environment and service version.

Kibana dashboards and alert rules are committed as NDJSON files.

The files can be imported, reviewed, and versioned with the other observability files.

The RUM integration has two parts.

The first part is a static bootstrap script.

The second part is a frontend template patch.

This matches the static asset model of the upstream Go frontend.

The dashboard exports use saved-search panels.

This format imported reliably through the available Kibana API.

The panels cover service errors, RUM Web Vitals, checkout/payment correlation, custom metrics, host health, network events, and NGINX health.

In production, these queries can become Lens gauges, percentile charts, maps, and controls.

## Kubernetes Patching

The service overlay files are strategic-merge patches.

Kubernetes can merge container entries by name.

This keeps the patches small.

It also avoids copying unrelated deployment fields from upstream manifests.

## Infrastructure Monitoring

Elastic Agent policy files are used for host and infrastructure monitoring.

The same policy can enroll the bastion, CI runner, or cluster nodes.

Credentials are not committed.

The policy includes system metrics, system logs, Kubernetes logs, audit logs, and flow-log inputs.

PostgreSQL, Redis, and NGINX have separate integration files.

This makes each integration easier to review and tune.

The files include metrics and logs for troubleshooting.

Examples are PostgreSQL logs, Redis slowlog data, and NGINX access/error logs.

These files are deployable artifacts, not proof of live database ingestion.

Fleet enrollment, VM access, database credentials, and component log paths must exist before live verification.

The live verification for this run covered APM, RUM intake, dashboard imports, and Kibana rule creation.

Alerting uses more than one signal.

APM rules catch checkout and payment impact.

Host rules catch compute saturation.

Data-store rules catch capacity and performance issues.

Network-policy rules catch unexpected egress.

NGINX rules catch load-balancer and upstream availability symptoms.

The rule exports omit connector secrets.
