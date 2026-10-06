// Remplit les pages avec config.js, construit les fenêtres d'images et gère les étapes de la page « bienvenue ».
(function () {
  var c = window.CREATO || {};
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var setHref = function (sel, url) { all(sel).forEach(function (el) { if (url) el.href = url; else el.remove(); }); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); };
  var bar = function (title) { return '<div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="bar-title">' + esc(title) + "</span><span></span></div>"; };

  all("[data-price]").forEach(function (el) { el.textContent = c.price || ""; });
  setHref("[data-pay=saspay]", c.saspayUrl);
  setHref("[data-pay=whop]", c.whopCardUrl);
  setHref("[data-discord]", c.discordFreeUrl);
  setHref("[data-instagram]", c.instagramUrl);
  all("[data-support]").forEach(function (el) { el.href = c.supportUrl || "#"; });
  var y = document.getElementById("y");
  if (y) y.textContent = new Date().getFullYear();

  // Coaching privé : actif ou « Places prises ».
  var coaching = document.querySelector("[data-coaching]");
  if (coaching) {
    coaching.querySelector("[data-coaching-price]").textContent = c.coachingPrice || "";
    var cta = coaching.querySelector("[data-coaching-cta]");
    if (c.coachingOpen && c.coachingUrl) {
      cta.href = c.coachingUrl;
      cta.textContent = "Rejoindre →";
      cta.className = "btn btn-gold btn-block";
    } else {
      coaching.classList.add("disabled");
      cta.setAttribute("aria-disabled", "true");
      cta.removeAttribute("href");
    }
  }

  // Image manquante → cadre vide (pour ajouter tes photos plus tard dans img/).
  var placeholder = function (img, label) {
    img.addEventListener("error", function () {
      var d = document.createElement("div");
      d.className = img.dataset.fallback === "round" ? "ph-round" : "ph";
      d.textContent = label || "";
      img.replaceWith(d);
    });
  };
  all("img[data-fallback]").forEach(function (img) { placeholder(img); });

  // Fenêtres d'images autour du titre.
  var collage = document.querySelector("[data-collage]");
  if (collage) {
    ["creator-workspace", "vision-studio", "focus-mode", "money-mindset", "creator-energy", "workspace"].forEach(function (name) {
      var f = document.createElement("figure");
      f.className = "win";
      f.style.margin = "0";
      f.innerHTML = bar(name.replace(/-/g, "_") + ".jpg") + '<img src="img/hero-' + name + '.jpg" alt="" />';
      placeholder(f.querySelector("img"));
      collage.appendChild(f);
    });
  }

  // Galerie de résultats : img/result-01.jpg à img/result-20.jpg.
  var results = document.querySelector("[data-results]");
  if (results) {
    for (var i = 1; i <= 20; i++) {
      var n = (i < 10 ? "0" : "") + i;
      var f = document.createElement("figure");
      f.className = "win";
      f.style.margin = "0";
      f.innerHTML = bar("résultat-client-" + n + ".png") + '<div class="canvas"><img src="img/result-' + n + '.jpg" alt="Résultat client — capture ' + i + '" loading="lazy" /></div>';
      (function (fig) { fig.querySelector("img").addEventListener("error", function () { fig.remove(); }); })(f);
      results.appendChild(f);
    }
  }

  // Vidéo de présentation (cachée si aucune).
  var vsl = document.querySelector("[data-vsl]");
  if (vsl) {
    if (c.youtubeId) vsl.querySelector(".video").innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(c.youtubeId) + '" title="Présentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>';
    else vsl.remove();
  }

  // Apparition douce au défilement.
  var reveals = all(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add("visible"); });

  // ----- Page « bienvenue » -----
  var steps = all(".step[data-step]");
  if (!steps.length) return;

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

  // Le lien d'accès ne s'ouvre qu'une fois les 3 étapes cochées.
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
    var ready = done >= steps.length;
    access.setAttribute("aria-disabled", ready ? "false" : "true");
    access.tabIndex = ready ? 0 : -1;
    hint.textContent = ready ? "Ce lien est à toi seul : ne le partage avec personne." : "Coche les 3 étapes ci-dessus pour débloquer ton lien d'accès.";
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
