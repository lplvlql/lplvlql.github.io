// Hub index filter + footer year. No motion, no tracking.
(function () {
  var year = document.getElementById("year");
  if (year) year.textContent = "© " + new Date().getFullYear();

  var input = document.getElementById("filter");
  var body = document.getElementById("index-body");
  if (!input || !body) return;

  var noMatch = document.getElementById("no-match");
  var clear = document.getElementById("clear-filter");
  var rows = Array.prototype.slice.call(body.querySelectorAll("tr"));

  function apply() {
    var q = input.value.trim().toLowerCase();
    var visible = 0;
    rows.forEach(function (row) {
      var hay = (row.textContent + " " + (row.getAttribute("data-tags") || "")).toLowerCase();
      var show = !q || hay.indexOf(q) !== -1;
      row.hidden = !show;
      if (show) visible++;
    });
    if (noMatch) noMatch.hidden = visible !== 0;
  }

  input.addEventListener("input", apply);
  if (clear) clear.addEventListener("click", function () {
    input.value = "";
    apply();
    input.focus();
  });
})();
