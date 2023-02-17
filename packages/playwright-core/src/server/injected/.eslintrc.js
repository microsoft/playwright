module.exports = {
    rules: {
        "no-restricted-globals": [
            "error",
            { "name": "window" },
            { "name": "document" },
            { "name": "globalThis" },
        ]
    }
};
