/*
 * Nodeventure client JS
 */

/*global io */
(function () {
  "use strict";
  
  var
  socket = io.connect(location.origin),
  lineFeed = [],
  inputPress = 0,

  // dividers
  dividerTimeout = null,
  dividerTime = 2000,
  divider = "---";


  // function to add new text to the page
  function addLine(string, opts) {
    if (!opts) opts = {};
    var line = $('<pre>');
    if(opts.cls) line.addClass(opts.cls);

    if (opts.html) {
      line.html(string);
    } else {
      line.text(string);
    }
    $('#output').append(line);
    $('#output').animate({scrollTop: $("#output")[0].scrollHeight}, 'slow');
  }


  // add divider
  function dividerMessage() {
    addLine(divider);
  }

  // Start countdown to add divider
  function dividerMessageTrigger() {
    dividerTimeout = setTimeout(dividerMessage, dividerTime);
  }


  // set up sockets
  function hasEditToken() {
    return /(?:^|;\s*)editToken=/.test(document.cookie);
  }
  function revealEditLink() {
    $('#edit-link').removeAttr('hidden');
  }
  if (hasEditToken()) revealEditLink();

  socket.on('unlock', function (data) {
    if (!data || !data.token) return;
    var maxAge = data.ttlSec || 43200;
    document.cookie = 'editToken=' + encodeURIComponent(data.token)
      + '; max-age=' + maxAge + '; path=/; samesite=lax';
    revealEditLink();
  });

  socket.on('write', function (message) {
    if (message.string) {
      addLine(message.string);
    }

    if (message.html) {
      addLine(message.html,{ html: true });
    }

    if (message.effect) {
      window[message.effect]();
    }

    if (message.display) {
      window.display[message.display.command].apply(window.display, message.display.arguments || []);
    }

    if (message.error) {
      addLine(message.error.string, { cls: message.error.type||"warn"});
      console.log(message.error.string);
    }

    if (message.lights) {
      setHeaderColor(message.lights.color, message.lights.fadeMs);
    }
  });

  function setHeaderColor(rgb, fadeMs) {
    if (!rgb || rgb.length < 3) return;
    var $header = $('header');
    var ms = (typeof fadeMs === 'number' && fadeMs > 0) ? fadeMs : 0;
    var transition = ms > 0 ? ('background-color ' + ms + 'ms linear') : 'none';
    $header.css({
      'transition': transition,
      '-webkit-transition': transition,
      'background-color': 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'
    });
  }

  var currentUsername = null;
  socket.on('disconnect', function () {
    addLine('DISCONNECTED!');
    if (currentUsername) connect(currentUsername);
  });


  // function to send data
  function sendCommand() {
    var theCommand = $('#command').val();
    addLine(theCommand, {cls:"user"});
    socket.emit('command', theCommand);
    $('#command').val('').focus();

    lineFeed.unshift(theCommand);

    if (lineFeed.length === 50) {
      lineFeed.pop();
    }

    $('#output').animate({scrollTop: $("#output")[0].scrollHeight}, 'slow');

    // divider...
    clearTimeout(dividerTimeout);
    dividerMessageTrigger();
  }


  // function to deal with key up and down line feed
  function recallCommand() {
    var lastCommand = lineFeed[inputPress];
    $('#command').val(lastCommand);

    if (inputPress < 0) {
      inputPress = 0;
    }

    if (inputPress > lineFeed.length) {
      inputPress = lineFeed.length;
    }
  }


  // command form submit
  $('#send').click(sendCommand);
  $('#command').keyup(function (e) {
    if (e.keyCode === 13) {
      inputPress = 0;
      sendCommand();
    }
  });
  $('#command').keyup(function (e) {
    if (e.keyCode === 38) {
      recallCommand();
      inputPress++;
    }
  });
  $('#command').keyup(function (e) {
    if (e.keyCode === 40) {
      recallCommand();
      inputPress--;
    }
  });


  // init the page on load
  function init() {
    var welcome, $line, counter, length;
    welcome = '              _                 _       \n _ _  ___  __| |_____ _____ _ _| |_ _  _ _ _ ___ \n| \' \\/ _ \\/ _` / -_) V / -_) \' \\  _| || | \'_/ -_)\n|_||_\\___/\\__,_\\___|\\_/\\___|_||_\\__|\\_,_|_| \\___|';
    $line = $('<pre id="welcome">');
    $('#output').append($line);

    counter = 0;
    length = welcome.length;
    addChar();

    // add characters, one at a time
    function addChar() {
      $line.append(welcome.charAt(counter));
      
      // are we still adding chars?
      if (counter++ < length) {

        // don't delay on spaces
        if (welcome.charAt(counter) === " ") {
          addChar();
        } else {
          setTimeout(addChar, 15);
        }
        
        // we've finished adding characters, init
      }
    }
  }


  function getColor(){
    var colorParts = [];

    for (var i = 0; i < 3; i++) {
      colorParts[i] = Math.floor(Math.random()*255);
    }

    return 'rgb('+colorParts[0]+','+colorParts[1]+','+colorParts[2]+')';
  }


  // focus management — keep focus on the command box (or name input while modal shown)
  function focusActive() {
    if (!$('#name-modal').hasClass('modal-hidden')) {
      $('#name-input').focus();
    } else {
      $('#command').focus();
    }
  }
  $(document).on('mousedown click', function (e) {
    if ($(e.target).closest('#name-form, #command, #name-input, #send, a, button').length) return;
    e.preventDefault();
    focusActive();
  });
  $(document).on('focusout', 'input, button', function () {
    setTimeout(focusActive, 0);
  });


  // ask for a name via HTML modal, then continue
  function askName(cb) {
    var isKiosk = document.body.classList.contains('kiosk');
    var storedUsername = isKiosk ? "" : (localStorage.getItem("username") || "");
    $('#name-input').val(storedUsername);
    $('#name-modal').removeClass('modal-hidden');
    setTimeout(function () { $('#name-input').focus().select(); }, 0);

    $('#name-form').on('submit', function (e) {
      e.preventDefault();
      var name = ($('#name-input').val() || '').trim();
      if (!name) {
        $('#name-input').focus();
        return;
      }
      if (!isKiosk) localStorage.setItem("username", name);
      $('#name-modal').addClass('modal-hidden');
      $('#name-form').off('submit');
      cb(name);
    });
  }


  // INIT !
  function connect(username) {
    currentUsername = username;
    socket.emit('login', username);
    init();
    addLine('Connecting...');
    focusActive();
  }
  askName(function (name) { connect(name); });

})();
