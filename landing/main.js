// Page TikTok Elite : animation de paiement (accueil), puis validation, code à copier et accès (merci.html).
(function () {
  var c = window.CREATO || {};

  // ----- Accueil : les deux boutons fusionnent en un cercle gris qui tourne, puis on part vers SasPay. -----
  var price = document.querySelector("[data-price]");
  if (price && c.price) price.textContent = c.price;

  var zone = document.querySelector("[data-pay-zone]");
  if (zone) {
    var reset = function () { zone.classList.remove("paying"); };
    Array.prototype.forEach.call(zone.querySelectorAll("[data-pay]"), function (btn) {
      btn.href = c.saspayUrl || "#";
      btn.addEventListener("click", function (e) {
        if (!c.saspayUrl) return;
        e.preventDefault();
        zone.classList.add("paying");
        setTimeout(function () { window.location.href = c.saspayUrl; }, 900);
      });
    });
    // Retour arrière depuis SasPay : on réaffiche les boutons.
    window.addEventListener("pageshow", reset);
  }

  // ----- Retour de paiement : cercle gris → vert, puis le code et le bouton d'accès. -----
  var thanks = document.querySelector("[data-thanks]");
  if (!thanks) return;
  var title = thanks.querySelector("[data-status-title]");
  var step = thanks.querySelector("[data-code-step]");
  var codeEl = thanks.querySelector("[data-code]");
  var copyBtn = thanks.querySelector("[data-copy]");
  var hint = thanks.querySelector("[data-copy-hint]");
  var join = thanks.querySelector("[data-join]");
  codeEl.textContent = c.accessCode || "";

  setTimeout(function () {
    thanks.classList.add("ok");
    title.textContent = "Paiement validé";
    setTimeout(function () { step.hidden = false; }, 700);
  }, 1800);

  var unlock = function () {
    copyBtn.textContent = "Copié ✓";
    hint.textContent = "Code copié. Tu peux maintenant rejoindre la communauté.";
    join.href = c.communityUrl || "#";
    join.removeAttribute("aria-disabled");
    join.className = "btn btn-gold btn-join";
  };
  copyBtn.addEventListener("click", function () {
    var text = c.accessCode || "";
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(unlock, fallback);
    } else fallback();
    function fallback() {
      var r = document.createRange();
      r.selectNodeContents(codeEl);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      try { document.execCommand("copy"); } catch (e) {}
      unlock();
    }
  });
})();
