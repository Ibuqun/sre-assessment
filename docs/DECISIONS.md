# SRE Assessment Decisions

## Collector Topology

The OpenTelemetry Collector is deployed as an agent DaemonSet plus a gateway Deployment. Application telemetry is sent to the node-local agent on `$(HOST_IP):4317`, where host metrics and Kubernetes resource enrichment are cheap and close to the workload. The agent forwards to the central gateway, which owns Elastic export and tail-based sampling.

The agent ClusterRole explicitly grants read access to Kubernetes `nodes` because the `resourcedetection` processor's Kubernetes API detector needs node metadata such as `k8s.node.uid`. The Helm chart's `kubernetesAttributes` preset only grants pods, namespaces, and replicasets, so without this rule the agent exits during startup with `nodes is forbidden`.

## Elastic APM Authentication

Elastic Cloud APM is reached through the managed HTTPS endpoint on port 443. The Kubernetes Secret stores an APM secret token, so the gateway uses `Authorization: Bearer ${env:ELASTIC_APM_SECRET_TOKEN}`. Using the same value with an `ApiKey` header produced HTTP 401 responses from `/v1/metrics`.

## Tail Sampling

Tail sampling is configured at the gateway because sampling decisions need the complete trace. Error traces, slow traces, and checkout/payment traces are always retained; normal successful traffic is sampled at 10% to control Elasticsearch storage and ingestion cost.

## Current Scope

The collector pipeline has been smoke-tested with a synthetic `test-service` span and live Online Boutique services have tracing enabled for `frontend`, `recommendationservice`, and `paymentservice`. Source-level custom spans and custom metrics are the next implementation step.
