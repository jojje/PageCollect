/**
 * pageCollect - Navigates and extracts data from a set of linked pages
 *
 * Copyright (C) 2015 Jonas Tingeborn
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

/**
 * pageCollect extracts items from a set of linked pages.
 *
 * Refer to the README for specification and usage examples.
 *
 * Arguments:
 *   * `nextUrlSelector`: CSS expression or a user defined function `f(Document): url[] | undefined`
 *                        that returns an array of url strings of which the first is used to find the next
 *                        page to process. If no url is found return a falsy value (empty array, nil, undefined).
 *   * `contentSelector`: CSS expression or a user defined function `f(Document): item[]` that returns
 *                        an array of items from a DOM Document.
 *   * `options`:         Optional configuration object with the following settings:
 *                          - skipCurrent: when set omits the items from the current (start) page.
 *                          - callback: a progress callback function that will be provided the current page
 *                                      number as the collector fetches pages to process.
 *
 * Returns:
 *   a Promise that resolves an Array of all items extracted.
 */
async function pageCollect(nextUrlSelector, contentSelector, options) {
    options = Object.assign(options || {}, {
        skipCurrent: false,
        progressCallback: (pageNo) => undefined,
    });

    // convert the raw HTML from an Ajax-request to a DOM object that css expressions can be applied to.
    const toDoc = (html) => new DOMParser().parseFromString(html, "text/html");
    const $c = (expr, root) => Array.from((root || window.document).querySelectorAll(expr));

    const fetched = new Set([document.location.href]); // guard to ensure we don't fetch the same page twice

    function debug(...args) {
        if (typeof console !== "undefined" && console.debug) {
            console.debug("[pageCollect]", ...args);
        }
    }

    function toAbsoluteUrl(uri) {
        if (/^(https?:\/\/)/.test(uri)) return uri; // already absolute url
        return new URL(uri, window.location.href).href;
    }

    // XHR-Get of a page, that strips the X-Requested-With header,
    // since some sites behave strangely when that header is set.
    async function fetchPage(url) {
        url = toAbsoluteUrl(url);
        return new Promise((resolve, reject) => {
            if (fetched.has(url)) {
                reject(`Stopping early to avoid infinite loop, since the url has already been fetched: $c{url}`);
                return;
            }
            debug("fetching page:", url);

            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    fetched.add(url);
                    resolve(this.response);
                } else {
                    reject(this.statusText);
                }
            };
            xhr.onerror = function () {
                console.debug("xhr error");
                reject(this.statusText);
            };
            xhr.open("GET", url);
            xhr.send();
        });
    }

    // Extract content and next-link using the user-defined methods for doing
    // so. Repeat the procedure for each page as long a URL is found pointing
    // to a linked "next-page".
    async function process(doc) {
        function processPage(doc) {
            let elements = contentSelector(doc);
            let url = nextUrlSelector(doc);
            if (typeof url === "object") {
                // if many urls matched, use the first
                url = url[0];
            }
            return [elements, url];
        }

        let [extracted, nextUrl] = processPage(doc);
        if (options.skipCurrent) extracted = [];
        let pageNo = 0;

        while (nextUrl) {
            const doc = await fetchPage(nextUrl).then(toDoc);
            [elements, nextUrl] = processPage(doc);
            extracted = extracted.concat(elements);
            if (options.callback) {
                options.callback(++pageNo);
            }
        }
        return extracted;
    }

    // Ensure selector is always a function. Convert a css string selectors to
    // function if needed in order to simplify branching logic later on.
    //
    // If a function is provided as a selector, that function will be passed a
    // DOM Document as an argument, and is then expected to return whatever data
    // represents the result of an extraction.
    //
    // When the selector is a string, it is regarded as a css expression, with
    // support for extended extraction syntax.
    //
    // The optional extraction extension syntax is:
    //   "<ordinary-css-expression>|<what-to-extract>"
    //
    // If no "|<something>" is provided, then returns the elements matching the
    // css expression, just like Array.from(root.querySelectorAll). If "|" is
    // provided, then extraction rules are as follows:
    //   1. "|text"    : returns <elements>.textContent.trim()
    //   2. "|html"    : returns <elements>.innerHTML.trim()
    //   3. "|<other>" : returns <elements>.getAttribute("<other>")
    ///
    // E.g. ".foo|bar" where '.foo' becomes the css filter and 'bar' the attribute
    // to extract on matched elements.
    function normalizeSelector(name, selector) {
        function createSelectorFunction() {
            let filter, attr, m;

            if ((m = selector.match(/^(.+?)(\s*\|\s*[^|\]]+)?$/))) {
                filter = m[1];
                if (m[2]) {
                    attr = m[2].replace("|", "").trim();
                }
            } else {
                throw selector + " is an invalid CSS selector extraction expression";
            }

            if (attr) {
                return function (doc) {
                    return $c(filter, doc).map((el) => {
                        if (attr == "text") {
                            return el.textContent.trim();
                        } else if (attr == "html") {
                            return el.innerHTML.trim();
                        } else {
                            return el.getAttribute(attr);
                        }
                    });
                };
            } else {
                return function (doc) {
                    return $c(filter, doc);
                };
            }
        }

        if (typeof selector === "function") return selector;
        if (typeof selector === "string" && selector.length > 0) {
            return createSelectorFunction();
        }
        throw name + " is neither a function nor a css selector string";
    }

    nextUrlSelector = normalizeSelector("nextUrlSelector", nextUrlSelector);
    contentSelector = normalizeSelector("contentSelector", contentSelector);

    return process(window.document);
}
