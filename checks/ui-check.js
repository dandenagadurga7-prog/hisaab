/* Hisaab - real-browser check (Chrome via puppeteer-core). Node only. */
var http = require("http");
var fs = require("fs");
var path = require("path");
var puppeteer = require("puppeteer-core");

var ROOT = path.join(__dirname, "..");
var PORT = 4180;
var BASE = process.env.HISAAB_URL || ("http://127.0.0.1:" + PORT + "/");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var failures = [];
var TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png" };

function check(ok, label, detail) {
  if (ok) console.log("  ok  " + label);
  else { failures.push(label + (detail ? " - " + detail : "")); console.log("  FAIL " + label + (detail ? " - " + detail : "")); }
}

var server = http.createServer(function (req, res) {
  var u = decodeURIComponent(String(req.url || "/").split("?")[0]);
  if (u === "/") u = "/index.html";
  var f = path.join(ROOT, u);
  if (f.indexOf(ROOT) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; res.end("not found"); return; }
  res.setHeader("Content-Type", TYPES[path.extname(f)] || "application/octet-stream");
  res.end(fs.readFileSync(f));
});

(async function () {
  if (!process.env.HISAAB_URL) await new Promise(function (r) { server.listen(PORT, "127.0.0.1", r); });
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  var page = await browser.newPage();
  var pageErrors = [];
  page.on("console", function (m) { if (m.type() === "error") pageErrors.push(m.text()); });
  page.on("pageerror", function (e) { pageErrors.push(String(e && e.message || e)); });
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 });

  await page.goto(BASE + "?today=2026-11-15", { waitUntil: "networkidle0" });

  console.log("\nHome / required selectors");
  check(await page.$eval("#total-outstanding", function (el) { return !!el; }), "#total-outstanding exists");
  check(await page.$eval("#import-box", function (el) { return el.offsetParent !== null; }), "#import-box is visible");
  check(await page.$eval("#import-go", function (el) { return !!el; }), "#import-go exists");
  check(await page.$eval("#shot-input", function (el) { return el.type === "file"; }), "#shot-input is a file input");
  var scroll375 = await page.$eval("html", function (el) { return el.scrollWidth; });
  check(scroll375 <= 375, "no sideways scroll at 375px", "scrollWidth=" + scroll375);

  console.log("\nImport the sample shop");
  var sample = fs.readFileSync(path.join(ROOT, "sample-data.json"), "utf8");
  await page.$eval("#import-box", function (el, v) { el.value = v; }, sample);
  await page.click("#import-go");
  await page.waitForSelector('[data-customer="9876543210"]', { timeout: 5000 });
  var totalText = await page.$eval("#total-outstanding", function (el) { return el.textContent; });
  check(/11[,.]?820/.test(totalText.replace(/\s/g, "")), "#total-outstanding shows 11820", totalText);
  var rows = await page.$$eval("[data-customer]", function (els) { return els.length; });
  check(rows === 5, "one row per customer (5)", "rows=" + rows);
  var values = await page.$$eval("[data-customer]", function (els) {
    var out = {};
    els.forEach(function (el) {
      var b = el.querySelector("[data-balance]");
      out[el.getAttribute("data-customer")] = b ? Number(String(b.textContent).replace(/[^0-9.-]/g, "")) : null;
    });
    return out;
  });
  check(values["9876543210"] === 3000 && values["9000012345"] === 2500, "balances match the sample", JSON.stringify(values));
  var href = await page.$eval('a[data-remind="9876543210"]', function (a) { return a.getAttribute("href"); });
  check(href && href.indexOf("https://wa.me/919876543210?text=") === 0, "WhatsApp reminder href", href && href.slice(0, 60));
  var firstOverdue = await page.$eval("#overdue-list .overdue-item", function (el) { return el.textContent; });
  check(/Anil/.test(firstOverdue), "overdue first is the customer with no payment", firstOverdue.replace(/\s+/g, " ").trim());
  fs.mkdirSync(path.join(ROOT, "shots"), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, "shots", "home-375.png"), fullPage: true });

  console.log("\nCustomer page, payment screenshot, edit/delete");
  await page.goto(BASE + "?today=2026-11-15#/customer/9876543210", { waitUntil: "networkidle0" });
  await page.waitForSelector("#detail-view:not([hidden])");
  var before = await page.$eval("#detail-balance", function (el) { return Number(el.getAttribute("data-amount")); });
  check(before === 3000, "detail balance starts at 3000", String(before));
  await page.click("#detail-add-entry");
  await page.waitForSelector("#entry-overlay:not([hidden])");
  await page.click('input[name="entry-type"][value="payment"]');
  await page.$eval("#entry-amount", function (el) { el.value = "100"; });
  await page.$eval("#entry-date", function (el) { el.value = "2026-11-15"; });
  await page.$eval("#entry-note", function (el) { el.value = "Test payment"; });
  var fileInput = await page.$("#shot-input");
  await fileInput.uploadFile(path.join(__dirname, "tiny.png"));
  await page.click("#entry-save");
  await page.waitForSelector("img[data-shot]", { timeout: 8000 });
  var after = await page.$eval("#detail-balance", function (el) { return Number(el.getAttribute("data-amount")); });
  check(after === 2900, "payment recalculates balance to 2900", String(after));
  check(await page.$$eval("img[data-shot]", function (els) { return els.length; }) >= 1, "payment entry shows img[data-shot]");
  await page.screenshot({ path: path.join(ROOT, "shots", "detail-375.png"), fullPage: true });

  var entryId = await page.$eval(".entry[data-entry]", function (el) { return el.getAttribute("data-entry"); });
  await page.click('.entry[data-entry="' + entryId + '"] [data-act="edit"]');
  await page.waitForSelector("#entry-overlay:not([hidden])");
  await page.$eval("#entry-amount", function (el) { el.value = "150"; });
  await page.click("#entry-save");
  await page.waitForFunction(function () { return document.getElementById("detail-balance").getAttribute("data-amount") === "2850"; }, { timeout: 5000 });
  check(true, "edit recalculates balance to 2850");
  await page.click('.entry[data-entry="' + entryId + '"] [data-act="del"]');
  await page.waitForFunction(function () { return document.getElementById("detail-balance").getAttribute("data-amount") === "3000"; }, { timeout: 5000 });
  check(true, "delete recalculates balance back to 3000");

  console.log("\nSearch, language, wide screen");
  await page.goto(BASE + "?today=2026-11-15", { waitUntil: "networkidle0" });
  await page.$eval("#search", function (el) { el.value = "Ravi"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await new Promise(function (r) { setTimeout(r, 150); });
  var filtered = await page.$$eval("[data-customer]", function (els) { return els.length; });
  check(filtered === 1, "search filters to one customer", "rows=" + filtered);
  await page.select("#lang", "te");
  await new Promise(function (r) { setTimeout(r, 150); });
  var langState = await page.evaluate(function () {
    var btn = document.getElementById("btn-add-customer");
    return { lang: document.documentElement.lang, label: btn ? btn.textContent : "" };
  });
  check(langState.lang === "te" && langState.label.indexOf("+ Customer") < 0 && /[^\x00-\x7F]/.test(langState.label), "Telugu labels apply", JSON.stringify(langState));
  await page.select("#lang", "en");
  await page.$eval("#search", function (el) { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await new Promise(function (r) { setTimeout(r, 150); });
  await page.screenshot({ path: path.join(ROOT, "shots", "home-1440.png"), fullPage: true });
  var scroll1440 = await page.$eval("html", function (el) { return el.scrollWidth; });
  check(scroll1440 <= 1440, "no sideways scroll at 1440px", "scrollWidth=" + scroll1440);

  check(pageErrors.length === 0, "no console/page errors", pageErrors.slice(0, 3).join(" | "));

  await browser.close();
  if (!process.env.HISAAB_URL) await new Promise(function (r) { server.close(r); });

  console.log("");
  if (failures.length) { console.error("FAILURES:\n - " + failures.join("\n - ")); process.exit(1); }
  console.log("Hisaab UI: ok");
})().catch(function (e) { console.error("CHECK ERROR:", e && e.stack || e); try { server.close(); } catch (x) {} process.exit(1); });
