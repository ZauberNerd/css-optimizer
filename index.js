/*jshint node: true, strict: false */

var program     = require('commander'),
    DOM         = require('./lib/dom.js'),
    css         = require('css'),
    Phantom     = require('./lib/phantom.js'),
    package     = require('./package.json');



function viewPort(str) { return str.split('x').map(Number); }
function increaseVerbosity(v, total) { return total + 1; }


program
    .version(package.version)
    .option('-u, --url <url>', 'The URL of the site for which optimized CSS ' +
            'should be generated')
    .option('--viewport [widthxheight]', 'The viewport to emulate ' +
            '(default is 320x640)', viewPort, [320,640])
    .option('-d, --delay [seconds]', 'Time to wait after DOMContentLoaded ' +
            'event in seconds', 0)
    .option('-i, --interactive', 'Decide manually which elements are required')
    .option('-v, --verbose', 'More debug output', increaseVerbosity, 0);


program.on('--help', function () {
    console.log('  Examples:');
    console.log('');
    console.log('    $ index --url https://www.google.com --viewport 1024x768');
    console.log('');
});


program.parse(process.argv);



if (process.argv.length < 3) { program.help(); }



function ATF(args) {
    var viewport = { width: args.viewport[0], height: args.viewport[1] };

    this.dom     = new DOM(args.url);
    this.phantom = new Phantom(args.url, viewport, args.delay);

    this.ast       = null;
    this.selectors = null;
    this.isBusy    = false;


    this.dom.on('cssLoaded', function (stylesheets) {
        this.ast = css.parse(stylesheets);
        if (!this.isBusy && this.selectors) {
            this.isBusy = true;
            this.processCSS(this.selectors, this.ast);
        }
        console.log('astGenerated');
    });

    this.phantom.on('selectorsReceived', function (selectors) {
        var s = selectors.map(function (s) { return s.replace('::', ':'); });
        this.selectors = s;
        if (!this.isBusy && this.ast) {
            this.isBusy = true;
            this.processCSS(this.selectors, this.ast);
        }
        console.log('selectorsReceived');
    });
}



new ATF(program);
