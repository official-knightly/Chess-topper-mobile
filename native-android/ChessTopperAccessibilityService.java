package com.officialknightly.chesstopper.mobile;

import android.accessibilityservice.AccessibilityService;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class ChessTopperAccessibilityService extends AccessibilityService {
    private static final String PREFS = "chesstopper_mobile";
    private WindowManager windowManager;
    private LinearLayout root;
    private LinearLayout panel;
    private FrameLayout bubble;
    private WindowManager.LayoutParams layoutParams;
    private boolean added = false;
    private boolean expanded = false;
    private String activePackage = "";

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        if (getServiceInfo() != null) {
            android.accessibilityservice.AccessibilityServiceInfo info = getServiceInfo();
            info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED | AccessibilityEvent.TYPE_WINDOWS_CHANGED;
            info.feedbackType = android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_GENERIC;
            info.notificationTimeout = 120;
            info.flags = 0;
            setServiceInfo(info);
        }
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        refreshOverlay();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        int type = event.getEventType();
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && type != AccessibilityEvent.TYPE_WINDOWS_CHANGED) return;
        CharSequence packageText = event.getPackageName();
        if (packageText == null) return;
        String packageName = packageText.toString();
        if (packageName.isEmpty() || packageName.equals(getPackageName())) {
            hideOverlay();
            return;
        }
        if (!packageName.equals(activePackage)) {
            activePackage = packageName;
            prefs().edit().putString("foreground_package", packageName).apply();
        }
        refreshOverlay();
    }

    @Override
    public void onInterrupt() {
        hideOverlay();
    }

    @Override
    public void onDestroy() {
        hideOverlay();
        super.onDestroy();
    }

    private boolean isSelected(String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;
        try {
            JSONArray selected = new JSONArray(prefs().getString("selected_apps", "[\"com.chess\",\"org.lichess.mobileV2\"]"));
            for (int i = 0; i < selected.length(); i++) {
                if (packageName.equals(selected.optString(i))) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private void refreshOverlay() {
        if (windowManager == null) windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        boolean enabled = prefs().getBoolean("overlay_enabled", false);
        if (enabled && isSelected(activePackage)) showOverlay();
        else hideOverlay();
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable rounded(int color, int radiusDp, int strokeColor) {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(color);
        bg.setCornerRadius(dp(radiusDp));
        if (strokeColor != 0) bg.setStroke(dp(1), strokeColor);
        return bg;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private void showOverlay() {
        if (added) return;
        if (windowManager == null) windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.END);
        root.setPadding(0, 0, 0, 0);

        bubble = new FrameLayout(this);
        bubble.setBackground(rounded(Color.rgb(16, 25, 39), 18, Color.rgb(38, 194, 205)));
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.chess_topper_logo);
        icon.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        FrameLayout.LayoutParams iconParams = new FrameLayout.LayoutParams(dp(42), dp(42), Gravity.CENTER);
        bubble.addView(icon, iconParams);
        bubble.setContentDescription("Open Chess Topper quick settings");
        bubble.setOnClickListener(v -> togglePanel());
        bubble.setOnTouchListener(new View.OnTouchListener() {
            private float downX, downY;
            private int startX, startY;
            private boolean moved;
            @Override public boolean onTouch(View view, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    downX = event.getRawX();
                    downY = event.getRawY();
                    startX = layoutParams.x;
                    startY = layoutParams.y;
                    moved = false;
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    float dx = event.getRawX() - downX;
                    float dy = event.getRawY() - downY;
                    if (Math.abs(dx) + Math.abs(dy) > dp(5)) moved = true;
                    if (moved && layoutParams != null && added) {
                        layoutParams.x = Math.max(0, startX + (int) dx);
                        layoutParams.y = Math.max(dp(24), startY + (int) dy);
                        try { windowManager.updateViewLayout(root, layoutParams); } catch (Exception ignored) {}
                    }
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    if (!moved) togglePanel();
                    return true;
                }
                return true;
            }
        });
        root.addView(bubble, new LinearLayout.LayoutParams(dp(54), dp(54)));

        panel = buildPanel();
        panel.setVisibility(View.GONE);
        LinearLayout.LayoutParams panelParams = new LinearLayout.LayoutParams(dp(276), WindowManager.LayoutParams.WRAP_CONTENT);
        panelParams.topMargin = dp(8);
        root.addView(panel, panelParams);

        int type = WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY;
        layoutParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        layoutParams.gravity = Gravity.RIGHT | Gravity.CENTER_VERTICAL;
        layoutParams.x = dp(6);
        layoutParams.y = 0;
        try {
            windowManager.addView(root, layoutParams);
            added = true;
        } catch (Exception error) {
            added = false;
            root = null;
            panel = null;
            bubble = null;
        }
    }

    private void togglePanel() {
        if (panel == null) return;
        expanded = !expanded;
        if (expanded) rebuildPanel();
        panel.setVisibility(expanded ? View.VISIBLE : View.GONE);
        if (layoutParams != null && added) {
            try { windowManager.updateViewLayout(root, layoutParams); } catch (Exception ignored) {}
        }
    }

    private LinearLayout buildPanel() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(12), dp(14), dp(12));
        card.setBackground(rounded(Color.rgb(24, 29, 40), 18, Color.rgb(53, 68, 85)));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setOrientation(LinearLayout.HORIZONTAL);
        TextView title = text("Chess Topper", 15, Color.WHITE, true);
        header.addView(title, new LinearLayout.LayoutParams(0, WindowManager.LayoutParams.WRAP_CONTENT, 1));
        TextView close = text("×", 25, Color.LTGRAY, false);
        close.setPadding(dp(8), 0, dp(2), 0);
        close.setOnClickListener(v -> togglePanel());
        header.addView(close);
        card.addView(header);

        TextView app = text(currentAppLabel(), 11, Color.rgb(177, 191, 210), false);
        app.setPadding(0, dp(3), 0, dp(10));
        card.addView(app);

        JSONArray shortcuts = readShortcuts();
        int addedControls = 0;
        for (int i = 0; i < shortcuts.length(); i++) {
            String id = shortcuts.optString(i, "");
            if (addShortcutControl(card, id)) addedControls++;
        }
        if (addedControls == 0) {
            TextView empty = text("Add controls from Settings in the Chess Topper app.", 12, Color.rgb(190, 198, 210), false);
            empty.setPadding(0, dp(8), 0, dp(8));
            card.addView(empty);
        }

        Button open = new Button(this);
        open.setText("Open Chess Topper");
        open.setTextSize(12);
        open.setAllCaps(false);
        open.setOnClickListener(v -> openMainApp());
        LinearLayout.LayoutParams openParams = new LinearLayout.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, dp(42));
        openParams.topMargin = dp(8);
        card.addView(open, openParams);
        return card;
    }

    private void rebuildPanel() {
        if (root == null || panel == null) return;
        int index = root.indexOfChild(panel);
        root.removeView(panel);
        panel = buildPanel();
        LinearLayout.LayoutParams panelParams = new LinearLayout.LayoutParams(dp(276), WindowManager.LayoutParams.WRAP_CONTENT);
        panelParams.topMargin = dp(8);
        root.addView(panel, Math.max(1, index), panelParams);
        panel.setVisibility(View.VISIBLE);
    }

    private JSONArray readShortcuts() {
        try { return new JSONArray(prefs().getString("shortcuts", "[\"engine.elo\",\"game.depth\"]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    private boolean addShortcutControl(LinearLayout card, String id) {
        String label;
        String prefKey = id;
        int min, max, step;
        boolean toggle = false;
        boolean defaultValue = false;
        if ("engine.elo".equals(id)) { label = "ELO limit"; min = 1320; max = 3190; step = 10; }
        else if ("game.depth".equals(id)) { label = "Analysis depth"; min = 10; max = 30; step = 1; }
        else if ("engine.skillLevel".equals(id)) { label = "Skill level"; min = 1; max = 20; step = 1; }
        else if ("engine.threads".equals(id)) { label = "Engine threads"; min = 1; max = 8; step = 1; }
        else if ("engine.hash".equals(id)) { label = "Hash (MB)"; min = 128; max = 2048; step = 128; }
        else if ("game.targetAccuracy".equals(id)) { label = "Target accuracy"; min = 50; max = 100; step = 1; }
        else if ("game.enabled".equals(id) || "engine.limitStrength".equals(id) ||
            "game.autoMove".equals(id) || "game.showBestMove".equals(id) ||
            "game.showAltArrows".equals(id) || "game.smartTiming".equals(id)) {
            label = id.substring(id.indexOf('.') + 1).replaceAll("([A-Z])", " $1");
            min = 0; max = 1; step = 1; toggle = true;
            defaultValue = "game.enabled".equals(id) || "game.smartTiming".equals(id);
        } else {
            return false;
        }

        TextView heading = text(label, 12, Color.WHITE, true);
        heading.setPadding(0, dp(9), 0, dp(3));
        card.addView(heading);
        if (toggle) {
            CheckBox check = new CheckBox(this);
            check.setText("Enabled");
            check.setTextColor(Color.rgb(210, 218, 230));
            check.setTextSize(11);
            boolean current = prefs().getBoolean(prefKey, defaultValue);
            check.setChecked(current);
            check.setOnCheckedChangeListener((button, checked) -> prefs().edit().putBoolean(prefKey, checked).apply());
            card.addView(check);
            return true;
        }

        int current = prefs().getInt(prefKey, defaultFor(prefKey, min));
        current = Math.max(min, Math.min(max, current));
        TextView valueText = text(formatValue(current, step), 11, Color.rgb(160, 224, 230), false);
        card.addView(valueText);
        SeekBar seek = new SeekBar(this);
        seek.setMax(Math.max(1, (max - min) / step));
        seek.setProgress(Math.max(0, (current - min) / step));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                int value = min + progress * step;
                valueText.setText(formatValue(value, step));
            }
            @Override public void onStartTrackingTouch(SeekBar bar) {}
            @Override public void onStopTrackingTouch(SeekBar bar) {
                int value = min + bar.getProgress() * step;
                prefs().edit().putInt(prefKey, value).apply();
                if ("engine.elo".equals(prefKey)) prefs().edit().putBoolean("engine.limitStrength", true).apply();
            }
        });
        card.addView(seek, new LinearLayout.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, dp(34)));
        return true;
    }

    private int defaultFor(String id, int fallback) {
        if ("engine.elo".equals(id)) return 1500;
        if ("game.depth".equals(id)) return 18;
        if ("engine.skillLevel".equals(id)) return 20;
        if ("engine.threads".equals(id)) return 2;
        if ("engine.hash".equals(id)) return 256;
        if ("game.targetAccuracy".equals(id)) return 100;
        return fallback;
    }

    private String formatValue(int value, int step) {
        return step == 10 || step == 128 ? String.format(Locale.US, "%,d", value) : String.valueOf(value);
    }

    private String currentAppLabel() {
        try {
            ApplicationInfo info = getPackageManager().getApplicationInfo(activePackage, 0);
            return "Over " + getPackageManager().getApplicationLabel(info);
        } catch (Exception ignored) {
            return "Floating over selected app";
        }
    }

    private void openMainApp() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(launch);
            }
        } catch (Exception ignored) {}
        expanded = false;
        if (panel != null) panel.setVisibility(View.GONE);
    }

    private void hideOverlay() {
        if (added && windowManager != null && root != null) {
            try { windowManager.removeView(root); } catch (Exception ignored) {}
        }
        added = false;
        expanded = false;
        root = null;
        panel = null;
        bubble = null;
        layoutParams = null;
    }
}
