/* jshint esversion:6 */

var path           = require('path');
var Shortener      = require(path.resolve(__dirname,'./shortener.js'));

var showNoAuth = function(r) {
    r.status(403);
    r.json({message: 'not auth'});
};


var USApp = function(config, sp) {
    this.config = config;
    this.sp = sp;
    this.shortener = new Shortener(config);
    this.acceptable_perms = {
        'world': 10,
        'lbnl': 11,
        'private': 12,
    };
};


USApp.prototype.init = function(cb) {
    this.shortener.init(() =>  {
        return cb(null);
    });
};

USApp.prototype.setupRoutes = function(router) {
    router.get('',                  this.rootHandler.bind(this));
    router.post('/app/create',      this.createHandler.bind(this));
    router.post('/app/delete',      this.removeHandler.bind(this));
    router.post('/app/updateurl',   this.updateurlHandler.bind(this));
    router.post('/app/reassign',    this.reassignHandler.bind(this));
    router.post('/app/chperms',     this.chpermsHandler.bind(this));
    router.get('/app/byuser',       this.listHandler.bind(this));
    router.get('/app/users',        this.userlistHandler.bind(this));
    router.get('/app/dump/:what',   this.dumpHandler.bind(this));
    router.get('/app/search',       this.searchHandler.bind(this));
    router.get('/app/history/:code',this.historyHandler.bind(this));
    router.get('/app/myname',       this.nameHandler.bind(this));
    router.get('/static/:name',     this.staticHandler.bind(this));
    router.get('/:code',            this.lookupHandler.bind(this));
};

var splatFile = function(res, ttype, fn) {
    var complete = path.join(__dirname,'../lib',fn);
    res.sendFile(complete);
};

USApp.prototype.userlistHandler = function(req, res) {
    var user = this.sp.getUser(req);
    if (user && this.config.admins.hasOwnProperty(user)) {
        this.shortener.handle('users', null, (luerr, lures) => {
            if (luerr) {
                return res.json({err:luerr,message:'db lookup problem'});
            }
            return res.json(lures);
        });
    } else {
        return showNoAuth(res);
    }
};
USApp.prototype.nameHandler = function(req, res) {
    var user = this.sp.getUser(req);
    var admin = false;
    if (user) {
        admin = this.config.admins.hasOwnProperty(user);
        return res.json({user:user, admin:admin});
    }
    return showNoAuth(res);
};

USApp.prototype.rootHandler = function(req, res) {
   console.debug('rootHandler');
   var user = this.sp.getUser(req);
   if (user) {
       return splatFile(res, 'text/html', '../static/form.html');
   }
   res.status(403);
   res.redirect(this.sp.getLoginURL());
};

USApp.prototype.staticHandler = function(req, res) {
   var user = this.sp.getUser(req);
   if (user) {
       var name = req.params.name.replace('/','');
       console.debug('handleStatic ' + name + ' (' + user + ')');
       if (this.config.real_files[name] || null) {
           var type = 'text/html';
           if (name.match(/\.js$/)) {
               type = 'text/javascript';
           } else if (name.match(/\.css$/)) {
               type = 'text/css';
           } else if (name.match(/\.wav$/)) {
               type = 'audio/wave';
           }
           splatFile(res,  type, '/../static/' + name);
       } else {
           res.status(404);
           res.json({message: 'never heard of that one.'});
       }
    } else {
        res.status(403);
        res.redirect(this.sp.getLoginURL());
    }
};

USApp.prototype.lookupHandler = function(req, res) {
    var code = req.params.code;
    var ip = req.header('X-Real-IP');
    if (!ip) ip = null;

    var context = {
        hash: req.params.code,
        ip: ip,
    };
    this.shortener.handle('lookup', context, (luerr, lures) => {
        if (luerr) {
            res.status(500);
            return res.json({message: luerr});
        }  else if (!lures.found) {
            return res.json({message: 'url not found'});
        }

        if (lures.permissions == 'world') {
            return res.redirect(301, lures.url);
        }

        var user = this.sp.getUser(req);
        if (lures.permissions == 'lbnl') {
            if (user) {
                if (user.match(/@lbl\.gov$/)) {
                    return res.redirect(301, lures.url);
                } else {
                    res.status(403);
                    return res.json({
                        err:'You are not authorized to access this url.',
                        you:user, 
                        permissions:lures.permissions
                    });
                }
            } 
            res.status(403);
            return res.redirect(this.sp.getLoginURL());
        }
        
        // must be a private URL
        if (lures.user == user) {
            return res.redirect(301, lures.url);
        }
        res.status(403);
        res.json({
            err:'You are not authorized to access this url.',
            you:user, 
            owner:lures.user,
            permissions:lures.permissions
        });
    });
};

USApp.prototype.removeHandler = function(req, res) {
    console.debug('us.removeHandler');
    var user = this.sp.getUser(req);
    if (user) {
        var submission = req.body;
        var context = {
            user: user,
            admin: this.config.admins.hasOwnProperty(user),
        };
        if (submission.url) context.url = submission.url;
        if (submission.shorturl) {
            var hash = submission.shorturl.replace(/^https?\/\//,'');
            context.hash = hash;
        }
        this.shortener.handle('delete', context, (delerr, delres) => {
            if (delerr) {
                res.status(500);
                return res.json({message: 'remove link failed', err: delerr});
            }
            return res.json(delres);
        });
    } else {
        showNoAuth(res);
    }
};


USApp.prototype.historyHandler = function(req, res) {
    var user = this.sp.getUser(req);
    if (user && this.config.admins.hasOwnProperty(user)) {
        var code = req.params.code;
        var ctx = {
            hash: code,
        };
        this.shortener.handle('history',ctx, (herr,hres) => {
            if (herr) {
                res.status(500);
                return res.json({err:herr,message:'something went wrong while load history'});
            } else {
                return res.json(hres);
            }
        });
    } else {
        showNoAuth(res);
    }
};

USApp.prototype.searchHandler = function(req, res) {
    var user = this.sp.getUser(req);
    if (user) {
        var by = req.query.by;
        var term = req.query.term;
        var use_regex = req.query.regex && (req.query.regex == '1');
        if (by && term) {
            var ctx = {use_regex: false};
            if (use_regex) ctx.use_regex = true;
            if (by == 'url') ctx.url = term;
            if (by == 'hash') ctx.hash = term;
            this.shortener.handle('search',ctx, (searcherr, searchres) => {
                if (searcherr) {
                    res.status(404);
                    return res.json({err:searcherr,message:'something went wrong while searching'});
                } else {
                    return res.json(searchres);
                }
            });
        }
    } else {
        showNoAuth(res);
    }
};


USApp.prototype.dumpHandler = function(req, res) {
    console.debug('us.dumpHandler');
    var user = this.sp.getUser(req);
    if (!this.config.admins.hasOwnProperty(user)) {
        return res.json({err:'not admin auth',message:'You are not an administrator.'});
    }
    var dumpwhat = req.params.what;
    if (user) {
        var ctx = {};
        if (dumpwhat == 'log') ctx.log = 'log';
        if (dumpwhat == 'urls') ctx.urls= 'urls';

        this.shortener.handle('dump',ctx, (dumperr, dumpres) => {
            return res.json(dumpres);
        });
    }
};

USApp.prototype.listHandler = function(req, res) {
    console.debug('us.listHandler');
    var logged_user = this.sp.getUser(req);
    var admin = this.config.admins.hasOwnProperty(logged_user);
    var user = null;
    if (admin && req.query.user) {
        user = req.query.user;
    } else if (logged_user) {
        user = logged_user;
    }

    if (user) {
        var context = {
            user: user,
        };
        this.shortener.handle('listbyuser', context, (listerr, listres) => {
            if (listerr) {
                res.status(500);
                return res.json({message: 'list user links failed', err: listerr});
            }
            return res.json(listres);
        });
    } else {
        showNoAuth(res);
    }
};

USApp.prototype.chpermsHandler = function(req, res) {
    console.debug('us.chpermsHandler');
    var user = this.sp.getUser(req);

    if (user) {
        var newpermissions = req.body.newpermissions;
        if (!newpermissions || !this.acceptable_perms.hasOwnProperty(newpermissions)) {
            return res.json({
                err:'invalid permissions',
                message:'The new permissions scope you requested is invalid.',
            });
        }
        var ctx = {
            user: user,
            hash: req.body.hash,
            newpermissions:newpermissions,
            admin: this.config.admins.hasOwnProperty(user),
        };
        console.debug(ctx);
        this.shortener.handle('chperms', ctx, (chperr, chpres) => {
            if (chperr) {
                res.status(500);
                return res.json({message: 'change permissions failedd', err: chperr});
            }
            return res.json(chpres);
        });
    } else {
        showNoAuth(res);
    }
};

USApp.prototype.reassignHandler = function(req, res) {
    console.debug('us.reassignHandler');
    var user = this.sp.getUser(req);
    
    if (user) {
        var newuser = (req.body.newuser || '').trim().toLowerCase();
        if (!newuser.length) {
            return res.json({
                err:'invalid_new_user',
                message:'The new user name was empty or invalid.'
            });
        }
        if (!newuser.match(/@lbl\.gov/)) newuser += '@lbl.gov';
        var ctx = {
            user:user,
            hash:req.body.hash,
            newuser:newuser,
            admin: this.config.admins.hasOwnProperty(user),
        };
        console.debug(ctx);
        this.shortener.handle('reassign', ctx, (reerr, reres) => {
            if (reerr) {
                res.status(500);
                return res.json({message: 'reassign ownership failed', err: reerr});
            }
            return res.json(reres);
        });
    } else {
        showNoAuth(res);
    }
};

USApp.prototype.updateurlHandler = function(req, res) {
    console.debug('us.updateHandler');
    var user = this.sp.getUser(req);
    if (user) {
        var context = {
            user: user,
            url: req.body.url,
            hash: req.body.hash,
            admin: this.config.admins.hasOwnProperty(user),
        };
        this.shortener.handle('updateurl', context, (upderr, updres) => {
            if (upderr) {
                res.status(500);
                return res.json({message: 'update short url failed', err: upderr});
            }
            return res.json(updres);
        });
    } else {
        showNoAuth(res);
    }
};

USApp.prototype.createHandler = function(req, res) {
    console.debug('us.createHandler');
    var user = this.sp.getUser(req);
    if (user) {
        var submission = req.body;

        var permissions = 'world';
        if (submission.permissions &&
            (submission.permissions == 'lbnl') || (submission.permissions == 'private')) {
            permissions = submission.permissions;
        }
        var context = {
            user: user,
            url: submission.url,
            permissions: permissions,
            suggested_hash: null,
        };

        if (submission.hasOwnProperty('suggested_hash')) {
            context.suggested_hash = submission.suggested_hash;
        }
        this.shortener.handle('make', context, (makerr, makeres) => {
            if (makerr) {
                res.status(500);
                return res.json({message: 'create short url failed', err: makerr});
            }
            return res.json(makeres);
        });

    } else {
        showNoAuth(res);
    }
};

module.exports = USApp;

