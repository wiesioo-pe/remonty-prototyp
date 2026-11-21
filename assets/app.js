// Prototyp: wyłącznie ulepszenia. Bez JS strona i nawigacja działają normalnie.
(function () {
  "use strict";

  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* tryb prywatny itp. */ } }
  };

  // --- Komunikat o urlopie (demonstracja stanu sterowanego z panelu) ---
  function initVacation() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("urlop") === "1") store.set("proto-urlop", "1");
    if (params.get("urlop") === "0") store.set("proto-urlop", "0");
    var on = store.get("proto-urlop") === "1";
    var apply = function () {
      document.querySelectorAll("[data-vacation]").forEach(function (el) { el.hidden = !on; });
      document.querySelectorAll("[data-vacation-off]").forEach(function (el) { el.hidden = on; });
      document.querySelectorAll("[data-toggle-vacation]").forEach(function (a) {
        a.textContent = on ? "Ukryj komunikat o urlopie" : "Pokaż komunikat o urlopie";
        a.setAttribute("href", on ? "?urlop=0" : "?urlop=1");
      });
    };
    document.querySelectorAll("[data-toggle-vacation]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        on = !on;
        store.set("proto-urlop", on ? "1" : "0");
        apply();
      });
    });
    apply();
  }

  // --- Formularz kontaktowy: walidacja i stany (w docelowej wersji walidacja jest po stronie serwera) ---
  function initContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;
    var summary = document.getElementById("form-errors");
    var summaryList = summary.querySelector("ul");
    var sendError = document.getElementById("send-error");
    var submit = form.querySelector("button[type=submit]");
    var message = form.querySelector("#f-message");
    var counter = document.getElementById("f-message-count");
    var simulateFailure = false;

    document.querySelectorAll("[data-simulate-failure]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        simulateFailure = true;
        a.textContent = "Następna wysyłka zakończy się błędem";
      });
    });

    if (message && counter) {
      var update = function () { counter.textContent = message.value.length + " / 1000 znaków"; };
      message.addEventListener("input", update);
      update();
    }

    function setError(id, text) {
      var field = form.querySelector("#" + id).closest(".field");
      var err = field.querySelector(".error");
      var input = field.querySelector("input, textarea");
      if (text) {
        field.classList.add("has-error");
        err.textContent = text;
        input.setAttribute("aria-invalid", "true");
      } else {
        field.classList.remove("has-error");
        err.textContent = "";
        input.removeAttribute("aria-invalid");
      }
      return text;
    }

    function validContact(v) {
      var email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      var digits = v.replace(/[\s()+\-]/g, "");
      var phone = /^\d{9,15}$/.test(digits) && /^\+?[\d\s()\-]+$/.test(v);
      return email || phone;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      sendError.hidden = true;
      var name = form.querySelector("#f-name").value.trim();
      var contact = form.querySelector("#f-contact").value.trim();
      var place = form.querySelector("#f-place").value.trim();
      var msg = message ? message.value.trim() : "";
      var errors = [];

      // Kolejność komunikatów = kolejność pól w formularzu
      var e1 = setError("f-message", !msg ? "Proszę krótko opisać, co jest do zrobienia." : (msg.length > 1000 ? "Opis może mieć maksymalnie 1000 znaków." : ""));
      if (e1) errors.push(["f-message", "Opis prac"]);
      var e2 = setError("f-place", !place ? "Potrzebna jest miejscowość, żeby sprawdzić dojazd." : "");
      if (e2) errors.push(["f-place", "Miejscowość"]);
      var e3 = setError("f-name", name.length > 80 ? "Maksymalnie 80 znaków." : "");
      if (e3) errors.push(["f-name", "Imię"]);
      var e4 = setError("f-contact", !contact ? "Potrzebny jest numer telefonu albo adres e-mail." :
        (!validContact(contact) ? "Format nie jest rozpoznany. Przykład: 500 000 000 lub imie@domena.pl." : ""));
      if (e4) errors.push(["f-contact", "Kontakt zwrotny"]);

      if (errors.length) {
        summaryList.innerHTML = "";
        errors.forEach(function (pair) {
          var li = document.createElement("li");
          var a = document.createElement("a");
          a.href = "#" + pair[0];
          a.textContent = pair[1];
          li.appendChild(a);
          summaryList.appendChild(li);
        });
        summary.hidden = false;
        summary.focus();
        return;
      }
      summary.hidden = true;

      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      var label = submit.querySelector("span");
      var original = label.textContent;
      var status = document.getElementById("form-status");
      label.textContent = "Wysyłanie zapytania…";
      if (status) status.textContent = "Wysyłanie zapytania…";

      window.setTimeout(function () {
        if (status) status.textContent = "";
        if (simulateFailure) {
          simulateFailure = false;
          submit.disabled = false;
          submit.removeAttribute("aria-busy");
          label.textContent = "Spróbuj ponownie";
          sendError.hidden = false;
          sendError.focus();
          return;
        }
        // Sukces: przejście na stronę potwierdzenia bez danych w adresie.
        window.location.href = "potwierdzenie.html";
        label.textContent = original;
      }, 900);
    });
  }

  // --- Panel: podgląd na żywo ---
  function initPanel() {
    var panel = document.getElementById("panel-form");
    if (!panel) return;
    var $ = function (id) { return document.getElementById(id); };
    var fmt = function (n) { return n.toLocaleString("pl-PL", { maximumFractionDigits: 2 }); };
    var errorsBox = $("panel-errors");
    var dateFmt = function (v) {
      if (!v) return "…";
      var d = new Date(v + "T12:00:00");
      return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
    };

    function render() {
      $("pv-avail").textContent = $("p-avail").value || "…";
      $("pv-appliance").textContent = fmt(parseFloat($("p-appliance").value) || 0);
      $("pv-hour").textContent = fmt(parseFloat($("p-hour").value) || 0);
      $("pv-hours").textContent = $("p-hours").value || "…";
      var on = $("p-vac-on").checked;
      $("vac-fields").hidden = !on;
      $("pv-vacation").hidden = !on;
      // W czasie urlopu godziny telefonu są zastąpione komunikatem o powrocie.
      $("pv-contact").hidden = on;
      $("pv-vac-title").textContent = "Urlop: " + dateFmt($("p-vac-from").value) + " – " + dateFmt($("p-vac-to").value);
      $("pv-vac-text").textContent = $("p-vac-text").value;
    }

    function validate() {
      var problems = [];
      if (!$("p-avail").value.trim()) problems.push("Wpisz informację o najbliższych wolnych terminach.");
      if (!(parseFloat($("p-appliance").value) > 0)) problems.push("Cena podłączenia sprzętu musi być większa od zera.");
      if (!(parseFloat($("p-hour").value) > 0)) problems.push("Stawka godzinowa musi być większa od zera.");
      if ($("p-vac-on").checked) {
        var from = $("p-vac-from").value, to = $("p-vac-to").value;
        if (!from || !to) problems.push("Podaj obie daty urlopu.");
        else if (to < from) problems.push("Data zakończenia urlopu nie może być wcześniejsza niż data rozpoczęcia.");
      }
      return problems;
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    panel.addEventListener("submit", function (e) {
      e.preventDefault();
      var toast = $("panel-toast");
      var problems = validate();
      toast.hidden = true;
      if (problems.length) {
        var list = errorsBox.querySelector("ul");
        list.innerHTML = "";
        problems.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; list.appendChild(li); });
        errorsBox.hidden = false;
        errorsBox.focus();
        return;
      }
      errorsBox.hidden = true;
      var btn = $("panel-submit");
      var label = btn.querySelector("span");
      btn.disabled = true;
      label.textContent = "Publikuję…";
      window.setTimeout(function () {
        btn.disabled = false;
        label.textContent = "Zapisz i opublikuj";
        toast.hidden = false;
        toast.focus();
      }, 1200);
    });
    render();
  }

  // --- Warianty kolorów do porównania (też przez ?palette=grafit|granat|cegla|pomarancz) ---
  function initVariants() {
    var root = document.documentElement;
    var params = new URLSearchParams(window.location.search);
    [["palette", "data-set-palette", "proto-palette"]].forEach(function (v) {
      var key = v[0], attr = v[1], storeKey = v[2];
      var value = params.get(key) || store.get(storeKey);
      var buttons = document.querySelectorAll("[" + attr + "]");
      var apply = function (val) {
        if (!val) return;
        root.setAttribute("data-" + key, val);
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute(attr) === val)); });
      };
      apply(value || root.getAttribute("data-" + key));
      buttons.forEach(function (b) {
        b.addEventListener("click", function () {
          var val = b.getAttribute(attr);
          store.set(storeKey, val);
          apply(val);
        });
      });
    });
  }

  // Rząd z linkami przewija się ze stroną; gdy zniknie, górny pasek dostaje obramowanie i cień
  function initStickyBar() {
    var bar = document.querySelector(".topbar");
    var subnav = document.querySelector(".subnav");
    if (!bar || !subnav || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      bar.classList.toggle("is-stuck", !entries[0].isIntersecting);
    }, { rootMargin: "-" + bar.offsetHeight + "px 0px 0px 0px" }).observe(subnav);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initVariants();
    initStickyBar();
    initVacation();
    initContactForm();
    initPanel();
  });
})();
