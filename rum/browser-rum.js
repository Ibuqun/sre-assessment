import { init as initApm } from "@elastic/apm-rum";

export function initRum() {
  return initApm({
    serviceName: "online-boutique-frontend",
    serviceVersion: "1.0.0",
    environment: "assessment",
    serverUrl: window.__ELASTIC_APM_RUM_SERVER_URL__,
    distributedTracingOrigins: [window.location.origin],
    transactionSampleRate: 1.0,
    breakdownMetrics: true,
    captureBody: "errors",
  });
}
