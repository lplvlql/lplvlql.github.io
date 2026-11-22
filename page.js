// Shared subpage behavior: each screen gets its number nav and contact
// footer, built from the sections' data-label names; navs jump smoothly.
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
  screens.forEach(function (s) {
    var nav = bar("screen-nav", "Screens"), foot = bar("contact", "Contact");
    screens.forEach(function (t, i) {
      // A screen with panel switches returns to its first panel from its own number.
      var radio = t === s && s.querySelector("input[type=radio]");
      var item = document.createElement(radio ? "label" : "a");
      if (radio) item.htmlFor = radio.id; else item.href = "#" + t.id;
      if (t === s) { item.className = "on"; item.setAttribute("aria-current", "location"); }
      item.setAttribute("aria-label", t.dataset.label);
      item.innerHTML = "<span>" + (i + 1) + "</span>";
      nav.appendChild(item);
    });
    contacts.forEach(function (entry) {
      var link = document.createElement(entry[1] ? "a" : "span");
      if (entry[1]) link.href = entry[1];
      link.textContent = entry[0];
      foot.appendChild(link);
    });
    s.prepend(nav);
    s.append(foot);
  });
  var motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  document.querySelectorAll('main a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      if (!link.classList.contains("on")) document.querySelector(link.hash).scrollIntoView({ behavior: motion });
    });
  });
})();
