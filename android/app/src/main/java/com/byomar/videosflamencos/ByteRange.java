package com.byomar.videosflamencos;

/** One HTTP byte range. Media is streamed, including files larger than 2 GiB. */
final class ByteRange {
    final long start, end;
    ByteRange(long start, long end) { this.start = start; this.end = end; }
    long length() { return end - start + 1; }
    static ByteRange parse(String header, long size) {
        if (size <= 0 || header == null || !header.startsWith("bytes=") || header.contains(","))
            throw new IllegalArgumentException("Unsupported range");
        String[] parts = header.substring(6).trim().split("-", -1);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid range");
        long start, end;
        if (parts[0].isEmpty()) {
            long tail = Long.parseLong(parts[1]);
            if (tail <= 0) throw new IllegalArgumentException("Invalid suffix");
            start = Math.max(0, size - tail); end = size - 1;
        } else {
            start = Long.parseLong(parts[0]);
            end = parts[1].isEmpty() ? size - 1 : Math.min(size - 1, Long.parseLong(parts[1]));
        }
        if (start < 0 || start >= size || end < start) throw new IllegalArgumentException("Outside file");
        return new ByteRange(start, end);
    }
}
