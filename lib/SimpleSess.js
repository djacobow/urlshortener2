var crypto = require('crypto');

var makeRandString = function(l) {
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  b = crypto.randomBytes(l);
  var c = [];
  for (var i=0; i<l; i++) {
   c.push(b.readUIntBE(i,1));
  }
  var text = c.map(function(v) { return possible[v % possible.length]; }).join('');
  return text;
};

var SimpleSess = function(cookie_prefix) {
    this.sessions_by_cookie = {};
    this.cookie_name = cookie_prefix + makeRandString(5);
    this.max_age = 1000 * 60 * 60 * 6;
    this.eppn_key =  'urn:oid:1.3.6.1.4.1.5923.1.1.1.6';
};
 
SimpleSess.prototype.get_sessions = function(req, res) {
    res.json(this.sessions_by_cookie);
};

SimpleSess.prototype.set = function(req, res, sdata) {
    var new_cookie = makeRandString(50);
    var name_id = sdata.name_id;
    this.sessions_by_cookie[new_cookie] = {
        date: new Date(),
        sdata: sdata,
        name_id: name_id,
    };
    res.cookie(this.cookie_name, new_cookie, { maxAge: 24*60*60*1000});
};

SimpleSess.prototype.get_user = function(req) {
    var sdata = this.get(req);
    var user = null;
    if (sdata && sdata.attributes && sdata.attributes[this.eppn_key]) {
        // I am setting all the usernames to lowercase for 
        // simplicity's sake. This should be fine at LBL, but 
        // could be an issue at other institutions, maybe?
        user = sdata.attributes[this.eppn_key][0].toLowerCase();
    }
    return user;
};

SimpleSess.prototype.get = function(req) {
    var sdata = null;
    if (false) {
        console.debug('cookies');
        console.debug(req.cookies);
    }
    var cookie = null;
    if (req.cookies) {
        cookie = req.cookies[this.cookie_name] || null;
    }
    if (cookie) {
        sdata = this.sessions_by_cookie[cookie].sdata || null;
    }
    return sdata;
};

SimpleSess.prototype.clearOld = function() {
    console.debug('ss.clearOld');
    var cookies = Object.keys(this.sessions_by_cookie);
    for (var i=0; i<cookies.length; i++) {
        var cookie = cookies[i];
        var cdate  = this.sessions_by_cookie[cookie].date;
        if ((now - cdate) > this.max_age) {
            var name_id = this.sessions_by_cookie[cookie].sdata.name_id;
            delete this.sessions_by_cookie[cookie];
        }
    }
};

SimpleSess.prototype.del = function(res, name_id) {
    console.debug('ss.del');
    var cookie = this.sessions_by_name_id[name_id] || null;
    if (cookie) {
        delete this.sessions_by_cookie[cookie];
        res.clearCookie(this.cookie_name);
    }    
};

module.exports = SimpleSess;

