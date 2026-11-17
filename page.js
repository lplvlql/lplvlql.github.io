// Shared subpage behavior: the static number navs jump smoothly and
// track whichever screen is showing. Scrolling itself is native.
(function () {
  var screens = Array.prototype.slice.call(document.querySelectorAll("main > section"));
  var contacts = [["btc", "bitcoin:you"], ["email", "mailto:you@example.com"],
    ["github", "https://github.com/lplvlql"], ["patreon", "https://www.patreon.com/you"]];
  screens.forEach(function (s) {
    var foot = document.createElement("nav");
    foot.className = "contact";
    foot.setAttribute("aria-label", "Contact");
    contacts.forEach(function (entry) {
      var link = document.createElement("a");
      link.href = entry[1];
      link.textContent = entry[0];
      foot.appendChild(link);
    });
    s.appendChild(foot);
  });
  var navs = Array.prototype.slice.call(document.querySelectorAll("nav.screen-nav"));
  navs.forEach(function (nav) {
    Array.prototype.forEach.call(nav.children, function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (link.classList.contains("on")) return;
        var target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  });
  function spy() {
    var y = (window.scrollY || 0) + (window.innerHeight || 1) / 2;
    var on = 0;
    screens.forEach(function (s, i) {
      if (s.offsetTop <= y) on = i;
    });
    navs.forEach(function (nav) {
      Array.prototype.forEach.call(nav.children, function (link, i) {
        link.classList.toggle("on", i === on);
      });
    });
  }
  window.addEventListener("scroll", spy, { passive: true });
  spy();
})();
