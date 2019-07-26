/* jshint esversion:6 */

var path   = require('path');
var logger = require(path.resolve(__dirname,'./logger.js'));

var Encoder = function(config) {
    var default_config = {
        alphabet: ['abcdefghijklmnopqrstuvwxyz',
                   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                   '0123456789',
                  ].join(''),
    };
    if (config) {
        this.config = config;
    } else {
        this.config  = default_config;
    }
};

Encoder.prototype.encodeInt = function(remaining) {
    if (typeof remaining === 'string') remaining = parseInt(remaining);
    remaining = Math.floor(remaining);
    if (remaining < 0) return '';
    var base = this.config.alphabet.length;

    var divisor = 1; 
    var dstart = 11;
    var i;
    for (i=0; i<dstart; i++) divisor *= base;

    indices = [];

    if (remaining === 0) return this.config.alphabet[0];

    for (i=0; i<dstart+1; i++) {
        var pval = Math.floor(remaining / divisor);
        remaining -= pval * divisor;
        divisor /= base;
        indices.push(pval);
    }
    while (indices.length && !indices[0]) indices.shift();

    var rstr = indices.map((k) => { return this.config.alphabet[k]; }).join('');
    return rstr;
};

Encoder.prototype.decodeStr = function(instr) {
    var l = instr.length;
    var base = this.config.alphabet.length;
    var sum = 0;
    var factor = 1;
    for (var i=0; i<l; i++) {
        var letter = instr[instr.length-1-i];
        var letteridx = this.config.alphabet.indexOf(letter);
        if (letteridx < 0) return -1;
        sum += factor * letteridx;
        factor *= base;
    }
    return sum;
};


if (require.main == module) {
    var cfg = {
            alphabet: ['abcdefghijklmnopqrstuvwxyz',
                       'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                       '0123456789',
                      ].join(''),
    };
    var e = new Encoder(cfg);
    var i;
    var max_tests = 1000000;
    for (i=0; i<max_tests; i++) {
        var p = Math.floor(Math.random() * 1000);
        var q = Math.floor(Math.random() * 1000);
        var r = Math.floor(Math.random() * 1000);
        var s = Math.floor(Math.random() * 1000);
        var t = p * 1e9 + q * 1e6 + r * 1e3 + s;
        var encoded = e.encodeInt(t);
        var decoded = e.decodeStr(encoded);
        if (t != decoded) {
            logger.e('DID NOT MATCH');
            logger.d('in      : ' + t);
            logger.d('encoded : ' + encoded);
            logger.d('decoded : ' + decoded);
        }
    }
    console.debug(e.encodeInt(0));
    console.debug(e.encodeInt(1));
}


module.exports = Encoder;
