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

    function _getRulesFor(element, pseudo) {
        var rules = w.getMatchedCSSRules(element, pseudo);
        return slice.call(rules || []);
    }

    function _getMatchingRules(element) {
        var rules = concat.apply([], _getRulesFor(element));
        rules     = concat.apply(rules, _getRulesFor(element, '::before'));
        rules     = concat.apply(rules, _getRulesFor(element, '::after'));
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

    function _toSingleSelectors(selectors, selectorText) {
        return concat.apply(selectors, selectorText.split(',').map(_trim));
    }

    function _duplicates(el, i, arr) {
        return arr.indexOf(el) === i;
    }


    /**
     * Returns all elements currently in the viewport.
     * Viewport height can be modified by the multiplier.
     * @param  {Number} _multiplier Defaults to 1. Can be used to modify the
     *                              viewport height.
     * @return {Array}             Returns an array of elements.
     */
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


    /**
     * Returns all selectors from all CSS rules which apply for the given
     * set of elements.
     * Example: Returns ['.foo', '.bar', '.baz'] for element <div class="bar">
     * if there is a CSS rule .foo, .bar, .baz { color: red }
     * @param  {Array} elements An array of elements.
     * @return {Array}          Returns an array of CSS selector strings.
     */
    function getAllSelectorsFor(elements) {
        var rules = elements.map(_getMatchingRules).filter(_nonEmptyRules);

        // flatten array: [[1,2,3],[4],[5,6]] => [1,2,3,4,5,6]
        rules = concat.apply([], rules);

        return rules
            .reduce(_toSelectors, [])
            .filter(_duplicates)
            .reduce(_toSingleSelectors, [])
            .filter(_duplicates);
    }


    /**
     * Returns only the matching selectors of a set of selectors and elements.
     * Example: returns ['.bar'] when given ['.foo', '.bar', '.baz'] and
     * <div class="bar">
     * @param  {Array} elements  An array of elements to check the selectors
     *                           against.
     * @param  {Array} selectors An array of selectors which might not all match
     *                           the set of elements.
     * @return {Array}           Returns an array of only the selectors
     *                           which match agains the given set of elements.
     */
    function getCriticalSelectors(elements, selectors) {
        var critical    = [],
            element     = null,
            selector    = '',
            elSelector  = '',
            match       = null,
            rePseudo    = /::?(before|after)/i;

        // loop over all elements and all selectors to only get
        // the selectors for which are elements present.
        for (var i = 0, l = elements.length; i < l; i += 1) {
            element = elements[i];

            for (var j = 0, k = selectors.length; j < k; j += 1) {
                selector   = selectors[j];
                elSelector = selector;
                match      = rePseudo.exec(selector);

                // because we're using Element.matches we need to remove
                // pseudo elements from the selector string used in
                // Element.matches.
                if (match) {
                    elSelector = selector.slice(0, match.index);
                }
                // but push selector instead of elSelector into the
                // returned array.
                if (element.matches(elSelector)) {
                    critical.push(selector);
                }
            }
        }
        return critical.filter(_duplicates);
    }


    var elements          = getElementsInViewport(),
        selectors         = getAllSelectorsFor(elements),
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
