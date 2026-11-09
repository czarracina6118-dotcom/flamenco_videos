package com.byomar.videosflamencos;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int PICK_FOLDER = 100;
    private static final String[] COLUMNS = {
        DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE
    };
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private final Map<String, Document> documents = new ConcurrentHashMap<>();
    private final Map<String, String> tokens = new ConcurrentHashMap<>();
    private WebView webView;
    private MediaHttpServer mediaServer;
    private FrameLayout container;
    private View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private String pendingPicker;
    private volatile boolean destroyed;

    private static final class Document {
        final Uri tree, uri;
        final String id, name, mime;
        final long size;
        Document(Uri tree, String id, String name, String mime, long size) {
            this.tree = tree; this.id = id; this.name = name;
            this.mime = mime == null ? "application/octet-stream" : mime; this.size = size;
            this.uri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
        }
        boolean isDirectory() { return DocumentsContract.Document.MIME_TYPE_DIR.equals(mime); }
    }

    private boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        mediaServer = new MediaHttpServer(this::openMedia);
        try { mediaServer.start(10000, true); }
        catch (java.io.IOException error) {
            new AlertDialog.Builder(this).setMessage("No se pudo iniciar el lector local de vídeos.")
                    .setPositiveButton("Cerrar", (dialog, which) -> finish()).show();
            return;
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        container = new FrameLayout(this);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        // Only the registered loopback media URLs are passed through to the network loader.
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.addJavascriptInterface(new FileBridge(), "AndroidFiles");
        container.setOnApplyWindowInsetsListener((view, insets) -> {
            if (fullscreen == null) view.setPadding(insets.getSystemWindowInsetLeft(),
                    insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(),
                    insets.getSystemWindowInsetBottom());
            else view.setPadding(0, 0, 0, 0);
            return insets;
        });
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (mediaServer.owns(request.getUrl().toString())) return null;
                if (!isLocal(request.getUrl())) return empty(403, "Forbidden", null);
                WebResourceResponse asset = loader.shouldInterceptRequest(request.getUrl());
                return asset != null ? asset : empty(404, "Not Found", null);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Only bundled HTML may navigate the page that owns the native bridge.
                return !isLocal(request.getUrl()) || !request.getUrl().getPath().startsWith("/assets/");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreen != null) { callback.onCustomViewHidden(); return; }
                fullscreen = view; fullscreenCallback = callback;
                container.addView(view, new FrameLayout.LayoutParams(-1, -1));
                webView.setVisibility(View.GONE);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                container.requestApplyInsets();
            }
            @Override public void onHideCustomView() { hideFullscreen(); }
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("Vídeos de guitarra")
                        .setMessage(message).setPositiveButton("Aceptar", (dialog, which) -> result.confirm())
                        .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
        container.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(container);
        webView.loadUrl("https://" + HOST + "/assets/index.html");
    }

    private void hideFullscreen() {
        if (fullscreen == null) return;
        container.removeView(fullscreen); fullscreen = null;
        webView.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(0);
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null; container.requestApplyInsets();
    }

    private JSONObject register(Document doc) throws Exception {
        String token = tokens.computeIfAbsent(doc.uri.toString(), key -> UUID.randomUUID().toString());
        documents.put(token, doc);
        return new JSONObject().put("id", token).put("name", doc.name)
                .put("kind", doc.isDirectory() ? "directory" : "file")
                .put("mime", doc.mime).put("size", doc.size)
                .put("mediaUrl", doc.isDirectory() ? JSONObject.NULL : mediaServer.url(token));
    }

    private Document readRow(Uri tree, Cursor cursor) {
        return new Document(tree, cursor.getString(0), cursor.getString(1), cursor.getString(2),
                cursor.isNull(3) ? -1 : cursor.getLong(3));
    }

    private JSONObject rootInfo(Uri tree) throws Exception {
        if (!"content".equals(tree.getScheme()) || !DocumentsContract.isTreeUri(tree))
            throw new IllegalArgumentException("Selecciona una carpeta de documentos");
        Uri uri = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        try (Cursor cursor = getContentResolver().query(uri, COLUMNS, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) throw new Exception("La carpeta ya no está disponible");
            Document doc = readRow(tree, cursor);
            if (!doc.isDirectory()) throw new Exception("Selecciona una carpeta");
            return register(doc);
        }
    }

    private Document document(String token) throws Exception {
        Document doc = documents.get(token);
        if (doc == null) throw new Exception("Vuelve a seleccionar la carpeta GUITARRA");
        return doc;
    }

    private JSONArray children(String token) throws Exception {
        Document dir = document(token);
        if (!dir.isDirectory()) throw new Exception("El elemento no es una carpeta");
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(dir.tree, dir.id);
        JSONArray result = new JSONArray();
        try (Cursor cursor = getContentResolver().query(children, COLUMNS, null, null, null)) {
            if (cursor == null) throw new Exception("No se pudo leer la carpeta. Selecciónala de nuevo.");
            while (cursor.moveToNext()) result.put(register(readRow(dir.tree, cursor)));
        }
        return result;
    }

    private void complete(String id, Object result, String name, String message) {
        try {
            String error = name == null ? "null" : new JSONObject().put("name", name).put("message", message).toString();
            String json = result == null ? "null" : result.toString();
            String script = "window.NativeFiles&&window.NativeFiles.complete(" + JSONObject.quote(id)
                    + "," + json + "," + error + ");";
            runOnUiThread(() -> { if (!destroyed && webView != null) webView.evaluateJavascript(script, null); });
        } catch (Exception ignored) { /* Activity was closed. */ }
    }

    private void fail(String id, Exception error) {
        String message = error instanceof SecurityException
                ? "Android no ha conservado el permiso. Selecciona de nuevo la carpeta GUITARRA."
                : error.getMessage();
        complete(id, null, "Error", message == null ? "No se pudo abrir el archivo" : message);
    }

    public final class FileBridge {
        @JavascriptInterface public void request(String id, String method, String json) {
            if (destroyed || id == null || !id.matches("[0-9]{1,12}")) return;
            if ("pick".equals(method)) {
                runOnUiThread(() -> {
                    if (destroyed) return;
                    if (pendingPicker != null) { complete(id, null, "Error", "Ya hay un selector abierto"); return; }
                    pendingPicker = id;
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
                    try { startActivityForResult(intent, PICK_FOLDER); }
                    catch (ActivityNotFoundException error) { pendingPicker = null; fail(id, error); }
                });
                return;
            }
            files.execute(() -> {
                try {
                    JSONObject args = new JSONObject(json);
                    if ("restore".equals(method)) {
                        String saved = getPreferences(MODE_PRIVATE).getString("tree", null);
                        complete(id, saved == null ? null : rootInfo(Uri.parse(saved)), null, null);
                    } else if ("diagnostics".equals(method)) {
                        complete(id, new JSONObject().put("error", mediaServer.lastError()), null, null);
                    } else if ("list".equals(method)) {
                        complete(id, children(args.getString("id")), null, null);
                    } else if ("openPdf".equals(method)) {
                        Document doc = document(args.getString("id"));
                        if (doc.isDirectory() || !doc.name.toLowerCase(java.util.Locale.ROOT).endsWith(".pdf"))
                            throw new Exception("El archivo no es un PDF");
                        runOnUiThread(() -> {
                            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(doc.uri, "application/pdf")
                                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            intent.setClipData(ClipData.newRawUri("PDF", doc.uri));
                            try { startActivity(intent); complete(id, JSONObject.NULL, null, null); }
                            catch (ActivityNotFoundException error) {
                                complete(id, null, "Error", "Instala un lector de PDF para abrir esta tablatura");
                            }
                        });
                    } else throw new Exception("Operación no disponible");
                } catch (Exception error) { fail(id, error); }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PICK_FOLDER || pendingPicker == null) return;
        String id = pendingPicker; pendingPicker = null;
        if (result != RESULT_OK || data == null || data.getData() == null) {
            complete(id, null, "AbortError", "Selección cancelada"); return;
        }
        Uri tree = data.getData();
        try { getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION); }
        catch (SecurityException ignored) { /* Some providers only allow access for this session. */ }
        files.execute(() -> {
            try {
                JSONObject info = rootInfo(tree);
                getPreferences(MODE_PRIVATE).edit().putString("tree", tree.toString()).apply();
                complete(id, info, null, null);
            } catch (Exception error) { fail(id, error); }
        });
    }

    private WebResourceResponse empty(int code, String reason, Map<String, String> headers) {
        return new WebResourceResponse("text/plain", "UTF-8", code, reason,
                headers == null ? new HashMap<>() : headers, new ByteArrayInputStream(new byte[0]));
    }

    private MediaHttpServer.Opened openMedia(String token) throws Exception {
        Document doc = document(token);
        if (doc.isDirectory()) throw new Exception("Selecciona un vídeo");
        AssetFileDescriptor descriptor = getContentResolver().openAssetFileDescriptor(doc.uri, "r");
        if (descriptor == null) throw new Exception("Android no pudo abrir el archivo");
        try {
            long size = descriptor.getLength() >= 0 ? descriptor.getLength() : doc.size;
            String extension = doc.name.contains(".") ? doc.name.substring(doc.name.lastIndexOf('.') + 1).toLowerCase(java.util.Locale.ROOT) : "";
            String mime = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if (mime == null) mime = doc.mime;
            return new MediaHttpServer.Opened(descriptor.createInputStream(), size, mime);
        } catch (Exception error) { descriptor.close(); throw error; }
    }

    @Override protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("if(typeof pauseAndroidVideo==='function') pauseAndroidVideo();", null);
            webView.onPause();
        }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }
    @Override public void onBackPressed() {
        if (fullscreen != null) { hideFullscreen(); return; }
        webView.evaluateJavascript("(function(){var p=document.getElementById('playerWrap');"
                + "if(p&&p.classList.contains('show')){document.getElementById('close').click();return true;}return false;})()",
                handled -> { if (!"true".equals(handled)) finish(); });
    }
    @Override protected void onDestroy() {
        destroyed = true;
        files.shutdownNow();
        if (mediaServer != null) mediaServer.stop();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidFiles"); webView.stopLoading(); webView.destroy(); webView = null;
        }
        super.onDestroy();
    }
}
