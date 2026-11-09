package com.byomar.videosflamencos;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.InputStream;

public class StreamingTest {
    @Test public void fullAndOpenEndedRanges() {
        ByteRange part = ByteRange.parse("bytes=20-39", 100);
        assertEquals(20, part.start); assertEquals(39, part.end); assertEquals(20, part.length());
        assertEquals(80, ByteRange.parse("bytes=20-", 100).length());
        assertEquals(99, ByteRange.parse("bytes=0-999", 100).end);
    }
    @Test public void suffixAndLargeVideoRanges() {
        ByteRange tail = ByteRange.parse("bytes=-25", 100);
        assertEquals(75, tail.start); assertEquals(25, tail.length());
        assertEquals(0, ByteRange.parse("bytes=-999", 100).start);
        long size = 5_000_000_000L;
        ByteRange large = ByteRange.parse("bytes=4000000000-", size);
        assertEquals(1_000_000_000L, large.length());
    }
    @Test public void invalidAndOutOfBoundsRangesAreRejected() {
        for (String header : new String[]{"bytes=100-", "bytes=20-10", "bytes=-0", "bytes=0-1,4-5", "bytes=abc-", "bytes=--1"}) {
            try { ByteRange.parse(header, 100); fail(header); }
            catch (IllegalArgumentException expected) { }
        }
    }
    @Test public void onlyRequestedBytesAreReturned() throws Exception {
        byte[] video = new byte[100];
        for (int i = 0; i < video.length; i++) video[i] = (byte)i;
        InputStream source = new ByteArrayInputStream(video);
        MediaStream.skipFully(source, 30);
        try (MediaStream response = new MediaStream(source, 10)) {
            byte[] out = new byte[100];
            assertEquals(10, response.read(out, 0, out.length));
            assertEquals(30, out[0]); assertEquals(39, out[9]);
            assertEquals(-1, response.read());
        }
    }
    @Test public void nonSeekableProviderAndUnknownLength() throws Exception {
        ByteArrayInputStream source = new ByteArrayInputStream(new byte[]{1,2,3,4,5}) {
            @Override public long skip(long count) { return 0; }
        };
        MediaStream.skipFully(source, 2);
        try (MediaStream response = new MediaStream(source, -1)) {
            assertEquals(3, response.read()); assertEquals(4, response.read());
            assertEquals(5, response.read()); assertEquals(-1, response.read());
        }
    }
}
