(function () {
  "use strict";

  var cfg = window.kmbpDeactivateFeedback;
  if (!cfg || !cfg.plugin) {
    return;
  }

  var modal = document.getElementById("kmbp-deactivate-modal");
  var form = document.getElementById("kmbp-df-form");
  if (!modal || !form) {
    return;
  }

  var deactivateUrl = "";
  var lastFocus = null;

  function pluginRow() {
    return document.querySelector('#the-list tr[data-plugin="' + cfg.plugin + '"]');
  }

  function deactivateLink() {
    var row = pluginRow();
    return row ? row.querySelector("span.deactivate a") : null;
  }

  function openModal(href) {
    deactivateUrl = href;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("kmbp-df-open");
    var first = modal.querySelector('input[name="kmbp_df_reason"]');
    if (first) {
      first.focus();
    }
  }

  function closeModal() {
    modal.hidden = true;
    modal.classList.remove("is-submitting");
    document.body.classList.remove("kmbp-df-open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function goDeactivate() {
    if (deactivateUrl) {
      window.location.href = deactivateUrl;
    }
  }

  function selectedReason() {
    var checked = form.querySelector('input[name="kmbp_df_reason"]:checked');
    return checked ? checked.value : "";
  }

  function submitFeedback() {
    var submitBtn = form.querySelector('[data-kmbp-df="submit"]');
    modal.classList.add("is-submitting");
    if (submitBtn && cfg.strings && cfg.strings.submitting) {
      submitBtn.textContent = cfg.strings.submitting;
    }

    var body = new window.URLSearchParams();
    body.set("action", cfg.action);
    body.set("nonce", cfg.nonce);
    body.set("reason", selectedReason() || "other");
    body.set("details", (document.getElementById("kmbp-df-details") || {}).value || "");

    var done = false;
    function finish() {
      if (done) {
        return;
      }
      done = true;
      goDeactivate();
    }

    window.setTimeout(finish, 20000);

    window
      .fetch(cfg.ajaxUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: body.toString(),
      })
      .then(finish, finish);
  }

  var link = deactivateLink();
  if (!link) {
    return;
  }

  link.addEventListener("click", function (event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    openModal(link.href);
  });

  modal.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-kmbp-df]");
    if (!trigger) {
      return;
    }
    var action = trigger.getAttribute("data-kmbp-df");
    if (action === "cancel") {
      closeModal();
    } else if (action === "skip") {
      goDeactivate();
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submitFeedback();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });
})();
