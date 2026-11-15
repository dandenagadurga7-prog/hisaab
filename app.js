/* Hisaab — app logic. Plain JS, browser storage, no AI. */
(function () {
  "use strict";
  var L = window.HisaabLogic;
  var KEY = "hisaab-v1";
  var LANG_KEY = "hisaab-lang";
  var TODAY = localToday();
  var lang = "en";
  var store = { shop: "", upi: "", customers: [], entries: [] };
  var editingId = null;
  var detailPhone = null;
  var pendingShot = "";

  function localToday() {
    try {
      var q = new URLSearchParams(window.location.search).get("today");
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    } catch (e) { /* ignore */ }
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- language ---------- */
  var I18N = {
    en: {
      total: "Total outstanding", search: "Search name or phone", addCustomer: "+ Customer", addEntry: "+ Entry",
      import: "Import", export: "CSV", settings: "Settings", overdue: "Overdue",
      overdueHint: "Longest since last payment first", customers: "Customers",
      emptyTitle: "No customers yet.", emptyBody: "Add a customer, or load the sample shop through Import.",
      back: "← All customers", balance: "Balance", remind: "WhatsApp reminder", payUpi: "Pay by UPI",
      addEntryFor: "+ Entry for this customer", entries: "Entries", importTitle: "Import a shop",
      importHint: "Paste the JSON, then press Load JSON", importGo: "Load JSON", close: "Close",
      format: "Accepted format", settingsTitle: "Shop settings", shopName: "Shop name",
      upiId: "UPI ID (for the pay link)", save: "Save", cancel: "Cancel",
      foot: "Saved on this phone. No account needed.", addCustomerTitle: "Add customer",
      name: "Name", phone: "Phone (10 digits)", addEntryTitle: "Add entry", customer: "Customer",
      credit: "Credit (goods given)", payment: "Payment (money received)", amount: "Amount (Rs)",
      date: "Date", note: "Note (short)", shot: "Payment screenshot (optional)",
      creditShort: "Credit", paymentShort: "Payment", noPayment: "No payment yet",
      daysSince: "days since payment", entriesCount: "entries", view: "View", whatsapp: "WhatsApp"
    },
    hi: {
      total: "कुल बकाया", search: "नाम या फोन खोजें", addCustomer: "+ ग्राहक", addEntry: "+ एंट्री",
      import: "इम्पोर्ट", export: "CSV", settings: "सेटिंग", overdue: "बकाया",
      overdueHint: "सबसे पुराने भुगतान पहले", customers: "ग्राहक",
      emptyTitle: "अभी कोई ग्राहक नहीं।", emptyBody: "ग्राहक जोड़ें, या इम्पोर्ट से नमूना दुकान लोड करें।",
      back: "← सभी ग्राहक", balance: "बाकी", remind: "व्हाट्सएप रिमाइंडर", payUpi: "UPI से भुगतान",
      addEntryFor: "+ इस ग्राहक की एंट्री", entries: "एंट्रियां", importTitle: "दुकान इम्पोर्ट करें",
      importHint: "JSON चिपकाएं, फिर Load JSON दबाएं", importGo: "Load JSON", close: "बंद करें",
      format: "स्वीकार्य फॉर्मेट", settingsTitle: "दुकान सेटिंग", shopName: "दुकान का नाम",
      upiId: "UPI आईडी (भुगतान लिंक के लिए)", save: "सेव", cancel: "रद्द",
      foot: "इस फोन में सेव होता है। खाता जरूरी नहीं।", addCustomerTitle: "ग्राहक जोड़ें",
      name: "नाम", phone: "फोन (10 अंक)", addEntryTitle: "एंट्री जोड़ें", customer: "ग्राहक",
      credit: "उधार (माल दिया)", payment: "भुगतान (पैसा मिला)", amount: "रकम (रु)",
      date: "तारीख", note: "नोट (छोटा)", shot: "भुगतान स्क्रीनशॉट (वैकल्पिक)",
      creditShort: "उधार", paymentShort: "भुगतान", noPayment: "अभी भुगतान नहीं",
      daysSince: "दिन से भुगतान नहीं", entriesCount: "एंट्रियां", view: "देखें", whatsapp: "व्हाट्सएप"
    },
    te: {
      total: "మొత్తం బాకీ", search: "పేరు లేదా ఫోన్ వెతకండి", addCustomer: "+ కస్టమర్", addEntry: "+ ఎంట్రీ",
      import: "ఇంపోర్ట్", export: "CSV", settings: "సెట్టింగ్స్", overdue: "బాకీ ఉన్నవి",
      overdueHint: "పాత చెల్లింపు ముందుగా", customers: "కస్టమర్లు",
      emptyTitle: "ఇంకా కస్టమర్లు లేరు.", emptyBody: "కస్టమర్ జోడించండి, లేదా ఇంపోర్ట్‌లో నమూనా షాప్ లోడ్ చేయండి.",
      back: "← అందరు కస్టమర్లు", balance: "బాకీ", remind: "వాట్సాప్ రిమైండర్", payUpi: "UPI తో చెల్లించండి",
      addEntryFor: "+ ఈ కస్టమర్ ఎంట్రీ", entries: "ఎంట్రీలు", importTitle: "షాప్ ఇంపోర్ట్",
      importHint: "JSON పేస్ట్ చేసి, Load JSON నొక్కండి", importGo: "Load JSON", close: "మూసివేయి",
      format: "అంగీకరించే ఫార్మాట్", settingsTitle: "షాప్ సెట్టింగ్స్", shopName: "షాప్ పేరు",
      upiId: "UPI ఐడీ (పే లింక్ కోసం)", save: "సేవ్", cancel: "రద్దు",
      foot: "ఈ ఫోన్‌లో సేవ్ అవుతుంది. ఖాతా అవసరం లేదు.", addCustomerTitle: "కస్టమర్ జోడించండి",
      name: "పేరు", phone: "ఫోన్ (10 అంకెలు)", addEntryTitle: "ఎంట్రీ జోడించండి", customer: "కస్టమర్",
      credit: "అప్పు (సరుకు ఇచ్చారు)", payment: "చెల్లింపు (డబ్బు వచ్చింది)", amount: "మొత్తం (రూ)",
      date: "తేదీ", note: "నోట్ (చిన్నది)", shot: "చెల్లింపు స్క్రీన్‌షాట్ (ఐచ్ఛికం)",
      creditShort: "అప్పు", paymentShort: "చెల్లింపు", noPayment: "ఇంకా చెల్లింపు లేదు",
      daysSince: "రోజుల నుండి చెల్లింపు లేదు", entriesCount: "ఎంట్రీలు", view: "చూడండి", whatsapp: "వాట్సాప్"
    }
  };
  function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }

  function applyLang() {
    document.documentElement.lang = lang;
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-ph]"), function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
    });
    document.getElementById("lang").value = lang;
  }

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.customers) && Array.isArray(d.entries)) store = { shop: d.shop || "", upi: d.upi || "", customers: d.customers, entries: d.entries };
    } catch (e) { /* ignore corrupt storage */ }
    try { lang = localStorage.getItem(LANG_KEY) || "en"; } catch (e) { /* ignore */ }
    if (!I18N[lang]) lang = "en";
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); return true; }
    catch (e) { alert("This phone's storage is full. Remove a screenshot and try again."); return false; }
  }

  /* ---------- helpers ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function customerByPhone(phone) { for (var i = 0; i < store.customers.length; i++) if (store.customers[i].phone === phone) return store.customers[i]; return null; }
  function fmtDate(iso) {
    if (!iso) return "";
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return m[3] + " " + names[+m[2] - 1] + " " + m[1];
  }
  function shortAmount(n) { return L.formatRs(n); }
  function total() { return L.totalOutstanding(store); }

  /* ---------- render ---------- */
  function render() {
    el("shop-name").textContent = store.shop || "Your shop";
    var tot = total();
    var tEl = el("total-outstanding");
    tEl.textContent = shortAmount(tot);
    tEl.setAttribute("data-amount", String(tot));
    renderList();
    renderOverdue();
    route();
  }

  function renderList() {
    var q = (el("search").value || "").trim().toLowerCase();
    var list = store.customers.slice();
    if (q) list = list.filter(function (c) { return (c.name || "").toLowerCase().indexOf(q) >= 0 || c.phone.indexOf(q) >= 0; });
    list.sort(function (a, b) { var d = L.balanceOf(store, b.phone) - L.balanceOf(store, a.phone); return d || a.name.localeCompare(b.name); });

    el("customer-count").textContent = store.customers.length + " " + t("customers").toLowerCase();
    el("empty-state").hidden = store.customers.length > 0;
    el("customer-list").innerHTML = list.map(function (c) {
      var bal = L.balanceOf(store, c.phone);
      var cls = bal > 0 ? "balance-due" : (bal < 0 ? "balance-due" : "balance-zero");
      var href = L.reminderHref(c, bal, store.shop, store.upi, lang);
      return '<div class="customer" data-customer="' + esc(c.phone) + '">' +
        '<div class="who"><a class="name" href="#/customer/' + esc(c.phone) + '">' + esc(c.name) + '</a>' +
        '<span class="phone">' + esc(c.phone) + '</span></div>' +
        '<div class="amount ' + cls + '" data-balance data-amount="' + bal + '">' + esc(shortAmount(bal)) + '</div>' +
        '<div class="actions">' +
        '<a class="btn small whatsapp" data-remind="' + esc(c.phone) + '" href="' + esc(href) + '" target="_blank" rel="noopener">' + t("whatsapp") + '</a>' +
        '<a class="btn small" href="#/customer/' + esc(c.phone) + '">' + t("view") + '</a>' +
        '</div></div>';
    }).join("");
  }

  function renderOverdue() {
    var items = L.overdue(store, TODAY);
    var card = el("overdue-card");
    if (!store.customers.length) { card.hidden = true; return; }
    card.hidden = false;
    var top = items.slice(0, 6);
    el("overdue-list").innerHTML = top.length ? top.map(function (x) {
      var days = x.lastPayment ? (x.daysSince + " " + t("daysSince")) : t("noPayment");
      return '<a class="overdue-item" href="#/customer/' + esc(x.customer.phone) + '">' +
        '<span><strong>' + esc(x.customer.name) + '</strong><br><span class="muted">' + esc(days) + '</span></span>' +
        '<span class="d">' + esc(shortAmount(x.balance)) + '</span></a>';
    }).join("") : '<div class="muted">' + (lang === "te" ? "బాకీ లేదు." : lang === "hi" ? "कोई बकाया नहीं।" : "Nothing overdue.") + '</div>';
  }

  function renderDetail(phone) {
    var c = customerByPhone(phone);
    var view = el("detail-view");
    if (!c) { view.hidden = true; return; }
    detailPhone = phone;
    var bal = L.balanceOf(store, phone);
    el("detail-name").textContent = c.name;
    el("detail-phone").textContent = c.phone;
    var bEl = el("detail-balance");
    bEl.textContent = shortAmount(bal);
    bEl.setAttribute("data-amount", String(bal));
    var rem = el("detail-remind");
    rem.href = L.reminderHref(c, bal, store.shop, store.upi, lang);
    var upi = L.upiLink(store.upi, store.shop, c.name, bal);
    var upiEl = el("detail-upi");
    if (upi) { upiEl.href = upi; upiEl.hidden = false; } else { upiEl.hidden = true; }

    var rows = store.entries.filter(function (e) { return e.phone === phone; })
      .sort(function (a, b) { return (b.date || "").localeCompare(a.date || "") || String(b.id).localeCompare(String(a.id)); });
    el("detail-entries").innerHTML = rows.length ? rows.map(function (e) {
      var shot = e.shot ? '<img class="shot" data-shot src="' + esc(e.shot) + '" alt="Payment screenshot" />' : "";
      return '<div class="entry ' + esc(e.type) + '" data-entry="' + esc(e.id) + '">' +
        '<div class="top"><span class="type">' + (e.type === "payment" ? t("paymentShort") : t("creditShort")) + '</span>' +
        '<span class="amt">' + esc(shortAmount(e.amount)) + '</span></div>' +
        '<div class="meta">' + esc(fmtDate(e.date)) + (e.note ? ' · ' + esc(e.note) : "") + '</div>' +
        shot +
        '<div class="entry-actions">' +
        '<button class="btn small" data-act="edit" data-id="' + esc(e.id) + '">' + (lang === "te" ? "మార్చండి" : lang === "hi" ? "बदलें" : "Edit") + '</button>' +
        '<button class="btn small danger" data-act="del" data-id="' + esc(e.id) + '">' + (lang === "te" ? "తొలగించండి" : lang === "hi" ? "हटाएं" : "Delete") + '</button>' +
        '</div></div>';
    }).join("") : '<div class="muted">' + (lang === "te" ? "ఎంట్రీలు లేవు." : lang === "hi" ? "कोई एंट्री नहीं।" : "No entries yet.") + '</div>';
    el("detail-add-entry").setAttribute("data-phone", phone);
  }

  function route() {
    var h = (location.hash || "#/").replace(/^#/, "");
    var m = h.match(/^\/customer\/(\d{10})$/);
    var listView = el("list-view"), detailView = el("detail-view");
    var importView = el("import-view");
    if (m) {
      detailView.hidden = false; listView.hidden = true;
      if (importView) importView.hidden = true;
      el("overdue-card").hidden = true;
      renderDetail(m[1]);
    } else {
      detailView.hidden = true; listView.hidden = false;
      if (importView) importView.hidden = false;
      if (store.customers.length) el("overdue-card").hidden = false;
    }
  }

  /* ---------- customer form ---------- */
  function openCustomer() {
    el("cust-name").value = ""; el("cust-phone").value = ""; el("cust-msg").textContent = "";
    el("customer-overlay").hidden = false;
    setTimeout(function () { el("cust-name").focus(); }, 30);
  }
  function closeCustomer() { el("customer-overlay").hidden = true; }
  function saveCustomer() {
    var name = el("cust-name").value.trim();
    var phone = L.normalizePhone(el("cust-phone").value);
    var msg = el("cust-msg");
    if (!name) { msg.textContent = "Enter the customer's name."; return; }
    if (!phone) { msg.textContent = "Enter a 10 digit phone number."; return; }
    if (customerByPhone(phone)) { msg.textContent = "That phone number is already added."; return; }
    store.customers.push({ id: "c" + Date.now().toString(36), name: name, phone: phone });
    persist(); closeCustomer(); render();
  }

  /* ---------- entry form ---------- */
  function fillCustomerSelect(selected) {
    var sel = el("entry-customer");
    sel.innerHTML = store.customers.map(function (c) {
      return '<option value="' + esc(c.phone) + '"' + (c.phone === selected ? " selected" : "") + '>' + esc(c.name) + ' — ' + esc(c.phone) + '</option>';
    }).join("");
  }
  function openEntry(phone, entry) {
    if (!store.customers.length) { openCustomer(); return; }
    fillCustomerSelect(phone || (store.customers[0] && store.customers[0].phone) || "");
    editingId = entry ? entry.id : null;
    el("entry-title").textContent = entry ? (lang === "te" ? "ఎంట్రీ మార్చండి" : lang === "hi" ? "एंट्री बदलें" : "Edit entry") : t("addEntryTitle");
    var type = entry ? entry.type : "credit";
    Array.prototype.forEach.call(document.querySelectorAll('input[name="entry-type"]'), function (r) { r.checked = r.value === type; });
    el("entry-amount").value = entry ? entry.amount : "";
    el("entry-date").value = entry ? entry.date : TODAY;
    el("entry-note").value = entry ? entry.note || "" : "";
    el("shot-input").value = "";
    pendingShot = entry && entry.shot ? entry.shot : "";
    el("shot-preview").innerHTML = pendingShot ? '<img src="' + esc(pendingShot) + '" alt="Selected screenshot" />' : "";
    el("entry-msg").textContent = "";
    el("entry-overlay").hidden = false;
    setTimeout(function () { el("entry-amount").focus(); }, 30);
  }
  function closeEntry() { el("entry-overlay").hidden = true; editingId = null; pendingShot = ""; }

  function readImage(file, cb) {
    try {
      var reader = new FileReader();
      reader.onload = function () {
        var src = String(reader.result || "");
        var img = new Image();
        img.onload = function () {
          try {
            var max = 720, w = img.width, h = img.height;
            if (w > max || h > max) { var s = Math.min(max / w, max / h); w = Math.round(w * s); h = Math.round(h * s); }
            var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
            var ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
            cb(cv.toDataURL("image/jpeg", 0.65));
          } catch (e) { cb(src); }
        };
        img.onerror = function () { cb(src); };
        img.src = src;
      };
      reader.onerror = function () { cb(""); };
      reader.readAsDataURL(file);
    } catch (e) { cb(""); }
  }

  function saveEntry() {
    var phone = el("entry-customer").value;
    var radio = document.querySelector('input[name="entry-type"]:checked');
    var type = radio ? radio.value : "credit";
    var amount = L.parseAmount(el("entry-amount").value);
    var date = el("entry-date").value || TODAY;
    var note = el("entry-note").value.trim();
    var msg = el("entry-msg");
    if (!phone) { msg.textContent = "Choose a customer."; return; }
    if (!(amount > 0)) { msg.textContent = "Enter an amount greater than 0."; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { msg.textContent = "Choose a valid date."; return; }
    var file = el("shot-input").files && el("shot-input").files[0];

    function commit(shot) {
      var finalShot = type === "payment" ? (shot || (editingId ? (store.entries.filter(function (x) { return x.id === editingId; })[0] || {}).shot || "" : "")) : "";
      if (editingId) {
        var e = store.entries.filter(function (x) { return x.id === editingId; })[0];
        if (e) { e.phone = phone; e.type = type; e.amount = amount; e.date = date; e.note = note; e.shot = finalShot; }
      } else {
        store.entries.push({ id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), phone: phone, type: type, amount: amount, date: date, note: note, shot: finalShot });
      }
      persist(); closeEntry(); render();
    }
    if (file) readImage(file, commit); else commit("");
  }

  function deleteEntry(id) {
    store.entries = store.entries.filter(function (e) { return e.id !== id; });
    persist(); render();
  }

  /* ---------- import / export / settings ---------- */
  function openImport() {
    if (el("import-view").hidden) el("import-view").hidden = false;
    el("import-view").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () { el("import-box").focus(); }, 200);
  }
  function doImport() {
    var box = el("import-box");
    var out = el("import-msg");
    var raw = box.value.trim();
    if (!raw) { out.textContent = "Paste the JSON first."; return; }
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { out.textContent = "That is not valid JSON: " + e.message; return; }
    var res = L.normalize(parsed, { today: TODAY });
    var d = res.data;
    if (!d.customers.length && !d.entries.length) {
      out.textContent = "No customers or entries found. " + (res.warnings[0] || "Check the format.");
      return;
    }
    store = { shop: d.shop || "", upi: d.upi || "", customers: d.customers, entries: d.entries };
    if (!persist()) return;
    if (location.hash && location.hash !== "#/") location.hash = "#/";
    render();
    out.textContent = "Imported " + d.customers.length + " customers and " + d.entries.length + " entries." +
      (res.warnings.length ? " " + res.warnings.length + " row(s) skipped: " + res.warnings.slice(0, 3).join(" ") : "");
    box.value = "";
  }

  function exportCSV() {
    var csv = "\ufeff" + L.toCSV(store);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hisaab.csv";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function openSettings() {
    el("set-shop").value = store.shop || "";
    el("set-upi").value = store.upi || "";
    el("settings-view").hidden = false;
    el("settings-view").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function saveSettings() {
    store.shop = el("set-shop").value.trim();
    store.upi = el("set-upi").value.trim();
    persist(); el("settings-view").hidden = true; render();
  }

  /* ---------- wiring ---------- */
  function wire() {
    el("btn-add-customer").addEventListener("click", openCustomer);
    el("cust-save").addEventListener("click", saveCustomer);
    el("cust-close").addEventListener("click", closeCustomer);
    el("cust-cancel").addEventListener("click", closeCustomer);

    el("btn-add-entry").addEventListener("click", function () { openEntry(detailPhone || ""); });
    el("entry-save").addEventListener("click", saveEntry);
    el("entry-close").addEventListener("click", closeEntry);
    el("entry-cancel").addEventListener("click", closeEntry);
    el("detail-add-entry").addEventListener("click", function () { openEntry(el("detail-add-entry").getAttribute("data-phone") || detailPhone || ""); });

    el("shot-input").addEventListener("change", function () {
      var f = el("shot-input").files && el("shot-input").files[0];
      if (!f) { el("shot-preview").innerHTML = ""; return; }
      readImage(f, function (src) {
        if (src) { pendingShot = src; el("shot-preview").innerHTML = '<img src="' + esc(src) + '" alt="Selected screenshot" />'; }
      });
    });

    el("btn-import").addEventListener("click", openImport);
    el("import-go").addEventListener("click", doImport);
    el("btn-export").addEventListener("click", exportCSV);
    el("btn-settings").addEventListener("click", openSettings);
    el("settings-save").addEventListener("click", saveSettings);
    el("settings-close").addEventListener("click", function () { el("settings-view").hidden = true; });

    el("search").addEventListener("input", renderList);
    el("lang").addEventListener("change", function () {
      lang = el("lang").value;
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
      applyLang(); render();
    });

    el("detail-entries").addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
      if (!b) return;
      var id = b.getAttribute("data-id");
      if (b.getAttribute("data-act") === "del") { deleteEntry(id); return; }
      if (b.getAttribute("data-act") === "edit") {
        var entry = store.entries.filter(function (x) { return x.id === id; })[0];
        if (entry) openEntry(entry.phone, entry);
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll(".overlay"), function (o) {
      o.addEventListener("click", function (e) { if (e.target === o) o.hidden = true; });
    });

    window.addEventListener("hashchange", route);
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeCustomer(); closeEntry(); }
    });
  }

  load();
  applyLang();
  wire();
  render();
})();
