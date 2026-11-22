package com.officialknightly.chesstopper.mobile;

import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;
import android.content.Context;
import android.content.ClipboardManager;
import android.content.ClipData;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "ChessTopperMobile")
public class ChessTopperMobilePlugin extends Plugin {
    private static final String PREFS = "chesstopper_mobile";
    private static final String SERVICE_NAME = ChessTopperAccessibilityService.class.getName();
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private Map<String, Object> gameDefaults() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled", true);
        m.put("depth", 18);
        m.put("showBestMove", false);
        m.put("showOpponentBestMove", false);
        m.put("showAltArrows", false);
        m.put("autoMove", false);
        m.put("instantMove", false);
        m.put("autoMoveDelayMin", 0.1f);
        m.put("autoMoveDelayMax", 0.3f);
        m.put("renderMode", "overlay");
        m.put("playerColor", "auto");
        m.put("showMoveIcon", false);
        m.put("smartTiming", true);
        m.put("autoRematch", false);
        m.put("autoNewGame", false);
        m.put("stealthMode", true);
        m.put("wlBalance", false);
        m.put("maxConsecutiveWins", 2);
        m.put("maxConsecutiveLosses", 3);
        m.put("throwRandom", false);
        m.put("lossRandom", false);
        m.put("targetAccuracy", 100);
        return m;
    }

    private Map<String, Object> engineDefaults() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("skillLevel", 20);
        m.put("limitStrength", false);
        m.put("elo", 1500);
        m.put("threads", 2);
        m.put("hash", 256);
        return m;
    }

    private JSObject settings(String scope) {
        Map<String, Object> defaults = "game".equals(scope) ? gameDefaults() : engineDefaults();
        JSObject result = new JSObject();
        Map<String, ?> all = prefs().getAll();
        for (Map.Entry<String, Object> entry : defaults.entrySet()) {
            Object value = all.get(scope + "." + entry.getKey());
            if (value == null) value = entry.getValue();
            result.put(entry.getKey(), value);
        }
        return result;
    }

    private Object coerceSetting(String scope, String key, Object value) {
        Object fallback = ("game".equals(scope) ? gameDefaults() : engineDefaults()).get(key);
        if (fallback instanceof Boolean) return value instanceof Boolean ? value : Boolean.parseBoolean(String.valueOf(value));
        if (fallback instanceof Integer) {
            if (value instanceof Number) return ((Number) value).intValue();
            try { return Integer.parseInt(String.valueOf(value)); } catch (Exception ignored) { return fallback; }
        }
        if (fallback instanceof Float || fallback instanceof Double) {
            if (value instanceof Number) return ((Number) value).floatValue();
            try { return Float.parseFloat(String.valueOf(value)); } catch (Exception ignored) { return fallback; }
        }
        return value == null ? fallback : String.valueOf(value);
    }

    private void writeValue(SharedPreferences.Editor editor, String key, Object value) {
        if (value instanceof Boolean) editor.putBoolean(key, (Boolean) value);
        else if (value instanceof Integer) editor.putInt(key, (Integer) value);
        else if (value instanceof Long) editor.putLong(key, (Long) value);
        else if (value instanceof Number) editor.putFloat(key, ((Number) value).floatValue());
        else if (value != null) editor.putString(key, String.valueOf(value));
    }

    @PluginMethod
    public void getGameSettings(PluginCall call) { call.resolve(settings("game")); }

    @PluginMethod
    public void getEngineSettings(PluginCall call) { call.resolve(settings("engine")); }

    @PluginMethod
    public void setGameOption(PluginCall call) { setOption(call, "game"); }

    @PluginMethod
    public void setEngineOption(PluginCall call) { setOption(call, "engine"); }

    private void setOption(PluginCall call, String scope) {
        String key = call.getString("key");
        if (key == null) { call.reject("A setting key is required."); return; }
        Map<String, Object> defaults = "game".equals(scope) ? gameDefaults() : engineDefaults();
        if (!defaults.containsKey(key)) { call.reject("Unknown setting."); return; }
        Object incoming = call.getData().opt("value");
        Object value = coerceSetting(scope, key, incoming);
        prefs().edit().putString("last_setting_write", scope + "." + key).apply();
        SharedPreferences.Editor editor = prefs().edit();
        writeValue(editor, scope + "." + key, value);
        editor.apply();
        call.resolve(settings(scope));
    }

    @PluginMethod
    public void getSidebarShortcuts(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ids", new JSArray(readArray("shortcuts", "[\"engine.elo\",\"game.depth\"]")));
        call.resolve(result);
    }

    @PluginMethod
    public void setSidebarShortcuts(PluginCall call) {
        JSONArray incoming = call.getData().optJSONArray("ids");
        JSONArray cleaned = new JSONArray();
        if (incoming != null) {
            for (int i = 0; i < incoming.length(); i++) {
                String id = incoming.optString(i, "");
                if (isAllowedShortcut(id) && !contains(cleaned, id)) cleaned.put(id);
            }
        }
        prefs().edit().putString("shortcuts", cleaned.toString()).apply();
        JSObject result = new JSObject();
        result.put("ids", toJsArray(cleaned));
        call.resolve(result);
    }

    private boolean isAllowedShortcut(String id) {
        if (id == null || id.length() > 80) return false;
        return gameDefaults().containsKey(id.startsWith("game.") ? id.substring(5) : "")
            && id.startsWith("game.")
            || engineDefaults().containsKey(id.startsWith("engine.") ? id.substring(7) : "")
            && id.startsWith("engine.");
    }

    private boolean contains(JSONArray array, String value) {
        for (int i = 0; i < array.length(); i++) if (value.equals(array.optString(i))) return true;
        return false;
    }

    private JSArray toJsArray(JSONArray source) {
        JSArray result = new JSArray();
        if (source != null) {
            for (int i = 0; i < source.length(); i++) result.put(source.opt(i));
        }
        return result;
    }

    private JSONArray readArray(String key, String fallback) {
        try { return new JSONArray(prefs().getString(key, fallback)); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> resolved = pm.queryIntentActivities(intent, 0);
            Map<String, JSObject> apps = new LinkedHashMap<>();
            String ownPackage = getContext().getPackageName();
            for (ResolveInfo item : resolved) {
                if (item.activityInfo == null) continue;
                String packageName = item.activityInfo.packageName;
                if (ownPackage.equals(packageName) || apps.containsKey(packageName)) continue;
                CharSequence label = item.loadLabel(pm);
                JSObject app = new JSObject();
                app.put("label", label == null ? packageName : label.toString());
                app.put("packageName", packageName);
                apps.put(packageName, app);
            }
            List<JSObject> sorted = new ArrayList<>(apps.values());
            Collections.sort(sorted, (a, b) -> a.optString("label").compareToIgnoreCase(b.optString("label")));
            JSArray array = new JSArray();
            for (JSObject app : sorted) array.put(app);
            JSObject result = new JSObject();
            result.put("apps", array);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not list installed apps.", error);
        }
    }

    @PluginMethod
    public void getSelectedApps(PluginCall call) {
        JSObject result = new JSObject();
        result.put("packages", new JSArray(readArray("selected_apps", "[\"com.chess\",\"org.lichess.mobileV2\"]")));
        call.resolve(result);
    }

    @PluginMethod
    public void setSelectedApps(PluginCall call) {
        JSONArray incoming = call.getData().optJSONArray("packages");
        JSONArray cleaned = new JSONArray();
        if (incoming != null) {
            for (int i = 0; i < incoming.length(); i++) {
                String packageName = incoming.optString(i, "");
                if (!packageName.isEmpty() && packageName.length() < 255 && !contains(cleaned, packageName)) cleaned.put(packageName);
            }
        }
        prefs().edit().putString("selected_apps", cleaned.toString()).apply();
        JSObject result = new JSObject();
        result.put("packages", new JSArray(cleaned));
        call.resolve(result);
    }

    private boolean accessibilityEnabled() {
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabled == null) return false;
        String flat = new ComponentName(getContext(), ChessTopperAccessibilityService.class).flattenToString();
        return enabled.toLowerCase().contains(flat.toLowerCase());
    }

    private JSObject overlayState() {
        JSObject state = new JSObject();
        state.put("enabled", prefs().getBoolean("overlay_enabled", false));
        state.put("accessibilityEnabled", accessibilityEnabled());
        return state;
    }

    @PluginMethod
    public void getOverlayState(PluginCall call) { call.resolve(overlayState()); }

    @PluginMethod
    public void setOverlayEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        prefs().edit().putBoolean("overlay_enabled", enabled).apply();
        call.resolve(overlayState());
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open Android Accessibility settings.", error);
        }
    }

    @PluginMethod
    public void getCurrentTarget(PluginCall call) {
        String packageName = prefs().getString("foreground_package", "");
        JSObject result = new JSObject();
        if (!packageName.isEmpty()) {
            JSObject target = new JSObject();
            target.put("packageName", packageName);
            try {
                ApplicationInfo info = getContext().getPackageManager().getApplicationInfo(packageName, 0);
                target.put("label", getContext().getPackageManager().getApplicationLabel(info).toString());
            } catch (Exception ignored) { target.put("label", packageName); }
            result.put("target", target);
        } else {
            result.put("target", JSONObject.NULL);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean enabled = prefs().getBoolean("overlay_enabled", false);
        result.put("stockfishOk", false);
        result.put("stockfishState", "idle");
        result.put("overlayOk", enabled && accessibilityEnabled());
        result.put("extensionConnected", false);
        result.put("extensionUpdateAvailable", false);
        result.put("chessConnected", false);
        result.put("chessSite", JSONObject.NULL);
        result.put("message", enabled ? "" : "Choose an app and enable the floating controls in Setup.");
        call.resolve(result);
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("A URL is required."); return; }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open that link.", error);
        }
    }

    @PluginMethod
    public void copyText(PluginCall call) {
        String text = call.getString("text", "");
        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) clipboard.setPrimaryClip(ClipData.newPlainText("Chess Topper", text));
        call.resolve();
    }
}
