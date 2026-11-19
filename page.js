// Shared subpage behavior: the static number navs jump smoothly and
// track whichever screen is showing. Scrolling itself is native.
(function () {
  var screens = Array.prototype.slice.call(document.querySelectorAll("main > section"));
  var contacts = [["btc", "bitcoin:bc1quy7kfzh6hvdmysdr5x2znqld4y5rql62622epg"], ["email", "mailto:lplvlql@aol.com"],
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
  var scroller = document.querySelector("body.nest main");
  var motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  function sy() {
    return scroller ? scroller.scrollTop : (window.scrollY || 0);
  }
  function sh() {
    return scroller ? scroller.clientHeight : (window.innerHeight || 1);
  }
  var navs = Array.prototype.slice.call(document.querySelectorAll("nav.screen-nav"));
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
  function spy() {
    var y = sy() + sh() / 2;
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
  (scroller || window).addEventListener("scroll", spy, { passive: true });
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (scroller) scroller.scrollTop = 0;
  spy();
})();
// EDS sub-panels exit back to the roadmap once the section leaves view.
(function () {
  var scroller = document.querySelector("body.nest main");
  var eds = document.getElementById("eds");
  var home = document.getElementById("eds-show-main");
  if (!scroller || !eds || !home) return;
  scroller.addEventListener("scroll", function () {
    if (home.checked) return;
    var top = scroller.scrollTop;
    var bottom = eds.offsetTop + eds.offsetHeight - scroller.clientHeight;
    if (top < eds.offsetTop || top > bottom) home.checked = true;
  }, { passive: true });
})();
