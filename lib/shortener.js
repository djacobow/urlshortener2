/* jshint esversion:6 */
var path    = require('path');
var logger  = require(path.resolve(__dirname,'./logger.js'));
var URLdb   = require(path.resolve(__dirname,'./urldb.js'));
var Encoder = require(path.resolve(__dirname,'./encdec.js'));
var vu      = require('valid-url');
var async   = require('async');

var DumbCache = function(config) {

    this.cache = {};
    this.still_running = true;
    this.config = config;
 
    DumbCache.prototype.set = function(hash,record) {
        this.cache[hash] = {
            create_time: new Date(),
            last_touch: new Date(),
            record: record,
            hit_count: 1,
        };
    };

    DumbCache.prototype.get = function(hash) {
        if (this.cache.hasOwnProperty(hash)) {
            var e = this.cache[hash];
            e.last_touch = new Date();
            e.hit_count += 1;
            return e.record;
        }
        return null;
    };

    DumbCache.prototype.clear = function(hash) {
        if (this.cache.hasOwnProperty(hash)) {
            delete this.cache[hash];
        }
    };

    DumbCache.prototype.purgeOld = function() {
        var hashes = Object.keys(this.cache);
        var max_age = this.config.max_age;
        var now = (new Date()).getTime();
        for (var i=0; i<hashes.length; i++) {
            var hash = hashes[i];
            var elem = this.cache[hash];
            var etime = elem.create_time.getTime();
            if ((now - etime) > max_age) delete this.cache[hash];
        }
        logger.d('Cache purge complete.');
    };

    DumbCache.prototype.startPurger = function() {
        var period = this.config.check_period || 5 * 6 * 1000;
        var cthis = this;
        var runAndReset = function() {
            logger.d('runAndReset');
            cthis.purgeOld();
            if (cthis.still_running) {
                setTimeout(runAndReset, period);
            }
        };
        setTimeout(runAndReset, period);
    };

};



var Shortener = function(config) {
    this.config = config;
    this.db     = new URLdb(config.db);
    this.last_id = 0;
    this.dc = null;
    if (config.cache && config.cache.use) {
        this.dc     = new DumbCache(config.cache);
        this.dc.startPurger();
    }
    this.ed = new Encoder();
};

Shortener.prototype.init = function(cb) {
    this.last_id = 0;
    this.db.make_tables(() => {
        this.db.rowcount((c) => {
            this.last_id = c;
        });
        return cb(null);
    });
};


Shortener.prototype.check_hash_exists = function(hash, cb) {
    this.db.lookup_hash(hash,(err,res) => {
        if (res.found) {
           logger.d('check hash return TRUE');
           return cb(true,res);
        }
        logger.d('check hash return FALSE');
        return cb(false,res);
    });
};

Shortener.prototype.check_url_exists = function(url, cb) {
    this.db.lookup_raw(url,(err,res) => {
        if (res.found && res.hasOwnProperty('hash') && (res.hash !== null)) {
            logger.d('check url return TRUE');
            return cb(true,res);
        }
        logger.d('check url return FALSE');
        return cb(false,res);
    });
};

Shortener.prototype.create_from_url = function(url, sug, user, permissions, ccb) {
    logger.d('* create_from_url');
    if (sug === null) {
        this.db.rowcount((rcerr,count) => {
            try_id = this.last_id;
            if (!try_id) try_id = count;
            var exists = true;
            var try_hash = this.ed.encodeInt(try_id);
        
            async.doUntil((dcb) => {
                logger.d('try_id: ' + try_id);
                try_hash = this.ed.encodeInt(try_id);
                logger.d('try_hash: ' + try_hash);
                try_id += 1;
                this.check_hash_exists(try_hash,(yup,chres) => {
                    exists = yup;
                    dcb(null, yup);
                });
            },(r) => { return !r; },
            () => {
                this.db.store_entry(url,try_hash,user,permissions,(err,res) => {
                    if (err) logger.d(err);
                    this.last_id = res.id;
                    return ccb(err,res);
                });
            });
            
        });
    } else {
        this.db.store_entry(url,sug,user,permissions,(err,res) => {
            if (err) logger.d(err);
            this.last_id = res.id;
            return ccb(err, res);
        });
    }
};

Shortener.prototype.fastPathLookup = function(context,cb) {
    logger.d('handle: lookup');
    if (this.dc) {
        var dcres = this.dc.get(context.hash);
        if (dcres) { 
            this.db.log(context.hash, context.ip, dcres, (logerr,logres) => { /* not important */ });
            dcres.was_memcached = true;
            return cb(null,dcres);
        }
    }

    this.db.lookup_hash(context.hash, (luerr, lures) => {
        lures.was_url_get = true;
        this.db.log(context.hash, context.ip, lures, (logerr,logres) => { /* not important */ });
        if (this.dc) this.dc.set(context.hash, lures);
        return cb(luerr, lures);
    });
};


Shortener.prototype.search = function(context, cb) {
    if (context.hasOwnProperty('url')) {
        this.db.search_url_like(context.url, context.use_regex, (uerr, ures) => {
            if (uerr) return cb(uerr,[]);
            return cb(uerr,ures);
        });
    } else if (context.hasOwnProperty('hash')) {
        this.db.search_hash_like(context.hash, context.use_regex, (herr, hres) => {
            if (herr) return cb(herr,[]);
            return cb(herr,hres);
        });
    } else {
        return cb('Nothing to search for.');
    }
};

Shortener.prototype.history = function(context, cb) {
    this.db.history_by_hash(context.hash, (err,res) => {
        if (err) return cb(err,[]);
        return cb(null,res);
    });
};

Shortener.prototype.listByUser = function(context, cb) {
    this.db.lookup_by_user(context.user, (err,res) => {
        if (err) return cb(err,[]);
        return cb(err,res);
    });
};

Shortener.prototype.deleteByHash = function(context, cb) {
    this.db.lookup_hash(context.hash, (luerr, lures) => {
        if (luerr) return cb(luerr,lures);
        if (lures.user && (context.user !== lures.user) && !context.admin) {
            return cb('stored link is not user\'s',lures);
        }
        this.db.remove(context.user,lures.hash,context.admin,cb);
    });
};

Shortener.prototype.userlist = function(context, cb) {
    this.db.user_list(cb);
};

Shortener.prototype.reassign = function(context, cb) {
    this.db.reassign_entry(
        context.hash, context.user, context.newuser, context.admin, cb
    );
};
Shortener.prototype.chperms = function(context, cb) {
    this.db.change_permissions(
        context.hash, context.user, context.newpermissions, context.admin, cb
    );
};

Shortener.prototype.updateurl = function(context, cb) {
    var url = context.url;
    var user = context.user;
    var hash = context.hash;
    if (!vu.isUri(url)) return cb('Invalid URL',{message:'The string provided doesn\'t look like a valid URL.'});
    if (url.length > this.config.db.restrictions.max_url_length) {
        return cb('URL too long.',{message:'The maximum URL that can be stored is ' + 
            this.config.db.restrictions.max_url_length + ' characters.'});
    }
    this.check_hash_exists(hash, (exists,chres) => {
        if (!exists) return cb('Short link does not exist; can\'t update.');
        this.db.update_entry(url, hash, user, context.admin, cb);
    });
};


Shortener.prototype.createNew = function(context, cb) {
    var url = context.url;
    var user = context.user;
    var sughash = context.suggested_hash;
    var ip = context.ip;
    var permissions = context.permissions;
    if (!vu.isUri(url)) return cb('Invalid URL',{message:'The string provided doesn\'t look like a valid URL.'});
    if (url.length > this.config.db.restrictions.max_url_length) {
        return cb('URL too long.',{message:'The maximum URL that can be stored is ' + 
            this.config.db.restrictions.max_url_length + ' characters.'});
    }

    var acceptable_perms = {
        'world': 1,
        'lbnl': 1,
        'private': 1,
    };

    if (!permissions || !acceptable_perms.hasOwnProperty(permissions)) {
        permissions = 'world';
    }

    if (sughash) {
        var acceptable_hash = sughash.match(/^[\w\.-]+$/);
        if (!acceptable_hash) return cb('Illegal shortname.',{message:'Stick to letters and numbers.'});
        if (sughash.length > this.config.db.restrictions.max_hash_length) {
            return cb('Shortname too long.',
                      {message: 'Short name must be fewer than ' + this.config.db.restrictions.max_hash_length + ' characters.'});
        }
        this.check_hash_exists(sughash, (exists,chres) => {
            if (exists) return cb('shortname_in_use',chres);
            var ALLOW_DUPLICATE_URLS = true;
            if (ALLOW_DUPLICATE_URLS) {
                this.create_from_url(url,sughash,user,permissions, (err, res) => {
                    this.db.log(sughash, ip, res, (logerr,logres) => { /* not important */ });
                    return cb(err, res);
                });
            } else {
                this.check_url_exists(url, (exists,chres) => {
                    if (exists) {
                        return cb(null,chres);
                    }
                    this.create_from_url(url,sughash,user,permissions, (err, res) => {
                        this.db.log(sughash, ip, res, (logerr,logres) => { /* not important */ });
                        return cb(err, res);
                    });
                });
            }
        });
    } else {
        this.check_url_exists(url, (exists,chres) => {
            if (exists) return cb(null,chres);
            this.create_from_url(url,null,user,permissions, (err, res) => {
                this.db.log(null, ip, res, (logerr,logres) => { /* not important */ });
                return cb(err, res);
            });
        });
    }
};

Shortener.prototype.dumpTable = function(context, cb) {
    if (context.log) {
        this.db.dump('log', (dumperr,dumpres) => {
            return cb(dumperr, dumpres);
        });
    } else if (context.urls) {
        this.db.dump('urls', (dumperr,dumpres) => {
            return cb(dumperr, dumpres);
        });
    } else {
        return cb('nothing_to_dump');
    }
};

Shortener.prototype.handle = function(what, context, cb) {
    switch (what) {
        case 'lookup':
            this.fastPathLookup(context, cb);
            break;
        case 'listbyuser':
            this.listByUser(context, cb);
            break;
        case 'delete':
            this.deleteByHash(context,cb);
            break;
        case 'make':
            this.createNew(context, cb);
            break;
        case 'dump':
            this.dumpTable(context, cb);
            break;
        case 'search':
            this.search(context, cb);
            break;
        case 'history':
            this.history(context, cb);
            break;
        case 'updateurl':
            this.updateurl(context, cb);
            break;
        case 'users':
            this.userlist(context, cb);
            break;
        case 'reassign':
            this.reassign(context, cb);
            break;
        case 'chperms':
            this.chperms(context, cb);
            break;
        default:
            return cb('unknown_action');
    }
};


module.exports = Shortener;


