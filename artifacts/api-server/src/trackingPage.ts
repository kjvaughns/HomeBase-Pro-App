// Task #486: Live ETA "On My Way" tracking page. A lightweight, dependency-
// light HTML page (Leaflet + OpenStreetMap tiles — no Google Maps API key
// required) that polls the public /api/track/:token JSON endpoint and
// renders a live map + ETA. No app install or login needed; the token in
// the URL is the capability credential.
export function buildTrackingPageHtml(token: string): string {
  const safeToken = token.replace(/[^a-zA-Z0-9]/g, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Live tracking | HomeBase</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f7f8fa;
    color: #1a1d21;
  }
  #map { position: fixed; inset: 0; z-index: 0; }
  .card {
    position: relative;
    z-index: 1;
    background: #ffffff;
    margin: 16px;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    padding: 16px 20px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .badge {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
    animation: pulse 1.6s infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
    70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  }
  .title { font-size: 17px; font-weight: 600; margin: 0; }
  .subtitle { font-size: 14px; color: #6b7280; margin: 2px 0 0; }
  .eta-row {
    margin-top: 14px;
    display: flex;
    gap: 24px;
  }
  .eta-block .value { font-size: 24px; font-weight: 700; }
  .eta-block .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
  .footer {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 1;
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
    padding: 10px;
  }
  .footer a { color: #6b7280; text-decoration: none; }
  .state-card { text-align: center; padding: 40px 20px; }
  .state-card .emoji { font-size: 40px; margin-bottom: 8px; }
</style>
</head>
<body>
  <div id="map"></div>
  <div id="card" class="card">
    <div class="header">
      <span class="badge" id="badge"></span>
      <div>
        <p class="title" id="title">Loading…</p>
        <p class="subtitle" id="subtitle"></p>
      </div>
    </div>
    <div class="eta-row" id="etaRow" style="display:none;">
      <div class="eta-block">
        <div class="value" id="etaValue">--</div>
        <div class="label">ETA (min)</div>
      </div>
      <div class="eta-block">
        <div class="value" id="distValue">--</div>
        <div class="label">Miles away</div>
      </div>
    </div>
  </div>
  <div class="footer">Powered by <a href="https://homebaseproapp.com" target="_blank" rel="noopener">HomeBase</a></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var TOKEN = ${JSON.stringify(safeToken)};
    var POLL_MS = 8000;
    var map = null;
    var providerMarker = null;
    var destMarker = null;

    function ensureMap(lat, lng) {
      if (map) return;
      map = L.map('map', { zoomControl: true }).setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
    }

    var providerIcon = L.divIcon({
      html: '<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    var destIcon = L.divIcon({
      html: '<div style="background:#111827;width:14px;height:14px;border-radius:3px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    function renderEnded(message) {
      document.getElementById('badge').style.background = '#9ca3af';
      document.getElementById('badge').style.animation = 'none';
      document.getElementById('title').textContent = message || 'This tracking link has ended';
      document.getElementById('subtitle').textContent = 'Ask your provider for an updated status.';
      document.getElementById('etaRow').style.display = 'none';
    }

    function render(data) {
      if (!data || !data.active) {
        renderEnded(
          data && data.jobStatus === 'arrived' ? data.providerName + ' has arrived' :
          data && data.jobStatus ? 'Tracking ended (' + String(data.jobStatus).replace(/_/g, ' ') + ')' :
          'This tracking link has ended'
        );
        return;
      }
      document.getElementById('title').textContent = data.providerName + ' is on the way';
      document.getElementById('subtitle').textContent = data.serviceName + (data.destinationAddress ? ' • ' + data.destinationAddress : '');

      if (!data.hasLocation) {
        document.getElementById('subtitle').textContent += ' — waiting for location…';
        return;
      }

      ensureMap(data.providerLat, data.providerLng);

      if (!providerMarker) {
        providerMarker = L.marker([data.providerLat, data.providerLng], { icon: providerIcon }).addTo(map);
      } else {
        providerMarker.setLatLng([data.providerLat, data.providerLng]);
      }

      if (data.destinationLat != null && data.destinationLng != null) {
        if (!destMarker) {
          destMarker = L.marker([data.destinationLat, data.destinationLng], { icon: destIcon }).addTo(map);
        } else {
          destMarker.setLatLng([data.destinationLat, data.destinationLng]);
        }
        map.fitBounds([
          [data.providerLat, data.providerLng],
          [data.destinationLat, data.destinationLng],
        ], { padding: [60, 60] });
      } else {
        map.setView([data.providerLat, data.providerLng]);
      }

      if (data.etaMinutes != null) {
        document.getElementById('etaRow').style.display = 'flex';
        document.getElementById('etaValue').textContent = data.etaMinutes;
        document.getElementById('distValue').textContent = data.distanceMiles;
      }
    }

    var stopped = false;
    function poll() {
      if (stopped) return;
      fetch('/api/track/' + TOKEN)
        .then(function (r) {
          if (r.status === 404) { stopped = true; renderEnded('Tracking link not found'); return null; }
          return r.json();
        })
        .then(function (data) {
          if (!data) return;
          render(data);
          if (!data.active) { stopped = true; return; }
          setTimeout(poll, POLL_MS);
        })
        .catch(function () {
          setTimeout(poll, POLL_MS);
        });
    }
    poll();
  </script>
</body>
</html>`;
}
