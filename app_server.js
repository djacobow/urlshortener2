var path           = require('path');
var express        = require('express');
var bodyparser     = require('body-parser');
var cookieParser   = require('cookie-parser');

var config         = require(path.resolve(__dirname,'./lib/app_config.js')).get();
var use_dummy_idm = false;
var SimpleSP;
if (use_dummy_idm) {
    SimpleSP       = require(path.resolve(__dirname,'./lib/DummySP.js'));
} else {
    SimpleSP       = require(path.resolve(__dirname,'./lib/SimpleSP.js'));
}

var USApp          = require(path.resolve(__dirname,'./lib/USApp.js'));


var main = function(config) {
    var sp = new SimpleSP(config.sp);
    var ua = new USApp(config.app, sp);

    ua.init(function(aperr) {
        if (aperr) {
            console.error('App could not init.');
        }
        var router = express.Router();
        sp.setupRoutes(router);
        ua.setupRoutes(router);

        var app = express();
        app.use(bodyparser.urlencoded({extended: true, limit: '100kb', parameterLimit: 20}));
        app.use(bodyparser.json({limit:'100kb'}));
        app.use(cookieParser());
        app.use('/us2', router);
        console.log('Listening on port ' + config.us_server.server.port);
        app.listen(config.us_server.server.port);
    });
};

if (require.main === module) {
    main(config);
}
