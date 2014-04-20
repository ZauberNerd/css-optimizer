/*jshint node: true, strict: false */

var fs            = require('fs');
var css           = require('css');
var phantomPage = require('./phantom-page.js');

[
    { fn: 'debug', color: ['\x1B[32m', '\x1B[39m'] },
    { fn: 'warn', color: ['\x1B[33m', '\x1B[39m'] },
    { fn: 'error', color: ['\x1B[31m', '\x1B[39m'] }
].forEach(function (c) {
    console[c.fn] = function () {
        var args   = Array.prototype.slice.call(arguments),
            prefix = c.color[0] + c.fn.toUpperCase() + ': ' + c.color[1];

        if (typeof args[0] === 'string') {
            args[0] = prefix + args[0];
        } else {
            args.unshift(prefix);
        }

        console.log.apply(console, args);
    };
});



function processSelectors(selectorsStr) {
    var cssFile   = fs.readFileSync('../curved/portal/web/build/main.css');
    var ast       = css.parse(cssFile.toString());
    var selectors = JSON.parse(selectorsStr);

    selectors = selectors.map(function (selector) {
        return selector.replace('::', ':');
    });

    fs.writeFileSync('./selectors.txt', JSON.stringify(selectors, null, 4));
    fs.writeFileSync('./ast.json', JSON.stringify(ast, null, 4));
}


function splitCSS(selectors, ast) {
    var allowed = ['charset', 'keyframes', 'keyframe'];

    function _matchesSelector(selector) {
        for (var i = 0, l = selectors.length; i < l; i += 1) {
            if (selectors[i].trim() === selector.trim()) {
                return true;
            }
        }
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
            if (rule.selectors.length === 0) {
                return rules;
            }
        } else if (rule.type === 'media') {
            rule.rules = rule.rules.reduce(_matchingSelectors, []);
        }
        return rules.concat(rule);
    }

    return ast.stylesheet.rules
        .filter(_ruleAllowed)
        .reduce(_matchingSelectors, []);
}



function initPhantom(url, viewport) {
    phantomPage(function phantomCallback(err, phantom) {
        if (err) { return console.error(err); }

        console.debug('loading: %s with viewport set to: ', url, viewport);
        phantom.setViewport(viewport);
        phantom.load(url);

        phantom.on('load', function () {
            console.debug('page %s fully loaded.', url);
            phantom.page.injectJs('./critical-css.js');
            phantom.page.render('capture.png');
        });

        phantom.on('message', function (data) {
            if (data.type === 'selectors') {
                console.debug('received selectors. processing...');
                processSelectors(data.data);
                phantom.exit();
                console.debug('killed phantom. generating inline css...');
                initFS();
            }
        });
    });
}

function initFS() {
    var selectors = JSON.parse(fs.readFileSync('./selectors.txt').toString());
    var ast       = JSON.parse(fs.readFileSync('./ast.json').toString());
    var rules     = splitCSS(selectors, ast);
    var inlineAst = { type: 'stylesheet', stylesheet: { rules: rules } };

    fs.writeFileSync('./inline.css', css.stringify(inlineAst));
    console.debug('inline css created. exiting.');
}


if (process.argv[2] === 'phantom') {
    initPhantom('http://curved.de/', { width: 320, height: 500 });
} else {
    initFS();
}
