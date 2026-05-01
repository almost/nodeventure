(function () {
  'use strict';

  // Always start kiosk pages locked: clear any edit cookie that survived
  // a previous session, so an auto-reload also relocks after the TTL.
  document.cookie = 'editToken=; max-age=0; path=/';

  var IDLE_MS = 60 * 1000;
  var welcome = document.getElementById('kiosk-welcome');
  var idleTimer = null;

  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      location.reload();
    }, IDLE_MS);
  }

  function welcomeVisible() {
    return welcome && !welcome.classList.contains('hidden');
  }

  function dismissWelcome(e) {
    if (!welcomeVisible()) return;
    welcome.classList.add('hidden');
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    var nameInput = document.getElementById('name-input');
    if (nameInput && nameInput.offsetParent !== null) {
      setTimeout(function () { nameInput.focus(); nameInput.select(); }, 0);
    }
  }

  document.addEventListener('keydown', function (e) {
    resetIdle();
    if (welcomeVisible()) dismissWelcome(e);
  }, true);

  document.addEventListener('mousedown', function (e) {
    resetIdle();
    if (welcomeVisible()) dismissWelcome(e);
  }, true);

  document.addEventListener('touchstart', function (e) {
    resetIdle();
    if (welcomeVisible()) dismissWelcome(e);
  }, true);

  document.addEventListener('mousemove', resetIdle);

  resetIdle();
})();
