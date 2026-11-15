/* Hisaab — logic checks against the sample shop. Node only. */
var fs = require("fs");
var path = require("path");
var L = require(path.join(__dirname, "..", "logic.js"));
var raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sample-data.json"), "utf8"));
var expected = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sample-expected.json"), "utf8"));
var today = "2026-11-15";
var failures = [];

var res = L.normalize(raw, { today: today });
var d = res.data;
if (d.customers.length !== expected.customers) failures.push("customers: expected " + expected.customers + " got " + d.customers.length);
if (d.entries.length !== expected.entries) failures.push("entries: expected " + expected.entries + " got " + d.entries.length);
var total = L.totalOutstanding(d);
if (total !== expected.totalOutstanding) failures.push("total: expected " + expected.totalOutstanding + " got " + total);
Object.keys(expected.balances).forEach(function (phone) {
  var got = L.balanceOf(d, phone);
  if (got !== expected.balances[phone]) failures.push("balance " + phone + ": expected " + expected.balances[phone] + " got " + got);
});
var od = L.overdue(d, today);
if (!od.length || od[0].customer.name !== expected.overdueFirst) failures.push("overdue first: expected " + expected.overdueFirst + " got " + (od[0] && od[0].customer.name));
var c = d.customers[0];
var href = L.reminderHref(c, L.balanceOf(d, c.phone), d.shop, d.upi, "en");
if (href.indexOf("https://wa.me/91" + c.phone + "?text=") !== 0) failures.push("reminder href prefix wrong: " + href.slice(0, 60));
var msg = decodeURIComponent(href.split("?text=")[1] || "");
if (msg.indexOf(c.name) < 0 || msg.indexOf("Rs") < 0) failures.push("reminder message missing name/amount");
var csv = L.toCSV(d);
if (csv.split("\r\n").length !== d.entries.length + 1) failures.push("csv rows wrong");

/* import variants */
var v1 = L.normalize({ customers: [{ name: "A", phone: "9876543210", entries: [{ type: "credit", amount: "1,200", date: "01/11/2026" }] }] });
if (v1.data.entries.length !== 1 || v1.data.entries[0].amount !== 1200 || v1.data.entries[0].date !== "2026-11-01") failures.push("nested customer entries not normalized");
var v2 = L.normalize([{ customer: "B", mobile: "9123456780", kind: "paid", value: "500", date: "5 Nov 2026" }]);
if (v2.data.customers.length !== 1 || v2.data.entries[0].type !== "payment") failures.push("flat entry array not normalized");

if (failures.length) {
  console.error("FAILURES:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log("Hisaab logic: ok");
console.log("  customers=" + d.customers.length + " entries=" + d.entries.length + " total=Rs " + total);
console.log("  overdue first=" + od[0].customer.name + " (" + od[0].balance + ")");
console.log("  reminder=" + href.slice(0, 52) + "…");
