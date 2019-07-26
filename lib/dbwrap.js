/*jshint esversion:6 */
var path = require('path');
var logger  = require(path.resolve(__dirname,'../lib/logger.js'));
var mysql   = require('mysql');

var DBwrap = function(dbcfg) {
    var rpthis = this;
    this.dbconfig = dbcfg;

    this.pool = mysql.createPool(this.dbconfig.conn_params);

};

DBwrap.prototype.qwrap = function(q, cb, tries = 3) {
    var dbthis = this;
    if (tries) {
        try {
            this.pool.getConnection(function(connerr, connection) {
                if (!connerr) {
                    connection.query(q,function(qe,r) {
                        connection.release();
                        if (qe && qe.code && (qe.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR')) {
                            logger.d('retrying query because ENQUEUE_AFTER_FATAL');
                            dbthis.qwrap(q,cb,tries-1);
                            return;
                        } else {
                            // yay success or a failure not worth retrying
                            return cb(qe,r);
                        }
                    });
                } else {
                    logger.w('retrying query because pool connection error');
                    logger.d(conerr);
                    dbthis.qwrap(q,cb,tries-1);
                    return;
                }
            });
        } catch (ee) {
            logger.e('dbwrap.qwrap caught EXCEPTION');
            if (ee) logger.e(ee);
            return cb(ee.toString(),null);
        }
    } else {
        logger.e('dbwrap exhausted all db access attempts');
        return cb('exhausted_db_access_attempts',null);
    }
};

module.exports = DBwrap;

