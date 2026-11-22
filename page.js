// Shared subpage behavior: one row of screen numbers and one of contact links,
// built from the sections' data-label names; numbers jump smoothly.
(function () {
  var screens = document.querySelectorAll("main > section");
  var contacts = [["btc", "bitcoin:bc1quy7kfzh6hvdmysdr5x2znqld4y5rql62622epg"], ["email", "mailto:lplvlql@aol.com"],
    ["github", "https://github.com/lplvlql"], ["patreon"]];
  function bar(name, label) {
    var nav = document.createElement("nav");
    nav.className = name;
    nav.setAttribute("aria-label", label);
    return nav;
  }
  var nav = bar("screen-nav", "Screens"), foot = bar("contact", "Contact");
  screens.forEach(function (s, i) {
    var link = document.createElement("a");
    link.href = "#" + s.id;
    link.setAttribute("aria-label", s.dataset.label);
    link.textContent = i + 1;
    nav.appendChild(link);
  });
  contacts.forEach(function (entry) {
    var link = document.createElement(entry[1] ? "a" : "span");
    if (entry[1]) link.href = entry[1];
    link.textContent = entry[0];
    foot.appendChild(link);
  });
  document.querySelector("main").before(nav);
  document.querySelector("main").after(foot);
  // The current screen is the last one to reach the middle of the window.
  function mark() {
    var current = 0;
    screens.forEach(function (s, i) { if (s.getBoundingClientRect().top <= innerHeight / 2) current = i; });
    nav.childNodes.forEach(function (link, i) {
      if (i === current) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
    });
  }
  addEventListener("scroll", mark);
  mark();
  var motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  document.querySelectorAll('.screen-nav a, main a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var target = document.querySelector(link.hash);
      // The current number returns a screen with panel switches to its first panel.
      var radio = link.hasAttribute("aria-current") && target.querySelector("input[type=radio]");
      if (radio) radio.checked = true;
      target.scrollIntoView({ behavior: motion });
    });
  });
})();
