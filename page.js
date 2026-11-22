// Shared subpage behavior: each screen gets its number nav and contact
// footer, built from the sections' data-label names; navs jump smoothly.
(function () {
  var screens = Array.prototype.slice.call(document.querySelectorAll("main > section"));
  // A screen with panel switches returns to its first panel from its own number.
  screens.forEach(function (s) {
    var nav = document.createElement("nav");
    nav.className = "screen-nav";
    nav.setAttribute("aria-label", "Screens");
    screens.forEach(function (t, i) {
      var radio = t === s && s.querySelector("input[type=radio]");
      var item = document.createElement(radio ? "label" : "a");
      if (radio) item.htmlFor = radio.id; else item.href = "#" + t.id;
      if (t === s) { item.className = "on"; item.setAttribute("aria-current", "location"); }
      item.setAttribute("aria-label", t.getAttribute("data-label"));
      item.innerHTML = "<span>" + (i + 1) + "</span>";
      nav.appendChild(item);
    });
    var first = s.firstElementChild;
    while (first && first.tagName === "INPUT") first = first.nextElementSibling;
    s.insertBefore(nav, first);
  });
  var contacts = [["btc", "bitcoin:bc1quy7kfzh6hvdmysdr5x2znqld4y5rql62622epg"], ["email", "mailto:lplvlql@aol.com"],
    ["github", "https://github.com/lplvlql"], ["patreon"]];
  screens.forEach(function (s) {
    var foot = document.createElement("nav");
    foot.className = "contact";
    foot.setAttribute("aria-label", "Contact");
    contacts.forEach(function (entry) {
      var link = document.createElement(entry[1] ? "a" : "span");
      if (entry[1]) link.href = entry[1];
      link.textContent = entry[0];
      foot.appendChild(link);
    });
    s.appendChild(foot);
  });
  var scroller = document.querySelector("body.nest main");
  var motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  function goTo(target) {
    if (!target) return;
    target.scrollIntoView({ behavior: motion, block: "start" });
  }
  Array.prototype.forEach.call(document.querySelectorAll("nav.screen-nav a, .content a[href^=\"#\"]"), function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      if (link.classList.contains("on")) return;
      goTo(document.querySelector(link.getAttribute("href")));
    });
  });
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (scroller) scroller.scrollTop = 0;
})();
