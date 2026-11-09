package com.byomar.videosflamencos;

import android.app.Instrumentation;
import android.content.Intent;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class VideoPlaybackTest {
    @Test public void androidWebViewPlaysAndSeeksActualH264Video() throws Exception {
        Instrumentation instrument = InstrumentationRegistry.getInstrumentation();
        byte[] video;
        try (InputStream in = instrument.getContext().getAssets().open("playback-smoke.mp4");
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192]; int count;
            while ((count = in.read(chunk)) >= 0) out.write(chunk, 0, count);
            video = out.toByteArray();
        }
        MediaHttpServer server = new MediaHttpServer(token ->
                new MediaHttpServer.Opened(new ByteArrayInputStream(video), video.length, "video/mp4"));
        server.start(10000, true);
        MainActivity activity = (MainActivity)instrument.startActivitySync(new Intent(
                instrument.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>("Timed out");
        AtomicReference<WebView> browser = new AtomicReference<>();
        try {
            instrument.runOnMainSync(() -> {
                WebView view = new WebView(activity); browser.set(view);
                view.getSettings().setJavaScriptEnabled(true);
                view.getSettings().setMediaPlaybackRequiresUserGesture(false);
                view.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                view.setWebChromeClient(new WebChromeClient() {
                    @Override public void onReceivedTitle(WebView web, String title) {
                        if (title.startsWith("PASS") || title.startsWith("FAIL")) {
                            result.set(title); done.countDown();
                        }
                    }
                });
                activity.setContentView(view);
                String url = server.url("11111111-2222-3333-4444-555555555555");
                String html = "<html><body><video id='v' crossorigin='anonymous' playsinline src='" + url + "'></video>"
                        + "<script>const v=document.getElementById('v');let jumped=false;"
                        + "v.onerror=()=>document.title='FAIL '+v.error.code+' '+v.error.message;"
                        + "v.oncanplay=()=>v.play().catch(e=>document.title='FAIL '+e.message);"
                        + "v.ontimeupdate=()=>{if(!jumped&&v.currentTime>.2){jumped=true;v.currentTime=2;}"
                        + "else if(jumped&&v.currentTime>2.2){document.title='PASS playback and seek';v.pause();}};"
                        + "</script></body></html>";
                view.loadDataWithBaseURL(MediaHttpServer.ORIGIN + "/", html, "text/html", "UTF-8", null);
            });
            assertTrue("Android video test: " + result.get(), done.await(60, TimeUnit.SECONDS));
            assertEquals("PASS playback and seek", result.get());
        } finally {
            instrument.runOnMainSync(() -> {
                if (browser.get() != null) browser.get().destroy();
                activity.finish();
            });
            server.stop();
        }
    }
}
