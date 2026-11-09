package com.byomar.videosflamencos;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;

public class MediaHttpServerTest {
    private static final String TOKEN = "11111111-2222-3333-4444-555555555555";
    private static byte[] read(InputStream stream) throws Exception {
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[1024]; int count;
            while ((count = in.read(buffer)) >= 0) out.write(buffer, 0, count);
            return out.toByteArray();
        }
    }
    private static HttpURLConnection connect(String url, String range) throws Exception {
        HttpURLConnection conn = (HttpURLConnection)new URL(url).openConnection();
        conn.setConnectTimeout(3000); conn.setReadTimeout(3000);
        if (range != null) conn.setRequestProperty("Range", range);
        return conn;
    }
    @Test public void realHttpRequestsCanLoadAndSeekWithoutCorruption() throws Exception {
        byte[] video = new byte[65536];
        for (int i = 0; i < video.length; i++) video[i] = (byte)(i * 31);
        MediaHttpServer server = new MediaHttpServer(token -> {
            if (!TOKEN.equals(token)) throw new SecurityException("Unknown file");
            return new MediaHttpServer.Opened(new ByteArrayInputStream(video), video.length, "video/mp4");
        });
        try {
            server.start(3000, true);
            String url = server.url(TOKEN);
            assertTrue(url.startsWith("http://127.0.0.1:"));
            HttpURLConnection whole = connect(url, null);
            assertEquals(200, whole.getResponseCode());
            assertEquals("video/mp4", whole.getContentType());
            assertEquals(MediaHttpServer.ORIGIN, whole.getHeaderField("Access-Control-Allow-Origin"));
            assertArrayEquals(video, read(whole.getInputStream())); whole.disconnect();
            for (int start : new int[]{48000, 0, 32000, 1200, 63000}) {
                int end = start + 1023;
                HttpURLConnection part = connect(url, "bytes=" + start + "-" + end);
                assertEquals(206, part.getResponseCode());
                assertEquals("bytes " + start + "-" + end + "/65536", part.getHeaderField("Content-Range"));
                assertArrayEquals(Arrays.copyOfRange(video, start, end + 1), read(part.getInputStream())); part.disconnect();
            }
            HttpURLConnection bad = connect(url, "bytes=65536-");
            assertEquals(416, bad.getResponseCode()); bad.disconnect();
            HttpURLConnection secret = connect("http://127.0.0.1:" + server.getListeningPort() + "/media/" + TOKEN, null);
            assertEquals(404, secret.getResponseCode()); secret.disconnect();
        } finally { server.stop(); }
    }
    @Test public void headAndSuffixRequestsWork() throws Exception {
        MediaHttpServer server = new MediaHttpServer(token ->
                new MediaHttpServer.Opened(new ByteArrayInputStream(new byte[]{10,20,30,40}), 4, "video/mp4"));
        try {
            server.start(3000, true);
            HttpURLConnection head = connect(server.url(TOKEN), null); head.setRequestMethod("HEAD");
            assertEquals(200, head.getResponseCode()); assertEquals(4, head.getContentLength());
            assertEquals(0, read(head.getInputStream()).length); head.disconnect();
            HttpURLConnection tail = connect(server.url(TOKEN), "bytes=-2");
            assertEquals(206, tail.getResponseCode());
            assertArrayEquals(new byte[]{30,40}, read(tail.getInputStream())); tail.disconnect();
        } finally { server.stop(); }
    }
}
