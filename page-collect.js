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
 *
 *
 * Refer to the README for specification and usage examples.
 */
function pageCollect(nextUrlSelector, contentSelector) {
  return new Promise(function(resolve, reject) {
    var results = [],
        context = {url: window.location.href},
        lastUrl = window.location.href,
        fetched = [
          document.location.href,
          document.location.href.split('/').slice(3).join('/')
        ];


    function debug() {
      if(typeof(console) != 'undefined' && console.debug) {
        console.debug.apply(console, Array.prototype.slice.call(arguments));
      }
    }

    function absoluteUrl(uri) {
      var baseUri = window.location.href.split('/').slice(0,3).join('/'),
          lastBase = lastUrl.split('?')[0];
      if(/^(https?:\/\/)/.test(uri)) return uri;
      if(/^[/]/.test(uri)) return baseUri + uri;
      lastBase = lastBase[lastBase.length-1] == '/' ? lastBase : lastBase + '/';
      return lastBase + uri;
    }

    // Ajax get of a page, that strips the X-Requested-With header,
    // since some sites behave strangely when that header is set.
    function get(url) {
      url = absoluteUrl(url);

      return new Promise(function(resolveGet, rejectGet) {
        if(fetched[url]) {
          debug("Stopping early to avoid infinite loop, since the url has already been fetched: ", url);
          return resolveGet('<html></html>');
        }
        debug("fetching page: "+ url);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.send();
        xhr.onload = function() {
          if (this.status >= 200 && this.status < 300) {
            fetched[url] = true;
            lastUrl = url;
            resolveGet(this.response);
          } else {
            rejectGet(this.statusText);
          }
        };
        xhr.onerror = function () {
          rejectGet(this.statusText);
        };
      });
    }

    // Convert the raw HTML from an Ajax-request to a DOM object the user
    // can more easily operate on.
    function processAjaxPage(html) {
      var parser = new DOMParser(),
          doc = parser.parseFromString(html, 'text/html')
      process(doc);
    }

    // Extract content and next-link using the user-defined methods for doing
    // so, and repeat the procedure for each page as long a URL is found pointing
    // to a linked "next-page".
    function process(doc) {
      var url, data;

      data = contentSelector(doc, context)
      results.push(data);

      url = nextUrlSelector(doc, context);
      if(typeof(url) != "string") url = url[0];

      if(url) {
        context.url = url;
        get(url).then(processAjaxPage);
      } else {
        results = [].concat.apply([], results);  // flatten array
        resolve(results);
      }
    }

    // Convert css selectors to function to simplify branching logic later on.
    // E.g. ".foo|bar" where '.foo' becomes the filter and 'bar' the attribute
    // to extract on matched elements.
    function normalizeSelector(name, selector) {
      function $(expr, doc) {
        var elems = (doc || window.document).querySelectorAll('a');
        return [].slice.apply(elems);
      }

      function createSelectorFunction() {
        var filter, attr, m;

        if(m = selector.match(/^(.+?)(\s*\|\s*[^|\]]+)?$/)) {
          filter = m[1];
          if(m[2]) {
            attr = m[2].replace('|','').trim();
          }
        } else {
          throw name + " is an invalid CSS selector extraction expression";
        }

        if(attr) {
          return function(doc) {
            return $(filter, doc).map(function(el) {
              if(attr == 'text') {
                return el.textContent;
              } else if(attr == 'html') {
                return el.innerHTML;
              } else {
                return el.getAttribute(attr);
              }
            });
          };
        } else {
          return function(doc) {
            return $(filter, doc);
          };
        }
      }

      if(typeof(selector) == 'function') return selector;
      if(typeof(selector) == 'string' && selector.length > 0) {
        return createSelectorFunction();
      }
      throw name + " is neither a function nor a css selector string";
    }

    nextUrlSelector = normalizeSelector('nextUrlSelector', nextUrlSelector);
    contentSelector  = normalizeSelector('contentSelector', contentSelector);
    process(window.document);
  });
}
