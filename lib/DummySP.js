
var DummySP = function(config) {
    this.config = config;
    this.user = 'dgj@lbl.gov';
};

DummySP.prototype.getLoginURL = function() {
    return this.config.sp.url_base + this.config.endpoints.login;
};

DummySP.prototype.setupRoutes = function(router) {
    router.get(this.config.endpoints.metadata, this.metaHandler.bind(this));
    router.get(this.config.endpoints.login,    this.loginHandler.bind(this));
    router.get('/',                            this.loginHandler.bind(this));
    router.post(this.config.endpoints.assert,  this.assertHandler.bind(this));
    // for debug
    router.get('/myname',                      this.nameHandler.bind(this));
};


DummySP.prototype.getUser = function(req) {
    return this.user;
};


DummySP.prototype.nameHandler = function(req, res) {
    var user = this.user;
    console.log('hiFunc: user is auth');
    res.json({auth_user_eppn: user});
};

DummySP.prototype.metaHandler = function(req, res) {
  console.log('sp.metaHandler');
  res.type('application/xml');
  res.send('Hi!');
};


DummySP.prototype.loginHandler = function(req, res) {
    console.log('sp.loginHandler');
    return res.redirect('/us2/static/form.html');
};


DummySP.prototype.assertHandler = function(req, res) {
    console.log('sp.assertHandler');
    return res.redirect('/us2/static/form.html');
};



module.exports = DummySP;


