package com.codex.stresssmash;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;
    private boolean backArmed = false;
    private final Handler handler = new Handler();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterImmersiveMode();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(23, 21, 31));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLongClickable(false);
        webView.setHapticFeedbackEnabled(true);
        webView.setContentDescription("压力大爆破打地鼠游戏");

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"file".equals(request.getUrl().getScheme());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(
                    "document.documentElement.classList.add('apk-mode');document.body.classList.add('apk-mode');",
                    null
                );
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript(
            "Boolean(window.StressSmash && window.StressSmash.isAtHome())",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    if ("true".equals(value)) {
                        if (backArmed) {
                            finish();
                        } else {
                            backArmed = true;
                            Toast.makeText(MainActivity.this, "再按一次退出游戏", Toast.LENGTH_SHORT).show();
                            handler.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    backArmed = false;
                                }
                            }, 1800);
                        }
                    } else {
                        webView.evaluateJavascript(
                            "window.StressSmash && window.StressSmash.goHome(false)",
                            null
                        );
                    }
                }
            }
        );
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
        }
        super.onDestroy();
    }
}
