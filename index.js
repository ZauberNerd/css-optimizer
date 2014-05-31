/*jshint node: true, strict: false */

var program     = require('commander'),
    fs          = require('fs'),
    css         = require('css'),
    DOM         = require('./lib/dom.js'),
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
    }.bind(this));

    this.phantom.on('selectorsReceived', function (selectors) {
        var s = selectors.map(function (s) { return s.replace('::', ':'); });
        this.selectors = s;
        if (!this.isBusy && this.ast) {
            this.isBusy = true;
            this.processCSS(this.selectors, this.ast);
        }
    }.bind(this));
}


ATF.prototype.processCSS = function (selectors, ast) {
    var allowed  = ['charset', 'keyframes', 'keyframe'],
        rePseudo = /::?before|after/i;

    function _trimSelector(selector) {
        selector = selector.trim();
        selector = selector.replace(/\s+>\s+/, '>');
        selector = selector.replace(/\s+\+\s+/, '+');
        return selector.replace(/\s+~\s+/, '~');
    }

    function _matchesSelector(selector) {
        selector = _trimSelector(selector);

        var match = rePseudo.exec(selector);

        // sometimes phantomjs doesn't return all pseudo element selectors
        // so we need to check if the selectors match without the pseudo part.
        if (match) { selector = selector.slice(0, match.index); }
        if (selectors.indexOf(selector) > -1) { return true; }

        return false;
    }

    function _ruleAllowed(rule) {
        if (allowed.indexOf(rule.type) > -1) { return true; }

        if (rule.type === 'rule') {
            return rule.selectors.some(_matchesSelector);
        } else if (rule.type === 'media') {
            return rule.rules.some(_ruleAllowed);
        }

        return false;
    }

    function _matchingSelectors(rules, rule) {
        if (rule.type !== 'rule' && rule.type !== 'media') { return rules; }
        if (rule.type === 'rule') {
            rule.selectors = rule.selectors.filter(_matchesSelector);
            if (rule.selectors.length === 0) { return rules; }
        } else if (rule.type === 'media') {
            rule.rules = rule.rules.reduce(_matchingSelectors, []);
        }
        return rules.concat(rule);
    }


    selectors = selectors.map(_trimSelector);


    var rules = ast.stylesheet.rules
        .filter(_ruleAllowed)
        .reduce(_matchingSelectors, []);


    var inlineAst = { type: 'stylesheet', stylesheet: { rules: rules } };


    fs.writeFileSync('./inline.css', css.stringify(inlineAst));
};



new ATF(program);
