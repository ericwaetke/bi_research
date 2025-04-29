Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = `.${pathname}`;

  try {
    const file = await Deno.readFile(filePath);
    const contentType = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
    }[filePath.match(/\.\w+$/)?.[0] ?? ""] || "application/octet-stream";

    return new Response(file, {
      headers: { "content-type": contentType },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
});
