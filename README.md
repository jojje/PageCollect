# Page Collect
Sequentially collects paginated data, data spread over many linked pages.

Abstract
--------
A function mainly intended to simplify data extraction and page navigation tasks for web automation, such as user scripts for browsers, where often all data of interest is not presented on a single page, but spread out (paginated) over a collection of pages.

The function processes the current page, scans it for a link to a following page and repeats the process until the entire paginated set has been processed. Once the last page has been encountered, the data collected from each page is provided as an array to a handler function.

The elements of the array handed to the handler function correspond to the data items extracted during the page traversal.

Pagination collection function
------------------------------
**Signature**: `pageCollect(nextLinkSelector, contentSelector)`  
**Returns**: A jQuery promise ("deferred") object.  
**Arguments**:

* `nextLinkSelector`: Extractor  
  This extractor is expected to return a URL (a string) signifying the next page to process. When the function returns a "falsy" value (false / null / undefined), it is treated as a signal that all pages have been processed, causing the deferred handler to get invoked.

* `contentSelector`: Extractor  
  Responsible for extracting data from the pages. Data returned will be appended to the result array handed over to the promise `done` handler when there are no more pages to process.

_For more information on the Extractor type, see below_

Examples
--------
Extract some data from all paginated pages using CSS selector expressions.
````javascript
pageCollect(".nextlink | href", ".some-content | text")

.done(function(items) {
  console.log("extracted items:", items);
})
.fail(function(err) {
  console.error("Uh Oh, something went wrong", err);
});
````

The same extraction behavior using custom data extraction functions.

````javascript
pageCollect(function(doc) {
  return $(doc).find(".nextlink").attr('href');
}, function(doc) {
  return $(doc).find(".some-content").text();
})

.done(...) .fail(...)
````

Extractor
---------
Data extraction is performed using the notion of an "extractor". An extractor takes the shape of one of two forms; A slightly extended CSS expression or a user provided function. The definition of an extractor is:

    CSS expression | function(element, context)

Extractor as a CSS selector
---------------------------
When in the form of a CSS expression, the expression is applied to the entire document, just like issuing `$(expr, document)`. The _extended_ bit refers to a syntax extension used to communicate *what* to extract from matched
elements.

To declare what attribute to extract from matched elements, the CSS expression is terminated with `|<attribute name>`. If no extraction attribute sub-expression is provided, the extractor will simply return the extracted elements, to be further processed in the user's deferred handler once all pages have been processed.

Examples of expressions and the associated effects:

    a      -> An array of all links on the pages in the paginated set. Same as performing $('a') on a page.
    a|text -> All contained link texts, same as issuing $(el).text() on links.
    a|html -> All contained HTML in the links, same as issuing $(el).html() on each link.
    a|href -> The URLs (strings) of all links in the page set, same as issuing $(el).attr('href') on the links.

Note: The attribute names _text_ and _html_ are the only ones with special meaning. Any other attribute name will result in the equivalent DOM element attribute being used for extraction. I.e. `"a|foo"` is equivalent to `$(el).attr('foo')` being performed on all elements matching the CSS filter expression (the part before the pipe character, `"a"` in this case).

Extractor as a function
-----------------------
For more sophisticated data extraction needs, a user provided function can also be used as an extractor.

**Signature**: `function(element, context)`  
**Arguments**:

* `element`
    The function will be handed a DOM element containing the page elements. Regard this element as the page root node (e.g. document or something similar during background / ajax fetching and collation).

* `context`
    Also provided is a function global object called 'context'. The purpose of this object is to allow sharing of state between the extractor invocations. Each time an extractor is invoked, it will be handed the same object, making it a convenient place to temporarily store information during the data extraction.

    Worth noting is that each time a new page gets processed, the context object's `url` attribute gets set to the URL of the page being processed, which might be handy information to have in certain circumstances.