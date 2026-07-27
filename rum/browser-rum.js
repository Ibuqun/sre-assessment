(function () {
  if (!window.elasticApm || !window.__ELASTIC_APM_RUM_SERVER_URL__) {
    return;
  }

  window.elasticApm.init({
    serviceName: "online-boutique-frontend",
    serviceVersion: "1.0.0",
    environment: "assessment",
    serverUrl: window.__ELASTIC_APM_RUM_SERVER_URL__,
    distributedTracingOrigins: [window.location.origin],
    transactionSampleRate: 1.0,
    breakdownMetrics: true,
    captureBody: "errors"
  });
})();
