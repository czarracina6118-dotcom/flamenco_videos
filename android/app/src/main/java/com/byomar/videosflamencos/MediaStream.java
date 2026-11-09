package com.byomar.videosflamencos;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;

/** Limits reads to a range and seeks without allocating a video-sized byte array. */
final class MediaStream extends FilterInputStream {
    private long remaining;
    MediaStream(InputStream source, long remaining) { super(source); this.remaining = remaining; }
    static void skipFully(InputStream source, long offset) throws IOException {
        while (offset > 0) {
            long skipped = source.skip(offset);
            if (skipped > 0) offset -= skipped;
            else if (source.read() == -1) throw new IOException("Video truncated");
            else offset--;
        }
    }
    @Override public int read() throws IOException {
        if (remaining == 0) return -1;
        int value = super.read();
        if (value >= 0 && remaining > 0) remaining--;
        return value;
    }
    @Override public int read(byte[] data, int offset, int length) throws IOException {
        if (length == 0) return 0;
        if (remaining == 0) return -1;
        int count = super.read(data, offset, remaining < 0 ? length : (int)Math.min(length, remaining));
        if (count > 0 && remaining > 0) remaining -= count;
        return count;
    }
}
