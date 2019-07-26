#!/usr/bin/node

var cp             = require('child_process');

var user = 'BLOOP';
var pass = 'BLEEP';
var dbname = 'us2';

command = [
           '/usr/bin/mysqldump',
           '-u ' + user,
           '-p' + pass,
           '--result-file=' + dbname + '_backup.sql',
           dbname
          ].join(' ');


function execute(command, callback) {
    cp.exec(command, function(error, stdout, stderr){ callback(stdout,stderr); });
}
           
console.log(command);
execute(command,console.log);




