PILOT_ACCELERATION = 0.04;

(function(window, document, $, undefined) {
        'use strict';

        var keyCodeMap    = {"0":"96","1":"97","2":"98","3":"99","4":"100","5":"101","6":"102","7":"103","8":"104","9":"105","backspace":"8","tab":"9","return":"13","shift":"16","ctrl":"17","alt":"18","pausebreak":"19","capslock":"20","escape":"27"," ":"32","pageup":"33","pagedown":"34","end":"35","home":"36","left":"37","up":"38","right":"39","down":"40","+":"107","printscreen":"44","insert":"45","delete":"46",";":"186","=":"187","a":"65","b":"66","c":"67","d":"68","e":"69","f":"70","g":"71","h":"72","i":"73","j":"74","k":"75","l":"76","m":"77","n":"78","o":"79","p":"80","q":"81","r":"82","s":"83","t":"84","u":"85","v":"86","w":"87","x":"88","y":"89","z":"90","*":"106","-":"189",".":"190","/":"191","f1":"112","f2":"113","f3":"114","f4":"115","f5":"116","f6":"117","f7":"118","f8":"119","f9":"120","f10":"121","f11":"122","f12":"123","numlock":"144","scrolllock":"145",",":"188","`":"192","[":"219","\\":"220","]":"221","'":"222"};
        //"

        var forward  = 'z',
            backward = 's',
            left     = 'q',
            right    = 'd',
            flip     = 'f',
            channel  = 'c';

        // Static keymap used within this module
        var Keymap = {
          38 : {
            ev : 'move',
            action : 'up'
          },
          40 : {
            ev : 'move',
            action : 'down'
          },
          37 : {
            ev : 'move',
            action : 'counterClockwise'
          },
          39 : {
            ev : 'move',
            action : 'clockwise'
          },
          32 : {
            ev : 'drone',
            action : 'stop'
          },
          84 : {
            ev : 'drone',
            action : 'takeoff'
          },
          76 : {
            ev : 'drone',
            action : 'land'
          },
          69 : {
            ev : 'drone',
            action : 'disableEmergency'
          },
          70 : {
            ev : 'animate',
            action : 'flip'
          }
        };
        Keymap[keyCodeMap[forward]]  = {
          ev : 'move',
          action : 'front'
        };
        Keymap[keyCodeMap[backward]] = {
          ev : 'move',
          action : 'back'
        };
        Keymap[keyCodeMap[left]]     = {
          ev : 'move',
          action : 'left'
        };
        Keymap[keyCodeMap[right]]    = {
          ev : 'move',
          action : 'right'
        };
        Keymap[keyCodeMap[channel]]  = {
          ev : 'channel'
        };

        var timeout;

        // config for array of buttons and their associated command or key
        var buttons = [
          {
            id: "takeoff",
            name: "Takeoff",
            key: "t",
            ev : 84
          },
          {
            id: "land",
            name: "Land",
            key: "l",
            ev : 76
          },
          {
            id: "left",
            name: "Left",
            key: "q",
            ev : 81
          },
          {
            id: "right",
            name: "Right",
            key: "d",
            ev : 68
          },
          {
            id: "forward",
            name: "Forward",
            key: "z",
            ev : 90
          },
          {
            id: "back",
            name: "Back",
            key: "s",
            ev : 83
          },
          {
            id: "stop",
            name: "Hover",
            key: ":",
            ev : 32
          },
          {
            id: "up",
            name: "Up",
            key: "↑",
            ev : 38
          },
          {
            id: "down",
            name: "Down",
            key: "↓",
            ev : 40
          },
          {
            id: "clockwise",
            name: "Clockwise",
            key: "←",
            ev : 37
          },
          {
            id: "anticlockwise",
            name: "Anti-Clockwise",
            key: "→",
            ev : 39
          },
          {
            id: "flip",
            name: "Flip",
            key: "f",
            ev : 70
          },
          {
            id: "camera",
            name: "Switch Camera",
            key: "c",
            ev : 67
          },
          {
            id: "emergency",
            name: "Emergency",
            key: "e",
            ev : 69
          },
        ];


        // on press, replace current buttons with new one
        // remove unpress
        // set timeout after press to cancel (or stop) after so many seconds

        /*
         * Constructuor
         */
        var Pilot = function Pilot(cockpit) {
                console.log("Loading Onscreen-keyboard plugin.");
                this.cockpit = cockpit;
                this.speed = 0;
                this.moving = false;
                this.keys = {};

                var buttonHTML = jQuery.map( buttons, function( button ) {
                  return "<div class='button' id='"+ button.id +"' data-ev='"+ button.ev+"'>"+ button.name + " (" + button.key + ")</div>"
                });

                // Insert buttons into view
                $('.main-container .wrapper').append("<div id='buttons'>"+buttonHTML.join('')+"</div>");

                // Add the buttons to the control area
                $('#controls').append('<input type="button" id="ftrim" value="Flat trim">');
                $('#controls').append('<input type="button" id="calibratemagneto" value="Calibrate magneto">');

                // Start with magneto calibration disabled.
                $('#calibratemagneto').prop('disabled', true);

                // Register the various event handlers
                this.listen();

                // Setup a timer to send motion command
                var self = this;
                setInterval(function(){self.sendCommands()},100);
        };

        /*
         * Register keyboard event listener
         */
        Pilot.prototype.listen = function listen() {
                var pilot = this;
                $(document).keydown(function(ev) {
                  pilot.stop();
                  pilot.keyDown(ev);
                });

                $('.button').click(function(){
                  var button = $(this);

                  pilot.stop();
                  button.addClass('active');
                  pilot.keyDown({keyCode: button.data().ev, preventDefault:function(){}});
                });

                $('#calibratemagneto').click(function(ev) {
                  ev.preventDefault();
                  pilot.calibrate(0);
                });
                $('#ftrim').click(function(ev) {
                  ev.preventDefault();
                  pilot.ftrim();
                });
                this.cockpit.socket.on('hovering', function() {
                  $('#calibratemagneto').prop('disabled', false);
                  $('#ftrim').prop('disabled', true);
                });
                this.cockpit.socket.on('landed', function() {
                  $('#calibratemagneto').prop('disabled', true);
                  $('#ftrim').prop('disabled', false);
                });


        };

        /*
         * Process onkeydown. For motion commands, we just update the
         * speed for the given key and the actual commands will be sent
         * by the sendCommand method, triggered by a timer.
         *
         */
        Pilot.prototype.keyDown = function keyDown(ev) {
                console.log("Keydown: " + ev.keyCode);
                clearTimeout(timeout)
                if (ev.keyCode == 9) {
                  PILOT_ACCELERATION = (PILOT_ACCELERATION == 0.04) ? 0.64 : 0.04;
                  console.log("PILOT_ACCELERATION: " + PILOT_ACCELERATION);
                  ev.preventDefault();
                  return;
                }
                if (Keymap[ev.keyCode] == null) {
                        return;
                }
                ev.preventDefault();

                var key = ev.keyCode;
                var cmd = Keymap[key];
                //if flip, determine which direction to flip
                var regFlip = /^flip/;
                if (regFlip.test(cmd.action)) {
                  console.log("FLIP!");
                  //check for which direction to flip
                  switch (this.moving) {
                    case 'front':
                      cmd.action = 'flipAhead';
                      break;
                    case 'back':
                      cmd.action = 'flipBehind';
                      break;
                    case 'right':
                      cmd.action = 'flipRight';
                      break;
                    default:
                      cmd.action = 'flipLeft';
                      break;
                  }

                }
                // If a motion command, we just update the speed
                if (cmd.ev == "move") {
                    timeout = setTimeout(function(argument) {
                      this.stop();
                    }, 2000);
                    this.moving = Keymap[ev.keyCode].action;
                    if (typeof(this.keys[key])=='undefined' || this.keys[key]===null) {
                        this.keys[key] = PILOT_ACCELERATION;
                    }
                }
                // Else we send the command immediately
                else {
                    this.cockpit.socket.emit("/pilot/" + cmd.ev, {
                        action : cmd.action
                    });
                }
        };

        /*
         * On keyup we delete active keys from the key array
         * and send a stop command for this direction
         */
        Pilot.prototype.keyUp = function keyUp(ev) {
                console.log("Keyup: " + ev.keyCode);
                if (Keymap[ev.keyCode] == null) {
                        return;
                }
                ev.preventDefault();

                // Delete the key from the tracking array
                var key = ev.keyCode;
                delete this.keys[key];

                // Send a command to set the motion in this direction to zero
                if (Object.keys(this.keys).length > 0) {
                  var cmd = Keymap[key];
                  this.cockpit.socket.emit("/pilot/" + cmd.ev, {
                      action : cmd.action,
                      speed : 0
                  });
                } else { // hovering state if no more active commands
                  this.stop();
                }
        }

        Pilot.prototype.stop = function stop(){
          $('.active').removeClass('active')
          this.keys = [];
          this.cockpit.socket.emit("/pilot/drone", {
              action : 'stop'
          });
        }

        /*
         * Triggered by a timer, check for active keys
         * and send the appropriate motion commands
         */
        Pilot.prototype.sendCommands = function() {
                for (var k in this.keys) {
                    var cmd = Keymap[k];
                    // Send the command
                    this.cockpit.socket.emit("/pilot/" + cmd.ev, {
                        action : cmd.action,
                        speed : this.keys[k]
                    });

                    // Update the speed
                    this.keys[k] = this.keys[k] + PILOT_ACCELERATION / (1 - this.keys[k]);
                    this.keys[k] = Math.min(1, this.keys[k]);
                }
        }

        /*
         * Requets a device callibration. Beware that for some device
         * such as the compass, the drone will perform some motion.
         */
        Pilot.prototype.calibrate = function calibrate(deviceNum) {
                this.cockpit.socket.emit("/pilot/calibrate", {
                        device_num : 0
                });
        };

        /*
         * Requests a flat trim. Disabled when flying.
         */
        Pilot.prototype.ftrim = function ftrim() {
                this.cockpit.socket.emit("/pilot/ftrim");
        };


        window.Cockpit.plugins.push(Pilot);

}(window, document, jQuery));
