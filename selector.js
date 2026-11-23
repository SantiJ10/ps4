/* Santi PS4 Hub · Selector Multiexploit (Etapa 1 - Prototipo Aislado)
 *
 * Reglas de seguridad del selector:
 * 1. NO importa ni ejecuta ningún motor de explotación (jb.js, core.js, afterglow.js).
 * 2. NO tiene temporizador de autostart: requiere acción manual explícita.
 * 3. NO permite iniciar dos navegaciones en paralelo (cerrojo `navigating`).
 * 4. Advierte cuando la consola está offline antes de abrir hosts externos.
 * 5. Escrito en ES5 puro para compatibilidad total con WebKit de PS4.
 */

(function () {
  "use strict";

  var navigating = false;

  var fwBadge = document.getElementById("fw-badge");
  var netBadge = document.getElementById("net-badge");
  var fwNotice = document.getElementById("fw-notice");
  var confirmBox = document.getElementById("confirm-box");
  var confirmTitle = document.getElementById("confirm-title");
  var confirmDetail = document.getElementById("confirm-detail");
  var confirmGo = document.getElementById("confirm-go");
  var confirmCancel = document.getElementById("confirm-cancel");
  var afterglowBtn = document.getElementById("btn-afterglow");
  var extButtons = document.querySelectorAll(".btn-ext-trigger");

  var KNOWN_AFTERGLOW_FW = {
    "12.00": true, "12.02": true, "12.50": true, "12.52": true,
    "13.00": true, "13.02": true, "13.04": true, "13.50": true,
    "13.52": true, "14.00": true
  };

  function isOffline() {
    try {
      return navigator.onLine === false;
    } catch (e) {
      return false;
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
          "PS4 Firmware 14.00 detectado. Afterglow Actual (Opción 1) es el motor principal verificado y disponible en caché offline.";
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
      if (offline) {
        btn.className = "btn btn-secondary btn-ext-trigger is-disabled";
      } else {
        btn.className = "btn btn-secondary btn-ext-trigger";
      }
    }
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
    if (isOffline()) {
      if (fwNotice) {
        fwNotice.className = "guard-banner warn";
        fwNotice.textContent =
          "Estás sin conexión a Internet. La alternativa externa (" + name + ") no está en la caché offline local; usá Afterglow Actual (Opción 1).";
      }
      return;
    }
    if (!confirmBox || !confirmTitle || !confirmDetail || !confirmGo) return;

    confirmTitle.textContent = "Confirmar apertura externa: " + name;
    confirmDetail.textContent =
      "Destino: " + url + " (Firmwares declarados por el autor externo: " + fwRange + ").";
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
      if (navigating || !href || href === "#" || isOffline()) {
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
