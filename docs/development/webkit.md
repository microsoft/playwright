# WebKit build flags

- :elephant: - bundled, but we don't necessarily need it
- :warning: - missing, we'd like it to be there

|   |Target|Mac|Linux|Cloud|Win|
|---|:---------:|:---:|:---:|:---:|:---:|
|3D_TRANSFORMS|  +  |  +  |  +  |  +  |  +  |
|ACCELERATED_2D_CANVAS|     |     |     |     |     |
|ACCESSIBILITY|  +  |  +  |  +  |  +  |  +  |
|ACCESSIBILITY_STATIC_TREE|     |     |     |     |     |
|API_TESTS|     |     |:elephant:|:elephant:|:elephant:|
|APPLE_PAY|     |:elephant:|     |     |     |
|APPLE_PAY_SESSION_V3|     |:elephant:|     |     |     |
|APPLE_PAY_SESSION_V4|     |:elephant:|     |     |     |
|APPLICATION_MANIFEST|  +  |  +  |  +  |  +  |  +  |
|ASYNC_SCROLLING|  +  |  +  |  +  |  +  |:warning:|
|ATTACHMENT_ELEMENT|     |:elephant:|     |     |:elephant:|
|AUTOCAPITALIZE|     |     |:elephant:|:elephant:|     |
|AVF_CAPTIONS|     |:elephant:|     |     |     |
|BUBBLEWRAP_SANDBOX|     |     |     |     |     |
|CACHE_PARTITIONING|     |:elephant:|     |     |     |
|CHANNEL_MESSAGING|  +  |  +  |  +  |  +  |  +  |
|CONTENT_EXTENSIONS|  +  |  +  |  +  |  +  |:warning:|
|CONTENT_FILTERING|     |:elephant:|     |     |     |
|CONTEXT_MENUS|  +  |  +  |  +  |  +  |  +  |
|CSS3_TEXT|     |     |     |     |     |
|CSS_BOX_DECORATION_BREAK|  +  |  +  |  +  |  +  |  +  |
|CSS_COMPOSITING|  +  |  +  |  +  |  +  |  +  |
|CSS_CONIC_GRADIENTS|  +  |  +  |  +  |  +  |  +  |
|CSS_DEVICE_ADAPTATION|     |     |     |     |     |
|CSS_IMAGE_ORIENTATION|     |     |     |     |     |
|CSS_IMAGE_RESOLUTION|     |     |     |     |     |
|CSS_PAINTING_API|  +  |  +  |  +  |  +  |  +  |
|CSS_SCROLL_SNAP|     |:elephant:|     |     |     |
|CSS_SELECTORS_LEVEL4|  +  |  +  |  +  |  +  |  +  |
|CSS_TRAILING_WORD|  +  |  +  |  +  |  +  |  +  |
|CSS_TYPED_OM|  +  |  +  |  +  |  +  |  +  |
|CURSOR_VISIBILITY|  +  |  +  |  +  |  +  |  +  |
|CUSTOM_SCHEME_HANDLER|     |     |     |     |     |
|C_LOOP_DEFAULT|     |     |     |     |     |
|DARK_MODE_CSS|  +  |  +  |  +  |  +  |  +  |
|DATACUE_VALUE|     |:elephant:|     |     |     |
|DATALIST_ELEMENT|  +  |  +  |  +  |:warning:|:warning:|
|DATA_INTERACTION|     |     |     |     |     |
|DEVICE_ORIENTATION|     |     |     |     |     |
|DFG_JIT|  +  |  +  |  +  |  +  |  +  |
|DOWNLOAD_ATTRIBUTE|  +  |  +  |  +  |  +  |  +  |
|DRAG_SUPPORT|     |:elephant:|:elephant:|     |:elephant:|
|ENCRYPTED_MEDIA|  +  |  +  |  +  |  +  |:warning:|
|EXPERIMENTAL_FEATURES|  +  |  +  |  +  |  +  |  +  |
|EXPERIMENTAL_FEATURES|  +  |  +  |  +  |  +  |  +  |
|FAST_JIT_PERMISSIONS|     |     |     |     |     |
|FILTERS_LEVEL_2|     |:elephant:|     |     |:elephant:|
|FTL_DEFAULT|     |     |     |     |     |
|FTL_JIT|     |:elephant:|:elephant:|:elephant:|     |
|FTPDIR|     |:elephant:|     |:elephant:|:elephant:|
|FULLSCREEN_API|  +  |  +  |  +  |  +  |  +  |
|GAMEPAD|     |:elephant:|     |     |     |
|GEOLOCATION|  +  |  +  |  +  |  +  |  +  |
|GLES2_DEFAULT|     |     |     |     |     |
|GTKDOC|     |     |     |     |     |
|INDEXED_DATABASE|  +  |  +  |  +  |  +  |  +  |
|INDEXED_DATABASE_IN_WORKERS|  +  |  +  |  +  |  +  |  +  |
|INPUT_TYPE_COLOR|  +  |  +  |  +  |:warning:|:warning:|
|INPUT_TYPE_DATE|     |     |     |     |     |
|INPUT_TYPE_DATETIMELOCAL|     |     |     |     |     |
|INPUT_TYPE_DATETIME_ INCOMPLETE|     |     |     |     |     |
|INPUT_TYPE_MONTH|     |     |     |     |     |
|INPUT_TYPE_TIME|     |     |     |     |     |
|INPUT_TYPE_WEEK|     |     |     |     |     |
|INSPECTOR_ALTERNATE_ DISPATCHERS|     |:elephant:|     |     |     |
|INSPECTOR_TELEMETRY|     |:elephant:|     |     |     |
|INTERSECTION_OBSERVER|  +  |  +  |  +  |  +  |  +  |
|INTL|  +  |  +  |  +  |  +  |  +  |
|INTROSPECTION|     |     |:elephant:|     |     |
|IOS_GESTURE_EVENTS|     |     |     |     |     |
|IOS_TOUCH_EVENTS|     |     |     |     |     |
|JIT|  +  |  +  |  +  |  +  |  +  |
|JIT_DEFAULT|     |     |     |     |     |
|LAYOUT_FORMATTING_CONTEXT|     |:elephant:|     |     |:elephant:|
|LEGACY_CSS_VENDOR_PREFIXES|  +  |  +  |  +  |  +  |  +  |
|LEGACY_CUSTOM_ PROTOCOL_MANAGER|     |:elephant:|     |     |     |
|LEGACY_ENCRYPTED_MEDIA|     |:elephant:|     |     |     |
|LETTERPRESS|     |     |     |     |     |
|MAC_GESTURE_EVENTS|     |     |     |     |     |
|MAC_VIDEO_TOOLBOX|     |     |     |     |     |
|MATHML|  +  |  +  |  +  |  +  |  +  |
|MEDIA_CAPTURE|     |     |     |     |     |
|MEDIA_CONTROLS_SCRIPT|  +  |  +  |  +  |  +  |  +  |
|MEDIA_SESSION|     |     |     |     |     |
|MEDIA_SOURCE|  +  |  +  |  +  |  +  |:warning:|
|MEDIA_STATISTICS|     |     |     |     |:elephant:|
|MEDIA_STREAM|  +  |  +  |  +  |  +  |:warning:|
|MEMORY_SAMPLER|     |:elephant:|:elephant:|:elephant:|     |
|METER_ELEMENT|  +  |  +  |  +  |  +  |  +  |
|MHTML|     |     |:elephant:|:elephant:|     |
|MINIBROWSER|     |     |:elephant:|:elephant:|     |
|MOUSE_CURSOR_SCALE|     |:elephant:|:elephant:|     |:elephant:|
|NETSCAPE_PLUGIN_API|     |:elephant:|:elephant:|     |     |
|NETWORK_CACHE_ SPECULATIVE_REVALIDATION|     |:elephant:|:elephant:|     |     |
|NETWORK_CACHE_ STALE_WHILE_REVALIDATE|     |:elephant:|     |     |     |
|NOTIFICATIONS|     |:elephant:|:elephant:|     |     |
|OFFSCREEN_CANVAS|     |     |:elephant:|:elephant:|     |
|OPENGL|     |     |:elephant:|     |     |
|ORIENTATION_EVENTS|     |     |     |     |     |
|OVERFLOW_SCROLLING_TOUCH|     |     |     |     |     |
|PAYMENT_REQUEST|     |:elephant:|     |     |     |
|PDFKIT_PLUGIN|     |:elephant:|     |     |     |
|PICTURE_IN_PICTURE_API|     |:elephant:|     |     |     |
|POINTER_EVENTS|  +  |  +  |  +  |  +  |  +  |
|POINTER_LOCK|     |:elephant:|:elephant:|     |     |
|PUBLIC_SUFFIX_LIST|  +  |  +  |  +  |  +  |  +  |
|QUARTZ_TARGET|     |     |     |     |     |
|QUOTA|     |     |     |     |     |
|REMOTE_INSPECTOR|  +  |  +  |  +  |  +  |  +  |
|RESIZE_OBSERVER|  +  |  +  |  +  |  +  |  +  |
|RESOLUTION_MEDIA_QUERY|     |     |     |     |     |
|RESOURCE_LOAD_ STATISTICS|     |:elephant:|     |     |:elephant:|
|RESOURCE_USAGE|  +  |  +  |  +  |  +  |  +  |
|RUBBER_BANDING|     |:elephant:|     |     |     |
|SAMPLING_PROFILER|  +  |  +  |  +  |  +  |  +  |
|SAMPLING_PROFILER_DEFAULT|     |     |     |     |     |
|SANDBOX_EXTENSIONS|     |:elephant:|     |     |     |
|SERVER_PRECONNECT|     |:elephant:|     |     |     |
|SERVICE_CONTROLS|     |:elephant:|     |     |     |
|SERVICE_WORKER|  +  |  +  |  +  |  +  |  +  |
|SHAREABLE_RESOURCE|  +  |  +  |  +  |  +  |:warning:|
|SMOOTH_SCROLLING|     |:elephant:|:elephant:|     |     |
|SPEECH_SYNTHESIS|     |:elephant:|     |     |     |
|SPELLCHECK|     |     |:elephant:|     |     |
|STATIC_JSC|     |     |     |     |     |
|STREAMS_API|  +  |  +  |  +  |  +  |  +  |
|SVG_FONTS|  +  |  +  |  +  |  +  |  +  |
|TELEPHONE_NUMBER _DETECTION|     |:elephant:|     |     |     |
|TEXT_AUTOSIZING|     |:elephant:|     |     |     |
|TOUCH_EVENTS|  +  |  +  |  +  |  +  |  +  |
|TOUCH_SLIDER|     |     |     |     |     |
|UNIFIED_BUILDS|     |     |:elephant:|:elephant:|:elephant:|
|USERSELECT_ALL|  +  |  +  |  +  |  +  |:warning:|
|USER_MESSAGE_HANDLERS|  +  |  +  |  +  |  +  |  +  |
|VARIATION_FONTS|  +  |  +  |  +  |  +  |  +  |
|VIDEO|  +  |  +  |  +  |  +  |  +  |
|VIDEO_PRESENTATION_MODE|     |:elephant:|     |     |     |
|VIDEO_TRACK|  +  |  +  |  +  |  +  |  +  |
|VIDEO_USES_ELEMENT_FULLSCREEN|  +  |  +  |  +  |  +  |  +  |
|WAYLAND_TARGET|     |     |:elephant:|     |     |
|WEBASSEMBLY|  +  |  +  |  +  |  +  |:warning:|
|WEBASSEMBLY_STREAMING_API|     |     |     |     |     |
|WEBDRIVER|     |     |:elephant:|:elephant:|:elephant:|
|WEBDRIVER_KEYBOARD _INTERACTIONS|     |:elephant:|:elephant:|:elephant:|     |
|WEBDRIVER_MOUSE _INTERACTIONS|     |:elephant:|:elephant:|:elephant:|     |
|WEBGL|  +  |  +  |  +  |  +  |  +  |
|WEBGL2|     |:elephant:|     |:elephant:|     |
|WEBGPU|     |:elephant:|     |     |     |
|WEB_AUDIO|  +  |  +  |  +  |  +  |:warning:|
|WEB_AUTHN|     |:elephant:|     |     |     |
|WEB_CRYPTO|  +  |  +  |  +  |  +  |  +  |
|WEB_PROCESS_SANDBOX|     |     |     |     |     |
|WEB_RTC|  +  |  +  |  +  |  +  |:warning:|
|WIRELESS_PLAYBACK_TARGET|     |:elephant:|     |     |     |
|WPE_QT_API|     |     |     |     |     |
|XYESYES_TARGET|     |     |:elephant:|     |     |
|XSLT|  +  |  +  |  +  |  +  |  +  |
