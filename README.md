# physics-debug-renderer
Web renderer using three.js to draw debug geometry over a web socket protocol, with a tiny web server in Deno to serve the project files and dependnecies. Intended to use for drawing the debug geometry generated by physics engines like Bullet or PhysX.

# Project structure
The project has two main parts, the web server for serving files, and the web browser renderer for actual rendering.

## Web server
The first part is a small web server running on Deno to serve the renderer files and the static dependencies locally, with the entry point for this program being in [main.js](main.js). It's very basic and it piggy backs on the std lib's HttpServer and URLPattern objects.

## Web browser renderer
The second part is the actual web renderer that runs on the browser, defined in the [static/index.html](static/index.html) and [static/index.js](static/index.js) files.

![Image of the web renderer on its default scene](/docs/running.png)

It's composed of a three.js scene, a web socket that polls for new geometry at a specified interval, and a protocol between the web browser and the web socket server emitting the geometry that is used to send over basic shapes (lines, cubes, etc) with colors.

The renderer polls each frame for the geometry, diffs it with the current scene, and adds/removes the primitives accordingly. Since both Bullet and PhysX all send all geometry each frame on their debug rendering interfaces, this renderer is designed around that fact.
