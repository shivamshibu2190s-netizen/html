package com.bachelor.expensemanager;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SharedPreferences prefs;
    private static final String PREF_SERVER_URL = "server_url";
    private static final String DEFAULT_SERVER_URL = "http://10.230.121.108:3001";

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences("bem_prefs", MODE_PRIVATE);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Native Android Bridge for A4 Bill Printing & App Controls
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidApp");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // If remote server cannot be reached, offer to load local bundle or edit IP
                showConnectionErrorDialog(failingUrl);
            }
        });

        loadAppUrl();
    }

    private void loadAppUrl() {
        String savedUrl = prefs.getString(PREF_SERVER_URL, DEFAULT_SERVER_URL);
        if (savedUrl != null && !savedUrl.isEmpty()) {
            webView.loadUrl(savedUrl);
        } else {
            // Load bundled local assets
            webView.loadUrl("file:///android_asset/www/index.html");
        }
    }

    private void showConnectionErrorDialog(String failingUrl) {
        new AlertDialog.Builder(this)
                .setTitle("Flat Server Connection")
                .setMessage("Could not connect to:\n" + failingUrl + "\n\nEnsure your laptop server is running (`node server.js`) and both devices are on the same flat Wi-Fi.")
                .setPositiveButton("Change Server IP", (dialog, which) -> showChangeServerDialog())
                .setNeutralButton("Load Offline Mode", (dialog, which) -> webView.loadUrl("file:///android_asset/www/index.html"))
                .setNegativeButton("Retry", (dialog, which) -> webView.reload())
                .setCancelable(false)
                .show();
    }

    public void showChangeServerDialog() {
        final EditText input = new EditText(this);
        input.setHint("e.g. http://192.168.1.15:3001");
        String curUrl = prefs.getString(PREF_SERVER_URL, DEFAULT_SERVER_URL);
        input.setText(curUrl);

        new AlertDialog.Builder(this)
                .setTitle("Configure Roommate Server IP")
                .setMessage("Enter your flat server address:")
                .setView(input)
                .setPositiveButton("Save & Connect", (dialog, which) -> {
                    String newUrl = input.getText().toString().trim();
                    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
                        newUrl = "http://" + newUrl;
                    }
                    prefs.edit().putString(PREF_SERVER_URL, newUrl).apply();
                    webView.loadUrl(newUrl);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    // JavaScript interface to trigger native Android printing from the web app
    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void printBill() {
            runOnUiThread(() -> {
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                String jobName = "Bachelor_Flat_Rent_and_Electricity_Bill";
                PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
                if (printManager != null) {
                    printManager.print(jobName, printAdapter, new PrintAttributes.Builder()
                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                            .build());
                }
            });
        }

        @JavascriptInterface
        public void changeServer() {
            runOnUiThread(() -> showChangeServerDialog());
        }

        @JavascriptInterface
        public void showToast(String message) {
            Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
