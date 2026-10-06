// Remplit la page avec les réglages de config.js, et gère les étapes de la page « bienvenue ».
(function () {
  var c = window.CREATO || {};
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  all("[data-price]").forEach(function (el) { el.textContent = c.price || ""; });
  all("[data-period]").forEach(function (el) { el.textContent = c.pricePeriod || ""; });
  all("[data-pay=saspay]").forEach(function (el) { el.href = c.saspayUrl || "#"; });
  all("[data-pay=whop]").forEach(function (el) {
    if (c.whopCardUrl) el.href = c.whopCardUrl;
    else el.remove();
  });
  all("[data-support]").forEach(function (el) { el.href = c.supportUrl || "#"; });
  var y = document.getElementById("y");
  if (y) y.textContent = new Date().getFullYear();

  // ----- Page « bienvenue » -----
  var steps = all(".step[data-step]");
  if (!steps.length) return;

  // Onglets PC / Téléphone : on ouvre celui de l'appareil utilisé.
  var mobile = window.matchMedia("(max-width: 860px)").matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  all(".tabs").forEach(function (tabs) {
    var buttons = Array.prototype.slice.call(tabs.querySelectorAll("button"));
    var show = function (which) {
      buttons.forEach(function (b) {
        var on = b.dataset.tab === which;
        b.setAttribute("aria-selected", on ? "true" : "false");
        document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
      });
    };
    buttons.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.tab); }); });
    show(mobile ? "tel" : "pc");
  });

  // Le lien d'accès ne s'ouvre qu'une fois les étapes 1 et 2 cochées.
  var KEY = "creato-acces-etapes";
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
  var access = document.getElementById("access");
  var hint = document.getElementById("access-hint");
  var bars = all(".steps-progress span");
  access.href = c.accessUrl || "#";

  var refresh = function () {
    var done = 0;
    steps.forEach(function (s) {
      var box = s.querySelector("input[type=checkbox]");
      var ok = box && box.checked;
      s.classList.toggle("done", !!ok);
      if (ok) done++;
    });
    bars.forEach(function (b, i) { b.classList.toggle("on", i < done + 1); });
    var ready = done >= 3;
    access.setAttribute("aria-disabled", ready ? "false" : "true");
    access.tabIndex = ready ? 0 : -1;
    hint.textContent = ready ? "Ce lien est à toi seul : ne le partage avec personne." : "Coche les étapes ci-dessus pour débloquer ton lien d'accès.";
  };

  all(".step input[type=checkbox]").forEach(function (box) {
    box.checked = !!saved[box.id];
    box.addEventListener("change", function () {
      saved[box.id] = box.checked;
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
      refresh();
    });
  });
  refresh();
})();
