package com.byomar.videosflamencos;

import fi.iki.elonen.NanoHTTPD;
import java.io.InputStream;
import java.util.UUID;

/** Device-only transport: Android's media loader can make real HTTP range requests. */
final class MediaHttpServer extends NanoHTTPD {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    interface Resolver { Opened open(String token) throws Exception; }
    static final class Opened {
        final InputStream stream;
        final long size;
        final String mime;
        Opened(InputStream stream, long size, String mime) {
            this.stream = stream; this.size = size; this.mime = mime;
        }
    }
    private final String secret = UUID.randomUUID().toString();
    private final Resolver resolver;
    private volatile String lastError = "";

    MediaHttpServer(Resolver resolver) { super("127.0.0.1", 0); this.resolver = resolver; }
    String url(String token) { return "http://127.0.0.1:" + getListeningPort() + "/" + secret + "/media/" + token; }
    boolean owns(String url) { return url.startsWith("http://127.0.0.1:" + getListeningPort() + "/" + secret + "/media/"); }
    String lastError() { return lastError; }

    private Response headers(Response response) {
        response.addHeader("Access-Control-Allow-Origin", ORIGIN);
        response.addHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        response.addHeader("Access-Control-Allow-Headers", "Range");
        response.addHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
        response.addHeader("Access-Control-Allow-Private-Network", "true");
        response.addHeader("Cache-Control", "no-store");
        return response;
    }

    private Response error(Response.Status status) {
        return headers(newFixedLengthResponse(status, "text/plain", ""));
    }

    @Override public Response serve(IHTTPSession session) {
        String prefix = "/" + secret + "/media/";
        String path = session.getUri();
        if (!path.startsWith(prefix)) return error(Response.Status.NOT_FOUND);
        String token = path.substring(prefix.length());
        if (!token.matches("[a-f0-9-]{36}")) return error(Response.Status.NOT_FOUND);
        if (session.getMethod() == Method.OPTIONS) return headers(newFixedLengthResponse(""));
        if (session.getMethod() != Method.GET && session.getMethod() != Method.HEAD)
            return error(Response.Status.METHOD_NOT_ALLOWED);
        InputStream input = null;
        try {
            Opened file = resolver.open(token);
            input = file.stream;
            String rangeHeader = session.getHeaders().get("range");
            ByteRange range = null;
            if (rangeHeader != null && file.size >= 0) {
                try { range = ByteRange.parse(rangeHeader, file.size); }
                catch (IllegalArgumentException invalid) {
                    input.close(); input = null;
                    Response response = error(Response.Status.RANGE_NOT_SATISFIABLE);
                    response.addHeader("Content-Range", "bytes */" + file.size);
                    return response;
                }
            }
            long length = file.size;
            if (range != null) { MediaStream.skipFully(input, range.start); length = range.length(); }
            MediaStream body = new MediaStream(input, length);
            Response.Status status = range == null ? Response.Status.OK : Response.Status.PARTIAL_CONTENT;
            Response response = length >= 0 ? newFixedLengthResponse(status, file.mime, body, length)
                    : newChunkedResponse(status, file.mime, body);
            input = null; // Response owns and closes the stream.
            if (file.size >= 0) response.addHeader("Accept-Ranges", "bytes");
            if (range != null) response.addHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + file.size);
            lastError = "";
            return headers(response);
        } catch (Exception failure) {
            lastError = failure.getClass().getSimpleName() + ": " + String.valueOf(failure.getMessage());
            return error(failure instanceof SecurityException ? Response.Status.FORBIDDEN : Response.Status.NOT_FOUND);
        } finally {
            if (input != null) try { input.close(); } catch (Exception ignored) { }
        }
    }
}
