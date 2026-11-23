/* Santi PS4 Hub · Selector Multiexploit Offline (Etapa 5 - Integración Local)
 *
 * Reglas de seguridad del selector:
 * 1. NO importa ni ejecuta ningún motor de explotación (jb.js, core.js, afterglow.js).
 * 2. NO tiene temporizador de autostart: requiere acción manual explícita.
 * 3. NO permite iniciar dos navegaciones en paralelo (cerrojo `navigating`).
 * 4. Monitorea pasivamente `window.applicationCache` de `selector.appcache`:
 *    solo declara "caché lista" ante señales reales (`cached`, `noupdate`, o `IDLE`
 *    activo sin error) e informa explícitamente los eventos `error` y `obsolete`.
 * 5. Mantiene confirmación explícita antes de navegar a hosts externos tanto online como offline.
 * 6. Escrito en ES5 puro para compatibilidad total con WebKit de PS4.
 */

(function () {
  "use strict";

  var navigating = false;
  var cacheErrorSeen = false;
  var cacheReadySignal = false;

  var fwBadge = document.getElementById("fw-badge");
  var netBadge = document.getElementById("net-badge");
  var fwNotice = document.getElementById("fw-notice");
  var cacheStatusEl = document.getElementById("selector-cache-status");
  var confirmBox = document.getElementById("confirm-box");
  var confirmTitle = document.getElementById("confirm-title");
  var confirmDetail = document.getElementById("confirm-detail");
  var confirmOfflineAlert = document.getElementById("confirm-offline-alert");
  var confirmGo = document.getElementById("confirm-go");
  var confirmCancel = document.getElementById("confirm-cancel");
  var afterglowBtn = document.getElementById("btn-afterglow");
  var extButtons = document.querySelectorAll(".btn-ext-trigger");

  var KNOWN_AFTERGLOW_FW = {
    "12.00": true, "12.02": true, "12.50": true, "12.52": true,
    "13.00": true, "13.02": true, "13.04": true, "13.50": true,
    "13.52": true, "14.00": true
  };

  var appCache = (function () {
    try {
      return window.applicationCache || null;
    } catch (e) {
      return null;
    }
  })();

  function isOffline() {
    try {
      return navigator.onLine === false;
    } catch (e) {
      return false;
    }
  }

  function setCacheText(text) {
    if (!cacheStatusEl) return;
    cacheStatusEl.textContent = text;
  }

  function handleCacheEvent(ev) {
    if (!cacheStatusEl || !appCache) return;
    var evType = (ev && ev.type) ? String(ev.type) : "";

    if (evType === "checking") {
      cacheErrorSeen = false;
      setCacheText("Caché del selector: comprobando manifiesto selector.appcache...");
      return;
    }
    if (evType === "downloading") {
      cacheErrorSeen = false;
      setCacheText("Caché del selector: descargando archivos del selector...");
      return;
    }
    if (evType === "progress") {
      cacheErrorSeen = false;
      if (ev && ev.lengthComputable && typeof ev.loaded === "number" && typeof ev.total === "number") {
        setCacheText("Caché del selector: descargando recursos (" + ev.loaded + "/" + ev.total + ")...");
      } else {
        setCacheText("Caché del selector: descargando recursos para uso offline...");
      }
      return;
    }
    if (evType === "cached") {
      cacheErrorSeen = false;
      cacheReadySignal = true;
      setCacheText("Caché del selector: instalada y lista para uso offline (señal AppCache: cached)");
      return;
    }
    if (evType === "noupdate") {
      cacheErrorSeen = false;
      cacheReadySignal = true;
      setCacheText("Caché del selector: verificada y lista para uso offline (señal AppCache: noupdate)");
      return;
    }
    if (evType === "updateready") {
      cacheErrorSeen = false;
      cacheReadySignal = true;
      setCacheText("Caché del selector: nueva versión descargada (señal AppCache: updateready · reabrí la página)");
      return;
    }
    if (evType === "obsolete") {
      cacheErrorSeen = true;
      cacheReadySignal = false;
      setCacheText("Error de caché del selector: manifiesto obsoleto o no encontrado (señal AppCache: obsolete)");
      return;
    }
    if (evType === "error") {
      cacheErrorSeen = true;
      if (isOffline() && appCache.status === appCache.IDLE) {
        setCacheText("Caché del selector: modo sin red (verificación online omitida; usando copia local previa si existe)");
      } else {
        cacheReadySignal = false;
        setCacheText("Error de caché del selector: falló la descarga o validación de selector.appcache (señal AppCache: error)");
      }
      return;
    }

    syncInitialCacheStatus();
  }

  function syncInitialCacheStatus() {
    if (!cacheStatusEl) return;
    if (!appCache) {
      setCacheText("Caché del selector: ApplicationCache no disponible en este navegador");
      return;
    }
    if (cacheErrorSeen || cacheReadySignal) {
      return;
    }
    try {
      if (appCache.status === appCache.UNCACHED) {
        setCacheText("Caché del selector: no instalada aún (UNCACHED)");
      } else if (appCache.status === appCache.CHECKING) {
        setCacheText("Caché del selector: comprobando manifiesto selector.appcache...");
      } else if (appCache.status === appCache.DOWNLOADING) {
        setCacheText("Caché del selector: descargando archivos del selector...");
      } else if (appCache.status === appCache.UPDATEREADY) {
        setCacheText("Caché del selector: actualización lista (UPDATEREADY · reabrí la página)");
      } else if (appCache.status === appCache.OBSOLETE) {
        setCacheText("Error de caché del selector: manifiesto obsoleto (OBSOLETE)");
      } else if (appCache.status === appCache.IDLE) {
        if (isOffline()) {
          setCacheText("Caché del selector: activa en modo offline (estado AppCache: IDLE)");
        } else {
          setCacheText("Caché del selector: asociada (esperando señal de verificación AppCache...)");
        }
      }
    } catch (e) {
      setCacheText("Error de caché del selector: no se pudo leer el estado de ApplicationCache");
    }
  }

  if (appCache) {
    var cacheEvents = [
      "checking", "downloading", "progress", "cached",
      "noupdate", "updateready", "error", "obsolete"
    ];
    for (var c = 0; c < cacheEvents.length; c++) {
      try {
        appCache.addEventListener(cacheEvents[c], handleCacheEvent, false);
      } catch (err) {}
    }
  }

  function detectPS4Firmware() {
    try {
      var ua = navigator.userAgent || "";
      var m = ua.match(/PlayStation 4[\/ ]([0-9]+\.[0-9]+)/i);
      if (m && m[1]) {
        return { isPS4: true, fw: m[1] };
      }
    } catch (e) {}
    return { isPS4: false, fw: null };
  }

  function updateEnvironmentStatus() {
    var env = detectPS4Firmware();
    var offline = isOffline();

    if (fwBadge) {
      if (env.isPS4 && env.fw) {
        fwBadge.textContent = "PS4 FW " + env.fw;
      } else {
        fwBadge.textContent = "Navegador / Vista Previa";
      }
    }

    if (netBadge) {
      netBadge.textContent = offline ? "Modo Offline" : "Online";
      netBadge.className = "brand-tag tag-net " + (offline ? "offline" : "online");
    }

    if (fwNotice) {
      if (!env.isPS4) {
        fwNotice.className = "guard-banner warn";
        fwNotice.textContent =
          "Navegador no identificado como PS4. Ningún exploit se ejecutará automáticamente.";
      } else if (env.fw === "14.00") {
        fwNotice.className = "guard-banner ok";
        fwNotice.textContent =
          "PS4 Firmware 14.00 detectado. Afterglow Actual (Opción 1) es el motor principal verificado en caché local.";
      } else if (KNOWN_AFTERGLOW_FW[env.fw]) {
        fwNotice.className = "guard-banner ok";
        fwNotice.textContent =
          "PS4 Firmware " + env.fw + " detectado (compatible con tablas Afterglow 12.00–14.00). Seleccioná manualmente la opción deseada.";
      } else {
        fwNotice.className = "guard-banner warn";
        fwNotice.textContent =
          "PS4 Firmware " + env.fw + " fuera del rango Afterglow local (12.00–14.00). Ejecución automática deshabilitada.";
      }
    }

    for (var i = 0; i < extButtons.length; i++) {
      var btn = extButtons[i];
      var baseName = btn.getAttribute("data-target-name") || "Host Externo";
      if (offline) {
        btn.className = "btn btn-secondary btn-ext-trigger is-offline-cached";
        btn.textContent = "📂 Abrir " + baseName + " (Solo si ya fue cacheado)";
      } else {
        btn.className = "btn btn-secondary btn-ext-trigger";
        btn.textContent = "🌐 Abrir " + baseName + " Externo";
      }
    }

    syncInitialCacheStatus();
  }

  function closeConfirm() {
    if (!confirmBox) return;
    confirmBox.setAttribute("hidden", "hidden");
    if (confirmGo) {
      confirmGo.setAttribute("href", "#");
    }
  }

  function openExternalConfirm(name, url, fwRange) {
    if (navigating) return;
    if (!confirmBox || !confirmTitle || !confirmDetail || !confirmGo) return;

    var offline = isOffline();
    if (offline) {
      confirmTitle.textContent = "Modo Offline · Abrir caché externa de " + name;
      confirmDetail.textContent =
        "Destino: " + url + " (Firmwares declarados: " + fwRange + ").";
      if (confirmOfflineAlert) {
        confirmOfflineAlert.removeAttribute("hidden");
      }
      confirmGo.textContent = "📂 Confirmar y Abrir desde Caché Externa Guardada";
    } else {
      confirmTitle.textContent = "Confirmar apertura externa: " + name;
      confirmDetail.textContent =
        "Destino: " + url + " (Firmwares declarados por el autor externo: " + fwRange + ").";
      if (confirmOfflineAlert) {
        confirmOfflineAlert.setAttribute("hidden", "hidden");
      }
      confirmGo.textContent = "Confirmar y Abrir Host Externo";
    }

    confirmGo.setAttribute("href", url);
    confirmBox.removeAttribute("hidden");
  }

  if (afterglowBtn) {
    afterglowBtn.addEventListener("click", function (ev) {
      if (navigating) {
        ev.preventDefault();
        return;
      }
      navigating = true;
    }, false);
  }

  for (var j = 0; j < extButtons.length; j++) {
    (function (button) {
      button.addEventListener("click", function () {
        var name = button.getAttribute("data-target-name") || "Host Externo";
        var url = button.getAttribute("data-target-url") || "#";
        var fw = button.getAttribute("data-target-fw") || "N/D";
        openExternalConfirm(name, url, fw);
      }, false);
    })(extButtons[j]);
  }

  if (confirmGo) {
    confirmGo.addEventListener("click", function (ev) {
      var href = confirmGo.getAttribute("href");
      if (navigating || !href || href === "#") {
        ev.preventDefault();
        return;
      }
      navigating = true;
    }, false);
  }

  if (confirmCancel) {
    confirmCancel.addEventListener("click", function () {
      closeConfirm();
    }, false);
  }

  window.addEventListener("online", updateEnvironmentStatus, false);
  window.addEventListener("offline", updateEnvironmentStatus, false);

  updateEnvironmentStatus();
})();
