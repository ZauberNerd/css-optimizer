/*jshint node: true, strict: false */

var fs          = require('fs'),
    css         = require('css'),
    program     = require('commander'),
    phantomPage = require('./phantom-page.js');


function viewPort(str) { return str.split('x').map(Number); }

program
    .version('0.0.1')
    .option('--url <url>', 'The URL of the site to analyze')
    .option('--css <path>', 'Path to the original CSS file on disk')
    .option('--viewport <widthxheight>', 'The viewport', viewPort, [320,640])
    .option('-i, --interactive', 'Decide manually which elements are required')
    .parse(process.argv);


if (process.argv.length < 3) { program.help(); }
