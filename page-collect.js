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
 * Requires jQuery 1.5+
 */
function pageCollect(nextLinkSelector, contentSelector) {
  var $ = typeof(jQuery) == "function" ? jQuery : typeof($) == "function" ? $ : undefined,
      results = [],
      context = {url: window.location.href},
      deferred;

  (function assertPreReqsSatisfied() {
    if(!($ && $.fn && $.fn.jquery)) throw "jQuery not loaded";
    if($.fn.jquery < "1.5") throw "jQuery 1.5+ required, version "+ $.fn.jquery +" is loaded";
  })();

  function debug() {
    if(typeof(console) != 'undefined' && console.debug) {
      console.debug.apply(console, Array.prototype.slice.call(arguments));
    }
  }

  function error() {
    if(typeof(console) != 'undefined' && console.error) {
      console.error.apply(console, Array.prototype.slice.call(arguments));
    }
    deferred.reject(msg);
  }

  // Ordinary jquery get, except for stripping the X-Requested-With header,
  // since some sites behave strangely when that header is set.
  function get(url) {
    debug("fetching page: "+ url);
    return $.ajax({
      method: 'GET',
      url: url,
      xhr: function() {
          var xhr = jQuery.ajaxSettings.xhr();
          var setRequestHeader = xhr.setRequestHeader;
          xhr.setRequestHeader = function(name, value) {
              if (name == 'X-Requested-With') return;
              setRequestHeader.call(this, name, value);
          }
          return xhr;
      }
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

    try {
      data = contentSelector(doc, context)
      results.push(data);
    } catch(err){
      error(err);
    }

    try {
      url = nextLinkSelector(doc, context);
      if(typeof(url) != "string") url = url[0];
    } catch(err){
      error(err);
    }

    if(url) {
      context.url = url;
      get(url).success(processAjaxPage).fail(function(xhr, kind, msg){
        error({type: kind, reason: msg});
      });
    } else {
      results = [].concat.apply([], results);  // flatten array
      deferred.resolve(results);
    }
  }

  // Convert css selectors to function to simplify branching logic later on.
  // E.g. ".foo|bar" where '.foo' becomes the filter and 'bar' the attribute
  // to extract on matched elements.
  function normalizeSelector(name, selector) {
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
          return $(filter, doc).map(function() {
            if(attr == 'text') {
              return $(this).text();
            } else if(attr == 'html') {
              return $(this).html();
            } else {
              return $(this).attr(attr);
            }
          }).get();
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

  deferred = $.Deferred();
  nextLinkSelector = normalizeSelector('nextLinkSelector', nextLinkSelector);
  contentSelector  = normalizeSelector('contentSelector', contentSelector);
  process(window.document);
  return deferred.promise();
}
