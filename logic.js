/* Hisaab — pure data helpers (browser + Node). No DOM, no AI. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HisaabLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function toDigits(v) { return String(v == null ? "" : v).replace(/\D/g, ""); }

  function normalizePhone(v) {
    var d = toDigits(v);
    if (d.length === 12 && d.slice(0, 2) === "91") d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    if (d.length > 10) d = d.slice(-10);
    return d.length === 10 ? d : "";
  }

  function parseAmount(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    var s = String(v == null ? "" : v).replace(/[^0-9.\-]/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function iso(y, m, d) {
    if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
    return y + "-" + pad(m) + "-" + pad(d);
  }

  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function parseDate(v, fallback) {
    if (!v) return fallback || "";
    if (v instanceof Date) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    var s = String(v).trim();
    var m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return iso(+m[1], +m[2], +m[3]) || fallback || "";
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) { var y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2], +m[1]) || fallback || ""; }
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})/);
    if (m) { var mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; var yy = +m[3]; if (yy < 100) yy += 2000; if (mo) return iso(yy, mo, +m[1]) || fallback || ""; }
    m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{2,4})/);
    if (m) { var mo2 = MONTHS[m[1].slice(0, 3).toLowerCase()]; var y2 = +m[3]; if (y2 < 100) y2 += 2000; if (mo2) return iso(y2, mo2, +m[2]) || fallback || ""; }
    return fallback || "";
  }

  function normalizeType(v) {
    var s = String(v == null ? "" : v).toLowerCase().trim();
    if (/pay|paid|jama|received|receive|credit\s*back|refund/.test(s)) return "payment";
    if (/credit|udhaar|udhar|debit|gave|give|goods|sold|sale|baki|due/.test(s)) return "credit";
    return "";
  }

  function uid(prefix, n) { return prefix + String(n); }

  /* Accepts the sample shape { shop, customers[], entries[] } and common variants:
     customers[].entries[], a bare array of customers, a bare array of entries,
     entries keyed by customer name, "mobile"/"kind"/"remarks" aliases. */
  function normalize(raw, options) {
    var today = (options && options.today) || "";
    var warnings = [];
    var shop = "";
    var upi = "";
    var customers = [];
    var entries = [];
    var byPhone = {};
    var byName = {};

    function addCustomer(name, phone) {
      name = String(name == null ? "" : name).trim();
      var p = normalizePhone(phone);
      if (!name || !p) return null;
      if (byPhone[p]) { if (!byPhone[p].name && name) byPhone[p].name = name; return byPhone[p]; }
      var c = { id: uid("c", customers.length + 1), name: name, phone: p };
      byPhone[p] = c;
      byName[name.toLowerCase()] = c;
      customers.push(c);
      return c;
    }

    var rootObj = raw;
    if (Array.isArray(rootObj)) {
      var looksLikeCustomers = rootObj.some(function (x) { return x && (x.entries || x.ledger || x.transactions); });
      rootObj = looksLikeCustomers ? { customers: rootObj } : { entries: rootObj };
    }
    if (!rootObj || typeof rootObj !== "object") {
      return { data: { shop: "", upi: "", customers: [], entries: [] }, warnings: ["That is not a JSON object or array."] };
    }

    shop = String(rootObj.shop || rootObj.shopName || rootObj.business || rootObj.store || "").trim();
    upi = String(rootObj.upi || rootObj.upiId || rootObj.upi_id || "").trim();

    var custList = rootObj.customers || rootObj.parties || rootObj.accounts || [];
    if (!Array.isArray(custList) && custList && typeof custList === "object") {
      custList = Object.keys(custList).map(function (k) {
        var v = custList[k];
        if (v && typeof v === "object") { if (!v.phone && !v.mobile) v.phone = k; return v; }
        return { name: k, phone: k };
      });
    }
    (Array.isArray(custList) ? custList : []).forEach(function (c) {
      if (!c || typeof c !== "object") return;
      var name = c.name || c.customerName || c.customer || c.fullName || c.title;
      var phone = c.phone || c.mobile || c.phoneNumber || c.mobileNumber || c.contact;
      var cust = addCustomer(name, phone);
      var list = c.entries || c.ledger || c.transactions || c.records || [];
      if (cust && Array.isArray(list)) {
        list.forEach(function (e) { if (e && typeof e === "object") { e.__cust = cust; entries.push(e); } });
      }
    });

    var entryList = rootObj.entries || rootObj.ledger || rootObj.transactions || rootObj.records || [];
    if (Array.isArray(entryList)) entryList.forEach(function (e) { if (e && typeof e === "object") entries.push(e); });

    var out = [];
    entries.forEach(function (e, i) {
      var phone = normalizePhone(e.phone || e.mobile || e.customerPhone || e.customer_phone || e.phoneNumber || e.contact);
      var cust = e.__cust || (phone ? byPhone[phone] : null);
      if (!cust) {
        var nm = e.customer || e.customerName || e.name || e.party || e.account || e.customer_name;
        if (nm && byName[String(nm).toLowerCase()]) cust = byName[String(nm).toLowerCase()];
        else if (nm && phone) cust = addCustomer(nm, phone);
      }
      if (!cust) { warnings.push("Entry " + (i + 1) + " skipped: no valid customer/phone."); return; }
      var type = normalizeType(e.type || e.kind || e.entryType || e.transactionType || e.mode || e.status);
      if (!type) { warnings.push("Entry " + (i + 1) + " skipped: type is not credit or payment."); return; }
      var amount = parseAmount(e.amount != null ? e.amount : (e.value != null ? e.value : e.total));
      if (!(amount > 0)) { warnings.push("Entry " + (i + 1) + " skipped: amount is not positive."); return; }
      var date = parseDate(e.date || e.entryDate || e.createdAt || e.on || e.created_at, today || "1970-01-01");
      var note = String(e.note || e.remarks || e.description || e.detail || e.purpose || "").trim();
      var shot = e.shot || e.screenshot || e.image || e.receipt || "";
      out.push({
        id: uid("e", out.length + 1),
        phone: cust.phone,
        type: type,
        amount: Math.round(amount * 100) / 100,
        date: date,
        note: note,
        shot: typeof shot === "string" ? shot : ""
      });
    });

    out.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    return { data: { shop: shop, upi: upi, customers: customers, entries: out }, warnings: warnings };
  }

  function balances(data) {
    var m = {};
    (data.customers || []).forEach(function (c) { m[c.phone] = 0; });
    (data.entries || []).forEach(function (e) {
      m[e.phone] = (m[e.phone] || 0) + (e.type === "credit" ? e.amount : -e.amount);
    });
    return m;
  }

  function balanceOf(data, phone) {
    var b = 0;
    (data.entries || []).forEach(function (e) {
      if (e.phone === phone) b += (e.type === "credit" ? e.amount : -e.amount);
    });
    return Math.round(b * 100) / 100;
  }

  function totalOutstanding(data) {
    var t = 0;
    (data.entries || []).forEach(function (e) { t += (e.type === "credit" ? e.amount : -e.amount); });
    return Math.round(t * 100) / 100;
  }

  function lastPaymentDate(data, phone) {
    var d = "";
    (data.entries || []).forEach(function (e) {
      if (e.phone === phone && e.type === "payment" && e.date > d) d = e.date;
    });
    return d;
  }

  function daysBetween(fromISO, toISO) {
    if (!fromISO || !toISO) return null;
    var a = Date.parse(fromISO + "T00:00:00Z");
    var b = Date.parse(toISO + "T00:00:00Z");
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  function overdue(data, todayISO) {
    var today = todayISO || "";
    return (data.customers || []).map(function (c) {
      var bal = balanceOf(data, c.phone);
      var lp = lastPaymentDate(data, c.phone);
      var days = lp ? daysBetween(lp, today) : null;
      return { customer: c, balance: bal, lastPayment: lp, daysSince: days };
    }).filter(function (x) { return x.balance > 0; })
      .sort(function (a, b) {
        var da = a.daysSince == null ? 999999 : a.daysSince;
        var db = b.daysSince == null ? 999999 : b.daysSince;
        if (db !== da) return db - da;
        return b.balance - a.balance;
      });
  }

  function formatRs(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    v = Math.round(v * 100) / 100;
    var neg = v < 0;
    v = Math.abs(v);
    var s;
    try { s = v.toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
    catch (e) { s = String(v); }
    return (neg ? "-" : "") + "Rs " + s;
  }

  function upiLink(upi, shop, name, amount) {
    if (!upi || !(amount > 0)) return "";
    return "upi://pay?pa=" + encodeURIComponent(upi) +
      "&pn=" + encodeURIComponent(shop || "Shop") +
      "&am=" + encodeURIComponent(String(Math.round(amount * 100) / 100)) +
      "&cu=INR&tn=" + encodeURIComponent(name || "Balance");
  }

  function reminderMessage(customer, balance, shop, upi, lang) {
    var name = customer.name || "Customer";
    var store = shop || "our shop";
    var amt = formatRs(balance);
    var msg;
    if (lang === "te") msg = "నమస్తే " + name + ", " + store + " లో మీ బాకీ " + amt + ". సౌకర్యంగా ఉన్నప్పుడు చెల్లించండి.";
    else if (lang === "hi") msg = "नमस्ते " + name + ", " + store + " में आपका बाकी " + amt + " है। सुविधा हो तो भुगतान कर दें।";
    else msg = "Hello " + name + ", your balance at " + store + " is " + amt + ". Please pay when convenient.";
    var u = upiLink(upi, store, name, balance);
    if (u) msg += " UPI: " + u;
    return msg;
  }

  function reminderHref(customer, balance, shop, upi, lang) {
    return "https://wa.me/91" + customer.phone + "?text=" + encodeURIComponent(reminderMessage(customer, balance, shop, upi, lang));
  }

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(data) {
    var byPhone = {};
    (data.customers || []).forEach(function (c) { byPhone[c.phone] = c; });
    var rows = [["Customer", "Phone", "Type", "Amount (Rs)", "Date", "Note"]];
    (data.entries || []).slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).forEach(function (e) {
      var c = byPhone[e.phone];
      rows.push([c ? c.name : "", e.phone, e.type, e.amount, e.date, e.note || ""]);
    });
    return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
  }

  return {
    toDigits: toDigits,
    normalizePhone: normalizePhone,
    parseAmount: parseAmount,
    parseDate: parseDate,
    normalizeType: normalizeType,
    normalize: normalize,
    balances: balances,
    balanceOf: balanceOf,
    totalOutstanding: totalOutstanding,
    lastPaymentDate: lastPaymentDate,
    daysBetween: daysBetween,
    overdue: overdue,
    formatRs: formatRs,
    upiLink: upiLink,
    reminderMessage: reminderMessage,
    reminderHref: reminderHref,
    toCSV: toCSV
  };
});
