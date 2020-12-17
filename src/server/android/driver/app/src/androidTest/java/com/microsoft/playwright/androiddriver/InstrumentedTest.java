/*
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.microsoft.playwright.androiddriver;

import android.graphics.Point;
import android.graphics.Rect;
import android.net.LocalServerSocket;
import android.net.LocalSocket;
import android.view.accessibility.AccessibilityNodeInfo;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.BySelector;
import androidx.test.uiautomator.Direction;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Instrumented test, which will execute on an Android device.
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class InstrumentedTest {

  @SuppressWarnings("ConstantConditions")
  private static BySelector parseSelector(JSONObject param) throws JSONException{
    JSONObject selector = param.getJSONObject("selector");
    BySelector result = null;
    if (selector.has("checkable")) {
      boolean value = selector.getBoolean("checkable");
      result = result != null ? result.checked(value) : By.checkable(value);
    }
    if (selector.has("checked")) {
      boolean value = selector.getBoolean("checked");
      result = result != null ? result.checked(value) : By.checked(value);
    }
    if (selector.has("clazz")) {
      Pattern value = Pattern.compile(selector.getString("clazz"));
      result = result != null ? result.clazz(value) : By.clazz(value);
    }
    if (selector.has("pkg")) {
      Pattern value = Pattern.compile(selector.getString("pkg"));
      result = result != null ? result.pkg(value) : By.pkg(value);
    }
    if (selector.has("desc")) {
      Pattern value = Pattern.compile(selector.getString("desc"));
      result = result != null ? result.desc(value) : By.desc(value);
    }
    if (selector.has("text")) {
      Pattern value = Pattern.compile(selector.getString("text"));
      result = result != null ? result.text(value) : By.text(value);
    }
    if (selector.has("clickable")) {
      boolean value = selector.getBoolean("clickable");
      result = result != null ? result.clickable(value) : By.clickable(value);
    }
    if (selector.has("depth")) {
      int value = selector.getInt("depth");
      result = result != null ? result.depth(value) : By.depth(value);
    }
    if (selector.has("enabled")) {
      boolean value = selector.getBoolean("enabled");
      result = result != null ? result.enabled(value) : By.enabled(value);
    }
    if (selector.has("focusable")) {
      boolean value = selector.getBoolean("focusable");
      result = result != null ? result.focusable(value) : By.focusable(value);
    }
    if (selector.has("focused")) {
      boolean value = selector.getBoolean("focused");
      result = result != null ? result.focused(value) : By.focused(value);
    }
    if (selector.has("hasChild")) {
      BySelector value = parseSelector(selector.getJSONObject("hasChild"));
      result = result != null ? result.hasChild(value) : By.hasChild(value);
    }
    if (selector.has("hasDescendant")) {
      JSONObject object = selector.getJSONObject("hasDescendant");
      BySelector value = parseSelector(object);
      int maxDepth = 10000;
      if (selector.has("maxDepth"))
        maxDepth = selector.getInt("maxDepth");
      result = result != null ? result.hasDescendant(value, maxDepth) : By.hasDescendant(value, maxDepth);
    }
    if (selector.has("longClickable")) {
      boolean value = selector.getBoolean("longClickable");
      result = result != null ? result.longClickable(value) : By.longClickable(value);
    }
    if (selector.has("res")) {
      Pattern value = Pattern.compile(selector.getString("res"));
      result = result != null ? result.res(value) : By.res(value);
    }
    if (selector.has("scrollable")) {
      boolean value = selector.getBoolean("scrollable");
      result = result != null ? result.scrollable(value) : By.scrollable(value);
    }
    if (selector.has("selected")) {
      boolean value = selector.getBoolean("selected");
      result = result != null ? result.selected(value) : By.selected(value);
    }
    return result;
  }

  private static int parseTimeout(JSONObject params) throws JSONException {
    if (params.has("timeout"))
      return params.getInt("timeout");
    return 30000;
  }

  private static Point parsePoint(JSONObject params, String propertyName) throws JSONException {
    JSONObject point = params.getJSONObject(propertyName);
    return new Point(point.getInt("x"),  point.getInt("y"));
  }

  private static Direction parseDirection(JSONObject params) throws JSONException {
    switch (params.getString("direction")) {
      case "up": return Direction.UP;
      case "down": return Direction.DOWN;
      case "left": return Direction.LEFT;
      case "right": return Direction.RIGHT;
    }
    throw new JSONException("Unsupported direction: " + params.getString("direction"));
  }

  private static UiObject2 wait(UiDevice device, JSONObject params) throws JSONException {
    UiObject2 result = device.wait(Until.findObject(parseSelector(params)), parseTimeout(params));
    if (result == null)
      throw new RuntimeException("Timed out waiting for selector");
    return result;
  }

  private static void fill(UiDevice device, JSONObject params) throws JSONException {
    wait(device, params).setText(params.getString("text"));
  }

  private static void click(UiDevice device, JSONObject params) throws JSONException {
    int duration = params.has("duration") ? params.getInt("duration") : 0;
    wait(device, params).click(duration);
  }

  private static void drag(UiDevice device, JSONObject params) throws JSONException {
    int speed = params.has("speed") ? params.getInt("speed") : -1;
    if (speed >= 0)
      wait(device, params).drag(parsePoint(params, "dest"), speed);
    else
      wait(device, params).drag(parsePoint(params, "dest"));
  }

  private static void fling(UiDevice device, JSONObject params) throws JSONException {
    int speed = params.has("speed") ? params.getInt("speed") : -1;
    if (speed >= 0)
      wait(device, params).fling(parseDirection(params), speed);
    else
      wait(device, params).fling(parseDirection(params));
  }

  private static void longClick(UiDevice device, JSONObject params) throws JSONException {
    wait(device, params).longClick();
  }

  private static void pinchClose(UiDevice device, JSONObject params) throws JSONException {
    int speed = params.has("speed") ? params.getInt("speed") : -1;
    if (speed >= 0)
      wait(device, params).pinchClose(params.getInt("percent"), speed);
    else
      wait(device, params).pinchClose(params.getInt("percent"));
  }

  private static void pinchOpen(UiDevice device, JSONObject params) throws JSONException {
    int speed = params.has("speed") ? params.getInt("speed") : -1;
    if (speed >= 0)
      wait(device, params).pinchOpen(params.getInt("percent"), speed);
    else
      wait(device, params).pinchOpen(params.getInt("percent"));
  }

  private static void scroll(UiDevice device, JSONObject params) throws JSONException {
    int speed = params.has("speed") ? params.getInt("speed") : -1;
    if (speed >= 0)
      wait(device, params).scroll(parseDirection(params), params.getInt("percent"), speed);
    else
      wait(device, params).scroll(parseDirection(params), params.getInt("percent"));
  }

  private static void swipe(UiDevice device, JSONObject params) throws JSONException {
    int speed = params.has("speed") ? params.getInt("speed") : -1;
    if (speed >= 0)
      wait(device, params).swipe(parseDirection(params), params.getInt("percent"), speed);
    else
      wait(device, params).swipe(parseDirection(params), params.getInt("percent"));
  }

  private static JSONObject serializeRect(Rect rect) throws JSONException {
    JSONObject rectObject = new JSONObject();
    rectObject.put("x",  rect.left);
    rectObject.put("y",  rect.top);
    rectObject.put("width",  rect.width());
    rectObject.put("height",  rect.height());
    return rectObject;
  }

  private static JSONObject info(UiDevice device, JSONObject params) throws JSONException {
    UiObject2 object = device.findObject(parseSelector(params));

    JSONObject info = new JSONObject();
    info.put("clazz", object.getClassName());
    info.put("pkg", object.getApplicationPackage());
    info.put("desc", object.getContentDescription());
    info.put("res",  object.getResourceName());
    info.put("text", object.getText());
    info.put("bounds", serializeRect(object.getVisibleBounds()));
    info.put("checkable", object.isCheckable());
    info.put("checked", object.isChecked());
    info.put("clickable", object.isClickable());
    info.put("enabled", object.isEnabled());
    info.put("focusable", object.isFocusable());
    info.put("focused", object.isFocused());
    info.put("longClickable", object.isLongClickable());
    info.put("scrollable", object.isScrollable());
    info.put("selected", object.isSelected());
    return info;
  }

  private static JSONObject info(AccessibilityNodeInfo node) throws JSONException {
    JSONObject info = new JSONObject();
    Rect bounds = new Rect();
    node.getBoundsInScreen(bounds);
    info.put("desc", node.getContentDescription());
    info.put("res",  node.getViewIdResourceName());
    info.put("text", node.getText());
    info.put("bounds", serializeRect(bounds));
    info.put("checkable", node.isCheckable());
    info.put("checked", node.isChecked());
    info.put("clickable", node.isClickable());
    info.put("enabled", node.isEnabled());
    info.put("focusable", node.isFocusable());
    info.put("focused", node.isFocused());
    info.put("longClickable", node.isLongClickable());
    info.put("scrollable", node.isScrollable());
    info.put("selected", node.isSelected());
    return info;
  }

  private static void inputPress(UiDevice device, JSONObject params) throws JSONException {
    device.pressKeyCode(params.getInt("keyCode"));
  }

  private static void inputClick(UiDevice device, JSONObject params) throws JSONException {
    Point point = parsePoint(params, "point");
    device.click(point.x, point.y);
  }

  private static void inputSwipe(UiDevice device, JSONObject params) throws JSONException {
    JSONArray items = params.getJSONArray("segments");
    Point[] segments = new Point[items.length()];
    for (int i = 0; i < items.length(); ++i) {
      JSONObject p = items.getJSONObject(i);
      segments[i] = new Point(p.getInt("x"), p.getInt("y"));
    }
    device.swipe(segments, params.getInt("steps"));
  }

  private static void inputDrag(UiDevice device, JSONObject params) throws JSONException {
    Point from = parsePoint(params, "from");
    Point to = parsePoint(params, "to");
    device.drag(from.x, from.y, to.x, to.y, params.getInt("steps"));
  }

  private static JSONObject tree(UiDevice device) throws JSONException {
    return serializeA11yNode(getRootA11yNode(device));
  }

  private static AccessibilityNodeInfo getRootA11yNode(UiDevice device) {
    try {
      Method getQueryController = UiDevice.class.getDeclaredMethod("getQueryController");
      getQueryController.setAccessible(true);
      Object queryController = getQueryController.invoke(device);

      assert queryController != null;
      Method getRootNode = queryController.getClass().getDeclaredMethod("getRootNode");
      getRootNode.setAccessible(true);
      return (AccessibilityNodeInfo) getRootNode.invoke(queryController);
    } catch (IllegalAccessException | InvocationTargetException | NoSuchMethodException e) {
      return null;
    }
  }

  private static JSONObject serializeA11yNode(AccessibilityNodeInfo node) throws JSONException {
    JSONObject object = info(node);
    if (node.getChildCount() == 0)
      return  object;
    JSONArray children = new JSONArray();
    object.put("children", children);
    for (int i = 0; i < node.getChildCount(); ++i)
      children.put(serializeA11yNode(node.getChild(i)));
    return object;
  }

  @Test
  public void main() {
    UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());

    try {
      LocalServerSocket serverSocket = new LocalServerSocket("playwright_android_driver_socket");
      LocalSocket socket = serverSocket.accept();
      InputStream is = socket.getInputStream();
      DataInputStream dis = new DataInputStream(is);
      DataOutputStream dos = new DataOutputStream(socket.getOutputStream());

      //noinspection InfiniteLoopStatement
      while (true) {
        int id = 0;
        String method = null;
        JSONObject params = null;
        try {
          int size = dis.readInt();
          byte[] buffer = new byte[size];
          dis.readFully(buffer);
          String s = new String(buffer, StandardCharsets.UTF_8);
          JSONObject message = new JSONObject(s);
          id = message.getInt("id");
          method = message.getString("method");
          params = message.getJSONObject("params");
        } catch (JSONException ignored) {
        }
        if (method == null)
          continue;

        JSONObject response = new JSONObject();
        response.put("id", id);
        response.put("result", params);
        try {
          assert params != null;
          switch (method) {
            case "wait":
              wait(device, params);
              break;
            case "fill":
              fill(device, params);
              break;
            case "click":
              click(device, params);
              break;
            case "drag":
              drag(device, params);
              break;
            case "fling":
              fling(device, params);
              break;
            case "longClick":
              longClick(device, params);
              break;
            case "pinchClose":
              pinchClose(device, params);
              break;
            case "pinchOpen":
              pinchOpen(device, params);
              break;
            case "scroll":
              scroll(device, params);
              break;
            case "swipe":
              swipe(device, params);
              break;
            case "info":
              response.put("result", info(device, params));
              break;
            case "inputPress":
              inputPress(device, params);
              break;
            case "inputClick":
              inputClick(device, params);
              break;
            case "inputSwipe":
              inputSwipe(device, params);
              break;
            case "inputDrag":
              inputDrag(device, params);
              break;
            case "tree":
              response.put("result", tree(device));
              break;
            default:

          }
        } catch (RuntimeException e) {
          response.put("error",  e.toString());
        }
        byte[] responseBytes = response.toString().getBytes(StandardCharsets.UTF_8);
        dos.writeInt(responseBytes.length);
        dos.write(responseBytes);
        dos.flush();
      }
    } catch (JSONException | IOException e) {
      e.printStackTrace();
    }
  }
}
