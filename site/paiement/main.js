// Page TikTok Elite : paiement (accueil), puis vérification par le serveur, code à copier et accès (merci.html).
(function () {
  var c = window.CREATO || {};

  // ----- Accueil : les deux boutons fusionnent en un cercle gris qui tourne, puis on part vers SasPay. -----
  var price = document.querySelector("[data-price]");
  if (price && c.price) price.textContent = c.price;

  // Captures de résultats : 2 colonnes de même largeur, hauteur libre.
  // Chaque photo va dans la colonne la plus courte, pour que les deux colonnes finissent au même niveau.
  var results = document.querySelector("[data-results]");
  if (results && c.results && c.results.length) {
    var cols = [document.createElement("div"), document.createElement("div")];
    var heights = [0, 0];
    cols.forEach(function (col) { results.appendChild(col); });
    var place = function (i) {
      if (i >= c.results.length) return;
      var img = new Image();
      img.alt = "Résultat d'un membre";
      img.decoding = "async";
      img.onload = img.onerror = function () {
        var k = heights[0] <= heights[1] ? 0 : 1;
        heights[k] += img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
        cols[k].appendChild(img);
        place(i + 1);
      };
      img.src = c.results[i];
    };
    place(0);
  } else if (results) results.remove();

  // ----- Accueil : clic → nom + e-mail → les boutons fusionnent en un cercle gris → page de paiement SasPay. -----
  var zone = document.querySelector("[data-pay-zone]");
  var form = document.querySelector("[data-pay-form]");
  if (zone && form) {
    var err = form.querySelector("[data-pay-error]");
    var showForm = function (show) {
      zone.hidden = show;
      form.hidden = !show;
      if (show) form.elements.name.focus();
    };
    Array.prototype.forEach.call(zone.querySelectorAll("[data-pay]"), function (btn) {
      btn.addEventListener("click", function (e) { e.preventDefault(); showForm(true); });
    });
    form.querySelector("[data-pay-back]").addEventListener("click", function () { err.textContent = ""; showForm(false); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.textContent = "";
      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      if (name.length < 2) return (err.textContent = "Indique ton nom.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return (err.textContent = "Adresse e-mail invalide.");
      showForm(false);
      zone.classList.add("paying");
      fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, email: email }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.url) throw new Error(res.j.error || "Le paiement est momentanément indisponible.");
          window.location.href = res.j.url;
        })
        .catch(function (e2) {
          zone.classList.remove("paying");
          showForm(true);
          err.textContent = e2.message || "Le paiement est momentanément indisponible.";
        });
    });
    // Retour arrière depuis SasPay : on réaffiche les boutons.
    window.addEventListener("pageshow", function () { zone.classList.remove("paying"); });
  }

  // ----- Retour de paiement : le serveur vérifie auprès de SasPay. Gris tant que c'est en cours, vert seulement si SUCCESS. -----
  var thanks = document.querySelector("[data-thanks]");
  if (!thanks) return;
  var title = thanks.querySelector("[data-status-title]");
  var note = thanks.querySelector("[data-status-note]");
  var retry = thanks.querySelector("[data-retry]");
  var step = thanks.querySelector("[data-code-step]");
  var codeEl = thanks.querySelector("[data-code]");
  var copyBtn = thanks.querySelector("[data-copy]");
  var hint = thanks.querySelector("[data-copy-hint]");
  var join = thanks.querySelector("[data-join]");
  var token = new URLSearchParams(window.location.search).get("s") || "";
  var started = Date.now();
  var community = "";

  var fail = function (titleText, noteText) {
    thanks.classList.add("ko");
    title.textContent = titleText;
    note.textContent = noteText;
    retry.hidden = false;
  };
  var check = function () {
    if (!token) return fail("Lien invalide", "Ce lien de retour ne correspond à aucun paiement.");
    fetch("/api/status?s=" + encodeURIComponent(token), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.status === "SUCCESS") {
          thanks.classList.add("ok");
          title.textContent = "Paiement validé";
          note.textContent = "";
          codeEl.textContent = j.code;
          community = j.community;
          setTimeout(function () { step.hidden = false; }, 700);
        } else if (j.status === "FAILED") {
          fail("Paiement non abouti", "Ton paiement a été refusé ou annulé. Aucun accès n'a été créé.");
        } else if (j.status === "UNKNOWN") {
          fail("Lien invalide", "Ce lien de retour ne correspond à aucun paiement.");
        } else if (Date.now() - started > 3 * 60 * 1000) {
          title.textContent = "Paiement en attente";
          note.textContent = "SasPay n'a pas encore confirmé ton paiement. Garde cette page ouverte : elle se mettra à jour toute seule.";
          setTimeout(check, 15000);
        } else {
          if (Date.now() - started > 15000) note.textContent = "Confirmation en cours auprès de SasPay…";
          setTimeout(check, 3000);
        }
      })
      .catch(function () { setTimeout(check, 5000); });
  };
  check();

  var unlock = function () {
    copyBtn.textContent = "Copié ✓";
    hint.textContent = "Code copié. Tu peux maintenant rejoindre la communauté.";
    join.href = community || "#";
    join.removeAttribute("aria-disabled");
    join.className = "btn btn-gold btn-join";
  };
  copyBtn.addEventListener("click", function () {
    var text = codeEl.textContent;
    var fallback = function () {
      var r = document.createRange();
      r.selectNodeContents(codeEl);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      try { document.execCommand("copy"); } catch (e) {}
      unlock();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(unlock, fallback);
    else fallback();
  });
})();
