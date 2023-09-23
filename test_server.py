from http.server import HTTPServer, BaseHTTPRequestHandler

def include(filename):
    with open(filename, encoding='utf8') as f:
        return f.read()


def create_doc(page:int, max_pages:int) -> str:
    nextLink = f'href="/page/{page+1}"' if page < max_pages else ''
    prevLink = f'href="/page/{page-1}"' if page > 1 else ''

    return ("""<!DOCTYPE html>
<html>
    <head>
        <style>
            /* body, #out, button { background:black; color:white; } */
            body {margin-left: 1rem; font-family: verdana}
            nav, div, button { margin-top: 1rem; }
            #out { width: 8rem; height: 5rem; }
            label { width: 9em; display: inline-block; }
            input { width: 8rem }
            button { cursor: pointer; margin-left: 9.3rem; }
        </style>
    """

    f"""<script>{include('page-collect.js')}</script>"""

    """
        <script>
            const $ = (expr) => document.querySelector(expr);

            async function collectItems() {
                const nextFilter = $('#next-filter').value;
                const contentFilter = $('#content-filter').value;

                const items = await pageCollect(nextFilter, contentFilter);

                console.debug('Found the following items:', items);
                $('#out').value = JSON.stringify(items, null, 2);
            }

            window.addEventListener('load', () => {
                document.querySelector('button').addEventListener('click', collectItems);
                $('#out').value = '';
            });
        </script>
    </head>"""

    f"""
    <body>
        <nav>[ <a rel="prev" {prevLink}>prev</a>,
               <a rel="next" {nextLink}>next</a> ]
        </nav>

        <div class="content">Page {page}</div>

        <div>
            <label for="out">Collected results</label>
            <textarea id="out"></textarea>
            </div>
        <div>
            <label for="next-filter">Next filter</label>
            <input type="text" id="next-filter" name="next-filter" value="a[rel=next]|href"></input>
        </div>
        <div>
            <label for="content-filter">Content filter</label>
            <input type="text" id="content-filter" name="content-filter" value=".content|text"></input>
        </div>

        <button>Collect items</button>
    </body>
</html>
    """)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        page = 1
        if self.path.startswith("/page/"):
            s = self.path.split("/")[-1]
            if s.isnumeric():
                page = int(s)

        self.send_response(200)
        self.send_header("content-type", "text/html")
        self.end_headers()
        self.wfile.write(create_doc(page, 3).encode('utf8'))


def serve(port):
    print("Listening on port", port)
    httpd = HTTPServer(('', port), Handler)
    httpd.serve_forever()


if __name__ == "__main__":
    serve(8000)