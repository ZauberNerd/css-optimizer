/*jshint node: true, strict: false */

var util      = require('util'),
    events    = require('events'),
    phantomjs = require('node-phantom-simple');


function PhantomPage(phantom, page) {
    this.phantom       = phantom;
    this.page          = page;
    this.status        = 'null';
    this.loadTimeout   = null;
    this.startTime     = -1;
    this.domLoadedTime = -1;
    this.successTime   = -1;
    this.loadTime      = -1;

    this.page.onError        = this.onError.bind(this);
    this.page.onCallback     = this.onCallback.bind(this);
    this.page.onInitialized  = this.onInitialized.bind(this);

    events.EventEmitter.call(this);
}

util.inherits(PhantomPage, events.EventEmitter);


PhantomPage.prototype.setViewport = function (viewport, clipRect) {
    if (viewport) {
        this.page.set('viewportSize', viewport);
        if (clipRect) {
            this.page.set('clipRect', {
                top: 0,
                left: 0,
                width: viewport.width,
                height: viewport.height
            });
        }
    }
};

PhantomPage.prototype.exit = function () {
    try {
        this.phantom.exit();
        this.phantom.kill();
    } catch (e) {}
};

PhantomPage.prototype.load = function (url) {
    var self       = this;
    this.url       = url;
    this.startTime = Date.now();

    this.page.open(this.url, function (err, status) {
        if (err) { console.error(err); }
        self.onStatusChange(status);
    });
};

PhantomPage.prototype.onStatusChange = function (status) {
    var cb = null;
    if (this.status === status) { return; }

    if (status === 'DOMContentLoaded') {
        this.domLoadedTime = Date.now() - this.startTime;
    }

    if (status === 'load') {
        this.loadTime = Date.now() - this.startTime;
        clearTimeout(this.loadTimeout);
    }

    if (status === 'success') {
        this.successTime = Date.now() - this.startTime;
        // fake the load event if it doesn't occur after 1s
        cb = this.onStatusChange.bind(this, 'load');
        this.loadTimeout = setTimeout(cb, 1000);
    }

    this.status = status;
    this.emit(status, this.page);
};

PhantomPage.prototype.onError = function (msg, trace) {
    var msgStack = ['ERROR: ' + msg];
    if (trace && trace.length) {
        msgStack.push('TRACE:');
        trace.forEach(function(t) {
            var m = ' -> ' + t.file + ': ' + t.line +
                    (t.function ? ' (in function "' + t.function +'")' : '');
           msgStack.push(m);
        });
    }
    console.error(msgStack.join('\n'));
};

PhantomPage.prototype.onCallback = function (data) {
    if (!data.type) { return; }
    if (data.type === 'event') {
        this.onStatusChange(data[data.type]);
    } else if (data.type === 'message') {
        this.emit(data.type, data[data.type]);
    }
};

PhantomPage.prototype.onInitialized = function () {
    this.page.evaluate(function () {
        window.addEventListener('load', function () {
            window.callPhantom({ type: 'event', event: 'load' });
        }, false);
        document.addEventListener('DOMContentLoaded', function () {
            window.callPhantom({ type: 'event', event: 'DOMContentLoaded' });
        }, false);
    });
};



function createInstance(callback) {
    phantomjs.create(function (err, phantom) {
        if (err) { return callback(err, null); }

        phantom.createPage(function (err, page) {
            if (err) { return callback(err, phantom); }

            callback(null, new PhantomPage(phantom, page));
        });
    }, {
        parameters: {
            'ignore-ssl-errors': 'yes',
            'ssl-protocol': 'any'
        }
    });
}


module.exports = createInstance;
