/* jslint browser:true, devel:true */

(function () {
    'use strict';

    if (typeof Element.prototype.matches !== 'function') {
        var proto = Element.prototype;
        var matches = proto.matches ||
            proto.webkitMatchesSelector ||
            proto.mozMatchesSelector ||
            proto.msMatchesSelector ||
            proto.oMatchesSelector;
        Element.prototype.matches = matches;
    }
}());


(function (w, d) {
    'use strict';

    var concat = Array.prototype.concat,
        slice  = Array.prototype.slice;


    function _accept() {
        return NodeFilter.FILTER_ACCEPT;
    }

    function _rulesFor(element, pseudo) {
        var rules = w.getMatchedCSSRules(element, pseudo);
        return slice.call(rules || []);
    }

    function _matchingRules(element) {
        var rules = concat.apply([], _rulesFor(element));
        rules     = concat.apply(rules, _rulesFor(element, '::before'));
        rules     = concat.apply(rules, _rulesFor(element, '::after'));
        return rules;
    }

    function _nonEmptyRules(rules) {
        return rules !== null && rules.length > 0;
    }

    function _trim(str) {
        return str.trim();
    }

    function _toSelectors(selectors, rule) {
        return selectors.concat(rule.selectorText);
    }

    function _toToplevelSelectors(selectors, selectorText) {
        return concat.apply(selectors, selectorText.split(',').map(_trim));
    }

    function _duplicates(el, i, arr) {
        return arr.indexOf(el) === i;
    }


    function getElementsInViewport(_multiplier) {

        var height   = w.innerHeight * (_multiplier || 1),
            el       = d.body,
            NFShowEl = NodeFilter.SHOW_ELEMENT,
            walker   = d.createTreeWalker(el, NFShowEl, _accept, true),
            element  = null,
            rect     = null,
            elements = [d.documentElement];

        do {
            element = walker.currentNode;
            rect    = element.getBoundingClientRect();

            if (rect.top < height) {
                elements.push(element);
            }
        } while (walker.nextNode());

        return elements;
    }


    function getAllSelectors(elements) {
        var rules = elements.map(_matchingRules).filter(_nonEmptyRules);

        // unwrap array: [[1,2,3],[4],[5,6]] => [1,2,3,4,5,6]
        rules = concat.apply([], rules);

        return rules
            .reduce(_toSelectors, [])
            .filter(_duplicates)
            .reduce(_toToplevelSelectors, [])
            .filter(_duplicates);
    }


    function getCriticalSelectors(elements, selectors) {
        var critical    = [],
            element     = null,
            selector    = '',
            elSelector  = '',
            match       = null,
            rePseudo    = /::?before|after/gi;

        for (var i = 0, l = elements.length; i < l; i += 1) {
            element = elements[i];

            for (var j = 0, k = selectors.length; j < k; j += 1) {
                selector   = selectors[j];
                elSelector = selector;
                match      = selector.match(rePseudo);

                if (match) {
                    elSelector = selector.slice(0, match.index);
                }
                if (element.matches(elSelector)) {
                    critical.push(selector);
                }
            }
        }
        return critical.filter(_duplicates);
    }


    var elements          = getElementsInViewport(),
        selectors         = getAllSelectors(elements),
        criticalSelectors = getCriticalSelectors(elements, selectors);

    if (typeof window.callPhantom === 'function') {
        window.callPhantom({
            type: 'message',
            message: {
                type: 'selectors',
                data: JSON.stringify(criticalSelectors)
            }
        });
    } else {
        console.log(criticalSelectors);
    }

}(this, this.document));
