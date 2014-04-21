/*jshint node: true, strict: false */

var http   = require('http'),
    https  = require('https'),
    Url    = require('url'),
    events = require('events'),
    util   = require('util'),
    css    = require('css'),
    jsdom  = require('jsdom');



function CSS(url) {
    events.EventEmitter.call(this);

    this.url   = url;
    this.win   = null;
    this.css   = '';
    this.ast   = null;
    this.ready = false;

    jsdom.env(url, this.jsdomCallback.bind(this));
}

util.inherits(CSS, events.EventEmitter);



CSS.prototype.jsdomCallback = function (errors, win) {
    if (errors) { console.error(errors); }

    this.domLoaded(win);

    var urls = this.findStylesheets(win.document);
    this.loadStylesheets(urls, this.stylesheetsLoaded.bind(this));
};


CSS.prototype.domLoaded = function (win) {
    this.win   = win;
    this.ready = true;

    this.emit('domReady', this.win);
};


CSS.prototype.stylesheetsLoaded = function () {
    this.emit('cssLoaded', this.css);
    this.ast = css.parse(this.css);
    this.emit('astGenerated', this.ast);
};


CSS.prototype.findStylesheets = function (doc) {
    var links = doc.querySelectorAll('link[rel="stylesheet"]');
    return Array.prototype.map.call(links, function (el) { return el.href; });
};


CSS.prototype.loadStylesheets = function (urls, cb) {
    var count    = urls.length,
        finished = 0;

    function handleResponse(response) {
        var buf  = '';

        function rcv(data) { buf += data.toString(); }
        function end() { this.css += buf; if (++finished === count) { cb(); } }

        response.on('data', rcv);
        response.on('end', end.bind(this));
    }

    function download(url) {
        var options = Url.parse(Url.resolve(this.url, url), false, true);
        var proto = https;

        if (options.protocol === 'http:') { proto = http; }

        proto.get(options, handleResponse.bind(this));
    }

    urls.forEach(download, this);
};



module.exports = CSS;
