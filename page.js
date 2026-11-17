// Shared subpage behavior: the scroll arrow fades once the page leaves the hero.
(function () {
  var a = document.querySelector(".scroll-arrow");
  if (!a) return;
  function f() {
    var h = window.innerHeight || 1;
    a.classList.toggle("gone", (window.scrollY || 0) > h * 0.25);
  }
  window.addEventListener("scroll", f, { passive: true });
  f();
})();
