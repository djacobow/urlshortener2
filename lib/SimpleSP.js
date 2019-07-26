/* jshint esversion: 6 */

var saml2 = require('saml2-js');
var fs = require('fs');
var SimpleSess = require('./SimpleSess');
var loadFile = function(f) { return fs.readFileSync(f).toString(); };


var SimpleSP = function(config) {
    this.config = config;

    var sp_opts = {
        entity_id: config.sp.url_base + config.endpoints.metadata,
        private_key: loadFile(config.sp.pemfile),
        certificate: loadFile(config.sp.certfile),
        assert_endpoint: config.sp.url_base + config.endpoints.assert,
    };
    this.sp = new saml2.ServiceProvider(sp_opts);
 
    var idp_opts = {
        sso_login_url: config.idp.sso_login,
        entity_id: config.idp.entity_id,
        certificates: config.idp.certfiles.map(loadFile),
        sign_get_request: true,
        allow_unencrypted_assertion: true,
        force_authn: false,
    };
    this.idp = new saml2.IdentityProvider(idp_opts);
    this.ss = new SimpleSess(this.config.session.cookie_prefix);
    this.metadata = this.sp.create_metadata();
};

SimpleSP.prototype.getLoginURL = function() {
    return this.config.sp.url_base + this.config.endpoints.login;
};

SimpleSP.prototype.setupRoutes = function(router) {
    router.get(this.config.endpoints.metadata, this.metaHandler.bind(this));
    router.get(this.config.endpoints.login,    this.loginHandler.bind(this));
    /*
    router.get('/',                            this.loginHandler.bind(this));
    */
    router.post(this.config.endpoints.assert,  this.assertHandler.bind(this));
    // for debug
    router.get('/sso/debug',                   this.debugSessions.bind(this));
    router.get('/sso/myname',                  this.nameHandler.bind(this));
};


SimpleSP.prototype.getUser = function(req) {
    return this.ss.get_user(req);
};

SimpleSP.prototype.debugSessions = function(req, res) {
    this.ss.get_sessions(req,res);
};

SimpleSP.prototype.nameHandler = function(req, res) {
    var user = this.ss.get_user(req);
    if (user) {
        console.debug('hiFunc: user is auth');
        res.json({auth_user_eppn: user});
    } else {
        console.debug('hiFunc: user not auth');
        res.status(403);
        res.json({message:'don\'t know you'});
    }
};

SimpleSP.prototype.metaHandler = function(req, res) {
  console.debug('sp.metaHandler');
  res.type('application/xml');
  res.send(this.metadata);
};


SimpleSP.prototype.loginHandler = function(req, res) {
   console.debug('sp.loginHandler');
    var user = this.ss.get_user(req);
    if (user) {
        console.debug('loginFunc: we know this user (' + user + ') already');
        return res.redirect('/us2');
    }
  
    this.sp.create_login_request_url(this.idp, {}, (err, login_url, request_id) => {
        if (err !== null) {
            res.status(500);
            return res.json({message: 'cannot create login request'});
        }
        res.redirect(login_url);
    });
};


SimpleSP.prototype.assertHandler = function(req, res) {
    var options = {request_body: req.body};
    this.sp.post_assert(this.idp, options, (err, saml_response) => {
        if (err !== null) {
            console.error('There was an error',err);
            res.status(500);
            res.redirect(this.config.sp.url_base + this.config.endpoints.login);
            res.json({'err':err,'resp':saml_response});
            return;
        }
        var name_id = saml_response.user.name_id;
        this.ss.set(req,res,saml_response.user);
        var eppn = saml_response.user.attributes[this.config.eppn_key][0];
        console.debug('assertFunc: success for ' + eppn);
        return res.redirect('/us2');
    });
};



module.exports = SimpleSP;


