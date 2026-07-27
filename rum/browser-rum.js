(function () {
  if (!window.elasticApm || !window.__ELASTIC_APM_RUM_SERVER_URL__) {
    return;
  }

  var apm = window.elasticApm.init({
    serviceName: "online-boutique-frontend",
    serviceVersion: "1.0.0",
    environment: "assessment",
    serverUrl: window.__ELASTIC_APM_RUM_SERVER_URL__,
    distributedTracingOrigins: [window.location.origin],
    transactionSampleRate: 1.0,
    breakdownMetrics: true,
    captureBody: "errors"
  });

  var sessionId = document.cookie.match(/shop_session-id=([^;]+)/);
  var deviceClass = window.matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop";

  apm.setCustomContext({
    page: {
      route: window.location.pathname || "/",
      referrer: document.referrer || ""
    },
    session: {
      id: sessionId ? sessionId[1] : "unknown"
    },
    device: {
      class: deviceClass
    }
  });

  apm.addLabels({
    page_route: window.location.pathname || "/",
    session_id: sessionId ? sessionId[1] : "unknown",
    device_class: deviceClass
  });

  function observeMetric(name, entryType, valueSelector) {
    if (!("PerformanceObserver" in window)) {
      return;
    }
    try {
      var observer = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          var transaction = apm.startTransaction("web-vital." + name, "web-vital", { managed: true });
          if (!transaction) {
            return;
          }
          transaction.addLabels({
            web_vital_name: name,
            web_vital_value: valueSelector(entry),
            page_route: window.location.pathname || "/"
          });
          transaction.end();
        });
      });
      observer.observe({ type: entryType, buffered: true });
    } catch (_) {}
  }

  observeMetric("lcp", "largest-contentful-paint", function (entry) { return entry.startTime; });
  observeMetric("cls", "layout-shift", function (entry) { return entry.hadRecentInput ? 0 : entry.value; });
  observeMetric("fid", "first-input", function (entry) { return entry.processingStart - entry.startTime; });

  window.addEventListener("load", function () {
    var nav = performance.getEntriesByType("navigation")[0];
    if (!nav) {
      return;
    }
    apm.addLabels({
      web_vital_ttfb_ms: nav.responseStart,
      browser_dns_ms: nav.domainLookupEnd - nav.domainLookupStart,
      browser_tcp_ms: nav.connectEnd - nav.connectStart,
      browser_request_ms: nav.responseStart - nav.requestStart,
      browser_response_ms: nav.responseEnd - nav.responseStart,
      browser_dom_ms: nav.domInteractive - nav.responseEnd
    });
  });

  document.addEventListener("click", function (event) {
    var action = event.target && event.target.closest("button,a,input[type='submit']");
    if (!action) {
      return;
    }
    var label = (action.innerText || action.value || action.getAttribute("aria-label") || action.tagName).trim();
    if (!/add|cart|checkout|place order/i.test(label)) {
      return;
    }
    var transaction = apm.startTransaction("ui.click." + label.toLowerCase().replace(/\s+/g, "-"), "user-interaction");
    if (!transaction) {
      return;
    }
    transaction.addLabels({
      click_label: label,
      page_route: window.location.pathname || "/",
      session_id: sessionId ? sessionId[1] : "unknown"
    });
    setTimeout(function () {
      transaction.end();
    }, 0);
  }, true);
})();
