/*jshint esversion:6 */
var path = require('path');
var logger = require(path.resolve(__dirname,'./logger.js'));
var DBwrap = require(path.resolve(__dirname,'./dbwrap.js'));

var URLdb = function(config) {

    this.config = config;

    DBwrap.call(this, config);

    URLdb.prototype.copyRow = function(row) {
        var rv_keys = ['hash','id','url','create_date','update_date', 'user','last_use','use_count','permissions'];
        rv = {};
        rv_keys.forEach((key) => { 
            if (row.hasOwnProperty(key)) {
                rv[key] = row[key]; 
            }
        });
        return rv;
    };

    URLdb.prototype.lookup_hash = function(hash, cb) {
        var qs = 'SELECT * FROM ' + config.name + '.urls WHERE hash = ?;';
        this.qwrap({sql: qs, timeout: 5000, values: [hash] }, (err, rows) => {
            if (err) {
                logger.d(err);
                return cb(err,{found: false, hash: hash});
            } else if (!rows.length) {
                return cb(null,{found: false, hash: hash});
            } else {
                var row = rows[0];
                var rv = this.copyRow(row);
                rv.create = false;
                rv.found = true;
                return cb(null,rv);
            }
        });
    };

    URLdb.prototype.remove = function(user, hash, isadmin, cb) {
        var qs = 'DELETE FROM ' + config.name + '.urls WHERE ' +
             (isadmin ? '' : ' user=? AND ') + ' hash=?;';
        var values = isadmin ? [hash] : [use,hash];
        this.qwrap({sql: qs, timeout: 5000, values:values }, (err, rows) => {
            if (err) {
                logger.d(err);
                return cb(err,{message:'not deleted'});
            } else {
                return cb(null,{message:'deleted'});
            }
        });
    };


    URLdb.prototype.history_by_hash = function(hash, cb) {
        var qs = [
            'select yearweek(date) year_week, count(hash) use_count',
            'from ' + config.name + '.log',
            'where hash = ?',
            'group by year_week',
            'order by year_week',
            ';'
        ].join(' ');
        this.qwrap({sql:qs, timeout: 5000, values:[hash] }, (err, rows) => {
            if (err) {
                logger.d(err);
                return cb(err, []);
            }
            return cb(null,rows);
        });
    };

    URLdb.prototype.lookup_by_user = function(user, cb) {
        var qs = [
            'select',
            config.name + '.urls.hash,',
            config.name + '.urls.url,',
            config.name + '.urls.user,',
            config.name + '.urls.create_date,',
            config.name + '.urls.update_date,',
            config.name + '.urls.permissions,',
            'count(' + config.name + '.log.hash) as \'use_count\',',
            'max(' + config.name + '.log.date) as \'last_use\'',
            'from ' + config.name + '.urls',
            'left join ' + config.name + '.log',
            'on',
            config.name + '.urls.hash = ',
            config.name + '.log.hash',
            'where ' + config.name + '.urls.user = ?',
            'group by',
            config.name + '.urls.hash',
            'order by use_count desc, ',
            config.name + '.urls.hash',
            ';',
        ].join(' ');

        this.qwrap({sql: qs, timeout: 5000, values:[user] }, (err, rows) => {
            if (err) {
                logger.d(err);
                return cb(err, {user_found: false, count: 0, entries: []});
            } else if (!rows.length) {
                return cb(null, {user_found: false, count: 0, entries: []});
            } else {
                var rv = {user_found: true, count: rows.length, entries: []};
                rows.forEach((row) => {
                    rv.entries.push(this.copyRow(row));
                });
                return cb(null,rv);
            }
        });
    };

    URLdb.prototype.log =function(sughash,ip,res,cb) {
        var qs = ['INSERT INTO',
                  config.name + '.' + 'log',
                  '(created,found,hash,date,ip,err)',
                  'VALUES(?,?,?,?,?,?);',
                 ].join(' ');
        var hash = sughash || res.hash;
        var now = new Date();
        var err = res.hasOwnProperty('err') ? res.err : '';
        err = err.substring(0,this.config.restrictions.max_err_length);
        var created = res.hasOwnProperty('created') && res.created;
        var found   = res.hasOwnProperty('found') && res.found;
        var vals = [ created, found, hash, now, ip, err ];
        this.qwrap({sql: qs, timeout: 5000, values: vals}, (logerr,logres) => {
            return cb(logerr,logres);
        });
    };

    URLdb.prototype.rowcount = function(cb) {
        var qs = 'SELECT COUNT(*) FROM ' + config.name + '.urls;';
        this.qwrap({sql: qs, timeout: 5000, }, (err, res) => {
            if (err) return cb('count_err',Math.floor(Math.random() * 1e7));
            var count = res[0]['COUNT(*)'];
            return cb(null,count);
        });
    };

    URLdb.prototype.lookup_raw = function(url, cb) {
        var qs = 'SELECT * FROM ' + config.name + '.urls WHERE url = ?;';
        this.qwrap({sql: qs, timeout: 5000, values: [url] }, (err, rows) => {
            var rv = { found: false, created: false };
            logger.d('lookup_raw');
            if (err) {
                logger.d(' * lokup_raw error');
                return cb(err, rv);
            } else if (!rows.length) {
                logger.d(' * lokup_raw no rows');
                return cb(null, rv);
            } else {
                logger.d(' * lokup_raw record');
                rv = this.copyRow(rows[0]);
                rv.found = true;
                rv.created = false;
                logger.d(rv);
                return cb(null,rv);
            }
        });
    };

    URLdb.prototype.change_permissions = function(hash, user, newperms, isadmin, cb) {
        var qs = [
            'UPDATE',
            config.name + '.urls',
            'set',
            'permissions=?,',
            'update_date=?',
            'where',
            'hash=?',
            (isadmin ? '' : ' AND user=?'),
            ';',
        ].join(' ');
        var now = new Date();
        var vals = [ newperms, now, hash, user ];
        this.qwrap({sql: qs, timeout: 5000, values: vals}, (err,res) => {
            var rv = {
                hash: hash,
                user: user,
                newpermissions: newperms,
            };
            if (err) {
                rv.updated = false;
                rv.err = err;
            } else {
                rv.updated = true;
            }
            return cb(null,rv);
        });
    };


    URLdb.prototype.reassign_entry = function(hash,user,newuser,isadmin,cb) {
        var qs = [
                  'UPDATE',
                  config.name + '.urls',
                  'set',
                  'user=?,',
                  'update_date=?',
                  'where',
                  'hash=?',
                  (isadmin ? '' : ' AND user=?'),
                  ';',
                 ].join(' ');
        var now = new Date();
        var vals = [ newuser, now, hash, user ];
        this.qwrap({sql: qs, timeout: 5000, values: vals}, (err,res) => {
            var rv = {
                hash: hash,
                orig_user: user,
                new_user: newuser,
            };
            if (err) {
                rv.updated = false;
                rv.err = err;
            } else {
                rv.updated = true;
            }
            return cb(null,rv);
        });
    };

    URLdb.prototype.update_entry = function(url,hash,user,isadmin,cb) {
        var qs = ['UPDATE',
                  config.name + '.urls',
                  'SET',
                  'url=?,',
                  'update_date=?',
                  'WHERE',
                  'hash=?',
                  (isadmin ? '' : ' AND user=?'),
                  ';',
                 ].join(' ');
        var now = new Date();
        var vals = [ url, now, hash, user ];

        this.qwrap({sql: qs, timeout: 5000, values: vals}, (err,res) => {
            var rv = {
                url:url,
                hash:hash,
                user:user,
            };
            if (!err) {
                rv.updated = true;
                rv.found   = true;
                update_date = now;
                id = res ? res.insertId : null;
            } else {
                rv.err = err;
                rv.updated = false;
            }
            return cb(null,rv);
        });
    };

    URLdb.prototype.store_entry = function(url,hash,user,permissions,cb) {
        var qs = ['INSERT INTO',
                  config.name + '.urls',
                  '(url,hash,user,permissions,create_date,update_date)',
                  'VALUES(?,?,?,?,?,?);',
                 ].join(' ');
        var now = new Date();
        var vals = [ url, hash, user, permissions, now, now ];

        this.qwrap({sql: qs, timeout: 5000, values: vals}, (err,res) => {
            var rv = {
                url: url,
                user: user,
                hash: hash,
            };
            if (err) {
                logger.e('qwrap return err');
                logger.e(err);
                rv.found = false;
                rv.created = false;
            } else {
                rv.found = true;
                rv.created = true;
                create_date = now;
                id = res ? res.insertId : null;
            }
            return cb(null,rv);
        });
    };

    URLdb.prototype.dump = function(which, cb) {
        var table = (which == 'urls') ? 'urls' : 'log';
        
        var qs = ['SELECT * FROM ',
                  config.name + '.' + table,
                  ';'
                 ].join(' ');

        this.qwrap({sql: qs, timeout: 5000}, (err,res) => {
            cb(err,res);
        });
    };


    URLdb.prototype.search_url_like = function(url, use_re, cb) {
        this.search_like('url',url,use_re,cb);
    };
    URLdb.prototype.search_hash_like = function(hash, use_re, cb) {
        this.search_like('hash',hash,use_re,cb);
    };

    URLdb.prototype.user_list = function(cb) {
        var qs = ['select distinct user from',
                  config.name + '.urls',
                  'order by user'
                 ].join(' ');
        this.qwrap({sql: qs}, (err,rows) => {
            if (err) {
                logger.e(err);
                return cb(err,[]);
            }
            return cb(null,rows.map((x) => { return x.user; }));
        });
    };

    URLdb.prototype.search_like = function(what, like, use_re, cb) {
        var qs = [
            'select',
            config.name + '.urls.hash,',
            config.name + '.urls.url,',
            config.name + '.urls.user,',
            config.name + '.urls.permissions,',
            config.name + '.urls.create_date,',
            config.name + '.urls.update_date,',
            'count(' + config.name + '.log.hash) as \'use_count\',',
            'max(' + config.name + '.log.date) as \'last_use\'',
            'from ' + config.name + '.urls',
            'left join ' + config.name + '.log',
            'on',
            config.name + '.urls.hash = ',
            config.name + '.log.hash',
            'where ' + config.name + '.urls.' + what,
            (use_re ? 'rlike' : 'like') + ' ?',
            'group by',
            config.name + '.urls.hash',
            'order by use_count desc,',
            config.name + '.urls.hash',
            ';',
        ].join(' ');
        
        if (!use_re) like = '%' + like + '%';
        var vals = [ like ];
        this.qwrap({sql: qs, timeout: 5000, values: vals}, (err, res) => {
            cb(err,res);
        });
    };

    URLdb.prototype.make_tables = function(cb) {
        this.create_urltable((cterr) => {
            if (cterr) logger.e('Problem creating url table');
            else logger.d('url db created or exists');
            this.create_logtable((cterr) => {
                if (cterr) logger.e('Problem creating log table');
                else logger.d('log db created or exists');
                return cb();
            });
        });
    };

    URLdb.prototype.create_logtable = function(cb) {
        var qs = [
            'CREATE TABLE IF NOT EXISTS ',
            config.name + '.' + 'log',
            ' (',
            'id INT NOT NULL UNIQUE AUTO_INCREMENT,',
            'created BOOLEAN,',
            'found BOOLEAN,',
            'hash VARCHAR(?) COLLATE latin1_general_cs,',
            'date DATETIME,',
            'ip VARCHAR(40),',
            'err VARCHAR(?),',
            'PRIMARY KEY ( id ), ',
            'KEY (hash) ',
            ') DEFAULT CHARSET=latin1;',
        ].join(' ');
        vals = [ config.restrictions.max_hash_length,
                 config.restrictions.max_err_length,
               ];
        logger.d(qs);
        this.qwrap({sql: qs, values:vals}, (err,rows) => {
            if (err) {
                logger.e(err);
                return cb(err,null);
            }
            is_connected = true;
            return cb(err,rows);
        });
    };

    URLdb.prototype.create_urltable = function(cb) {
        var qs = [
            'CREATE TABLE IF NOT EXISTS ',
            config.name,
            '.',
            'urls',
            ' (',
            'id INT NOT NULL UNIQUE AUTO_INCREMENT, ',
            'url VARCHAR(?) NOT NULL, ',
            'hash VARCHAR(?) NOT NULL UNIQUE COLLATE latin1_general_cs, ',
            'user VARCHAR(?), ',
            'permissions ENUM(\'world\',\'lbnl\',\'private\'), ',
            'create_date DATETIME, ',
            'update_date DATETIME, ',
            'PRIMARY KEY ( hash ), ',
            'KEY (url ) ',
            ') DEFAULT CHARSET=latin1;',
        ].join('');

        vals = [ config.restrictions.max_url_length,
                 config.restrictions.max_hash_length,
                 64 ];
        logger.d(qs);
        this.qwrap({sql: qs, values: vals}, (err,rows) => {
            if (err) {
                logger.e(err);
                return cb(err,null);
            }
            is_connected = true;
            return cb(err,rows);
        });
    };
};

URLdb.prototype = Object.create(DBwrap.prototype);
URLdb.constructor = URLdb;
module.exports = URLdb;

if (require.main == module) {
    db = new URLdb();
    db.make_tables(() => { });
}

