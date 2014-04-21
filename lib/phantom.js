/*jshint node: true, strict: false */

var util       = require('util'),
    path       = require('path'),
    events     = require('events'),
    createPage = require('../phantom-page.js');



function Phantom(url, viewport, delay) {
    events.EventEmitter.call(this);

    this.url      = url;
    this.viewport = viewport;
    this.delay    = delay;
    this.phantom  = null;

    createPage(this.onpagecreated.bind(this));
}

util.inherits(Phantom, events.EventEmitter);



Phantom.prototype.onpagecreated = function (err, phantom) {
    if (err) { return console.error(err); }

    this.phantom = phantom;

    phantom.setViewport(this.viewport);
    phantom.load(this.url);

    phantom.on('load', this.onload.bind(this));
    phantom.on('message', this.onmessage.bind(this));
};


Phantom.prototype.onload = function () {
    setTimeout(this.injectJs.bind(this), this.delay * 1000);
};


Phantom.prototype.onmessage = function (message) {
    if (message.type === 'selectors') {
        this.emit('selectorsReceived', message.data);
        this.phantom.exit();
    }
};


Phantom.prototype.injectJs = function () {
    var file = path.join(__dirname, '..', 'critical-css.js');
    this.phantom.page.injectJs(file);
};



module.exports = Phantom;
