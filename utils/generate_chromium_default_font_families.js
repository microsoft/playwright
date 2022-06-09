/**
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

// @ts-check
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const { argv } = require('process');

// From https://source.chromium.org/chromium/chromium/src/+/main:chrome/browser/ui/prefs/prefs_tab_helper.cc;l=130;drc=62b77bef90de54f0136b51935fa2d5814a1b4da9
// and https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/text/locale_to_script_mapping.cc;l=44;drc=befcb6de95fb8c88c162ce1f64111f6c17351b13
// note that some suffixes like _JAPANESE, _KOREAN don't have matching icu codes.
const codeToScriptName = new Map([
    ['ARABIC', 'arab'],
    ['CYRILLIC', 'cyrl'],
    ['GREEK', 'grek'],
    ['JAPANESE', 'jpan'],
    ['KOREAN', 'hang'],
    ['SIMPLIFIED_HAN', 'hans'],
    ['TRADITIONAL_HAN', 'hant'],
]);

const idToProtocol = new Map([
    ['IDS_STANDARD_FONT_FAMILY', 'standard'],
    ['IDS_SANS_SERIF_FONT_FAMILY','sansSerif'],
    ['IDS_SERIF_FONT_FAMILY', 'serif'],
    ['IDS_CURSIVE_FONT_FAMILY', 'cursive'],
    ['IDS_FANTASY_FONT_FAMILY', 'fantasy'],
    ['IDS_FIXED_FONT_FAMILY', 'fixed'],
]);

class ScriptFontFamilies {
    scriptToFontFamilies = new Map();

    setFont(scriptName, familyName, value) {
        let fontFamilies = this.scriptToFontFamilies.get(scriptName);
        if (!fontFamilies) {
            fontFamilies = {};
            this.scriptToFontFamilies.set(scriptName, fontFamilies);
        }
        fontFamilies[familyName] = value;
    }

    toJSON() {
        const forScripts = Array.from(this.scriptToFontFamilies.entries()).filter(([name, _]) => !!name).map(([script, fontFamilies]) => ({ script, fontFamilies }));
        return {
            fontFamilies: this.scriptToFontFamilies.get(''),
            forScripts: forScripts.length ? forScripts : undefined
        };
    }
}

if (argv.length < 3)
    throw new Error('Expected path to "chromium/src" checkout as first argument')

// Upstream files location is https://chromium.googlesource.com/chromium/src/+/main/chrome/app/resources/locale_settings_linux.grd
const resourceDir = path.join(argv[2], 'chrome/app/resources/');
if (!fs.existsSync(resourceDir))
    throw new Error(`Path ${resourceDir} does not exist`);

function parseXML(xml) {
    let result;
    xml2js.parseString(xml, {trim: true}, (err, r) => result = r);
    return result;
}

const result = {};
for (const platform of ['linux', 'mac', 'win']) {
    const f = path.join(resourceDir, `locale_settings_${platform}.grd`);
    const xmlDataStr = fs.readFileSync(f);
    let jsonObj = parseXML(xmlDataStr);
    if (!jsonObj)
        throw new Error('Failed to parse ' + f);
    const fontFamilies = new ScriptFontFamilies();
    const defaults = jsonObj.grit.release[0].messages[0].message;
    defaults.forEach(e => {
        const name = e['$']['name'];
        let scriptName = '';
        let familyName;
        for (const id of idToProtocol.keys()) {
            if (!name.startsWith(id))
                continue;
            familyName = idToProtocol.get(id);
            if (name !== id) {
                const suffix = name.substring(id.length + 1);
                // We don't support this, see https://source.chromium.org/chromium/chromium/src/+/main:chrome/browser/ui/prefs/prefs_tab_helper.cc;l=384-390;drc=62b77bef90de54f0136b51935fa2d5814a1b4da9
                if (suffix === 'ALT_WIN')
                    continue;
                scriptName = codeToScriptName.get(suffix);
                if (!scriptName)
                    throw new Error('NO Script name for: ' + suffix);
            }
            break;
        }
        // Skip things like IDS_NTP_FONT_FAMILY, IDS_MINIMUM_FONT_SIZE etc.
        if (!familyName)
            return;
        fontFamilies.setFont(scriptName, familyName, e['_'])
    });
    result[platform] = fontFamilies.toJSON();
}

console.log(JSON.stringify(result, null, 2).replaceAll('"', `'`));
