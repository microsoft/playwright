/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test as it, expect } from './pageTest';

it.describe(`greek keyboard layout`, () => {
  it.beforeEach(async ({ page, server, toImpl }) => {
    toImpl(page).keyboard._testKeyboardLayout('el-GR');
    await page.goto(server.PREFIX + '/input/keyboard.html');
  });

  it(`should fire key events on α`, async ({ page }) => {
    await page.keyboard.press('α');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: α KeyA 65 []',
          'Keypress: α KeyA 945 945 []',
          'Keyup: α KeyA 65 []'].join('\n'));
  });

  it(`should type ε on KeyE`, async ({ page }) => {
    await page.keyboard.press('KeyE');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: ε KeyE 69 []',
          'Keypress: ε KeyE 949 949 []',
          'Keyup: ε KeyE 69 []'].join('\n'));
  });

  it(`should fire key events on Σ`, async ({ page }) => {
    await page.keyboard.press('Σ');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: Σ KeyS 83 []',
          'Keypress: Σ KeyS 931 931 []',
          'Keyup: Σ KeyS 83 []'].join('\n'));
  });

  it(`should type Δ on Shift+KeyD`, async ({ page }) => {
    await page.keyboard.press('Shift+KeyD');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: Shift ShiftLeft 16 [Shift]',
          'Keydown: Δ KeyD 68 [Shift]',
          'Keypress: Δ KeyD 916 916 [Shift]',
          'Keyup: Δ KeyD 68 [Shift]',
          'Keyup: Shift ShiftLeft 16 []'].join('\n'));
    await expect(page.locator('textarea')).toHaveValue('Δ');
  });
});

it.describe(`portuguese keyboard layout`, () => {
  it.beforeEach(async ({ page, server, toImpl }) => {
    toImpl(page).keyboard._testKeyboardLayout('pt-PT');
    await page.goto(server.PREFIX + '/input/keyboard.html');
  });

  it(`should type backslash on Backquote`, async ({ page }) => {
    await page.keyboard.press('Backquote');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: \\ Backquote 220 []',
          'Keypress: \\ Backquote 92 92 []',
          'Keyup: \\ Backquote 220 []'].join('\n'));
  });

  it(`should type ! on Shift+Digit1`, async ({ page }) => {
    await page.keyboard.press('Shift+Digit1');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: Shift ShiftLeft 16 [Shift]',
          'Keydown: ! Digit1 49 [Shift]',
          'Keypress: ! Digit1 33 33 [Shift]',
          'Keyup: ! Digit1 49 [Shift]',
          'Keyup: Shift ShiftLeft 16 []'].join('\n'));
  });
});

it.describe(`us keyboard layout`, () => {
  it.beforeEach(async ({ page, server, toImpl }) => {
    toImpl(page).keyboard._testKeyboardLayout('en-US');
    await page.goto(server.PREFIX + '/input/keyboard.html');
  });

  it(`should type backslash on Backslash`, async ({ page }) => {
    await page.keyboard.press('Backslash');
    expect(await page.evaluate('getResult()')).toBe(
        ['Keydown: \\ Backslash 220 []',
          'Keypress: \\ Backslash 92 92 []',
          'Keyup: \\ Backslash 220 []'].join('\n'));
  });
});

it(`should fallback to us on invalid layout format`, async ({ page, toImpl, server }) => {
  toImpl(page).keyboard._testKeyboardLayout('invalid');
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('Backquote');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: ` Backquote 192 []',
        'Keypress: ` Backquote 96 96 []',
        'Keyup: ` Backquote 192 []'].join('\n'));
});

const testData = {
  'af_za': { keyCode: 65, key: 'a' },
  'en_us': { keyCode: 65, key: 'a' },
  'en_au': { keyCode: 65, key: 'a' },
  'en_bz': { keyCode: 65, key: 'a' },
  'en_ca': { keyCode: 65, key: 'a' },
  'en_029': { keyCode: 65, key: 'a' },
  'en_hk': { keyCode: 65, key: 'a' },
  'en_jm': { keyCode: 65, key: 'a' },
  'en_my': { keyCode: 65, key: 'a' },
  'en_ph': { keyCode: 65, key: 'a' },
  'en_sg': { keyCode: 65, key: 'a' },
  'en_za': { keyCode: 65, key: 'a' },
  'en_tt': { keyCode: 65, key: 'a' },
  'en_zw': { keyCode: 65, key: 'a' },
  'fil_ph': { keyCode: 65, key: 'a' },
  'id_id': { keyCode: 65, key: 'a' },
  'jv': { keyCode: 65, key: 'a' },
  'rw_rw': { keyCode: 65, key: 'a' },
  'sw_ke': { keyCode: 65, key: 'a' },
  'ms_my': { keyCode: 65, key: 'a' },
  'ms_bn': { keyCode: 65, key: 'a' },
  'moh_ca': { keyCode: 65, key: 'a' },
  'om_et': { keyCode: 65, key: 'a' },
  'pap_029': { keyCode: 65, key: 'a' },
  'st_za': { keyCode: 65, key: 'a' },
  'so_so': { keyCode: 65, key: 'a' },
  'uz_latn_uz': { keyCode: 65, key: 'a' },
  'ts_za': { keyCode: 65, key: 'a' },
  'xh_za': { keyCode: 65, key: 'a' },
  'zu_za': { keyCode: 65, key: 'a' },
  'sq_al': { keyCode: 65, key: 'a' },
  'gsw_fr': { keyCode: 81, key: 'q' },
  'br_fr': { keyCode: 81, key: 'q' },
  'fr_fr': { keyCode: 81, key: 'q' },
  'co_fr': { keyCode: 81, key: 'q' },
  'fr_cm': { keyCode: 81, key: 'q' },
  'fr_ci': { keyCode: 81, key: 'q' },
  'fr_ht': { keyCode: 81, key: 'q' },
  'fr_ml': { keyCode: 81, key: 'q' },
  'fr_mc': { keyCode: 81, key: 'q' },
  'fr_ma': { keyCode: 81, key: 'q' },
  'fr_re': { keyCode: 81, key: 'q' },
  'fr_sn': { keyCode: 81, key: 'q' },
  'fr_cd': { keyCode: 81, key: 'q' },
  'mg': { keyCode: 81, key: 'q' },
  'oc_fr': { keyCode: 81, key: 'q' },
  'ar_sa': { keyCode: 65, key: 'ش' },
  'ar_bh': { keyCode: 65, key: 'ش' },
  'ar_eg': { keyCode: 65, key: 'ش' },
  'ar_iq': { keyCode: 65, key: 'ش' },
  'ar_jo': { keyCode: 65, key: 'ش' },
  'ar_kw': { keyCode: 65, key: 'ش' },
  'ar_lb': { keyCode: 65, key: 'ش' },
  'ar_ly': { keyCode: 65, key: 'ش' },
  'ar_om': { keyCode: 65, key: 'ش' },
  'ar_qa': { keyCode: 65, key: 'ش' },
  'ar_sy': { keyCode: 65, key: 'ش' },
  'ar_ae': { keyCode: 65, key: 'ش' },
  'ar_ye': { keyCode: 65, key: 'ش' },
  'ar_dz': { keyCode: 65, key: 'ش' },
  'ar_ma': { keyCode: 65, key: 'ش' },
  'ar_tn': { keyCode: 65, key: 'ش' },
  'hy_am': { keyCode: 65, key: 'ա' },
  'as_in': { keyCode: 65, key: 'ো' },
  'es_es_tradnl': { keyCode: 65, key: 'a' },
  'eu_es': { keyCode: 65, key: 'a' },
  'ca_es': { keyCode: 65, key: 'a' },
  'gl_es': { keyCode: 65, key: 'a' },
  'es_es': { keyCode: 65, key: 'a' },
  'ca_es_valencia': { keyCode: 65, key: 'a' },
  'az_latn_az': { keyCode: 65, key: 'a' },
  'az_cyrl_az': { keyCode: 65, key: 'ф' },
  'bn_bd': { keyCode: 65, key: 'ো' },
  'ba_ru': { keyCode: 65, key: 'ф' },
  'be_by': { keyCode: 65, key: 'ф' },
  'bn_in': { keyCode: 65, key: 'ো' },
  'kok_in': { keyCode: 65, key: 'ो' },
  'sa_in': { keyCode: 65, key: 'ो' },
  'bs_latn_ba': { keyCode: 65, key: 'a' },
  'hr_hr': { keyCode: 65, key: 'a' },
  'hr_ba': { keyCode: 65, key: 'a' },
  'bs_cyrl_ba': { keyCode: 65, key: 'а' },
  'bg_bg': { keyCode: 65, key: 'ь' },
  'my_mm': { keyCode: 65, key: 'ေ' },
  'it_it': { keyCode: 65, key: 'a' },
  'tzm_latn_dz': { keyCode: 81, key: 'q' },
  'tzm_tfng_ma': { keyCode: 65, key: 'ⵇ' },
  'zgh': { keyCode: 65, key: 'ⵇ' },
  'ku_arab_iq': { keyCode: 65, key: 'ا' },
  'ru_ru': { keyCode: 65, key: 'ф' },
  'chr_cher_us': { keyCode: 65, key: 'Ꭰ' },
  'de_de': { keyCode: 65, key: 'a' },
  'de_at': { keyCode: 65, key: 'a' },
  'de_lu': { keyCode: 65, key: 'a' },
  'en_gb': { keyCode: 65, key: 'a' },
  'cs_cz': { keyCode: 65, key: 'a' },
  'da_dk': { keyCode: 65, key: 'a' },
  'fo_fo': { keyCode: 65, key: 'a' },
  'kl_gl': { keyCode: 65, key: 'a' },
  'dv_mv': { keyCode: 65, key: 'ަ' },
  'nl_nl': { keyCode: 65, key: 'a' },
  'fy_nl': { keyCode: 65, key: 'a' },
  'nl_be': { keyCode: 81, key: 'q' },
  'dz_bt': { keyCode: 65, key: 'ཏ' },
  'fr_be': { keyCode: 81, key: 'q' },
  'fi_fi': { keyCode: 65, key: 'a' },
  'en_in': { keyCode: 65, key: 'a' },
  'en_ie': { keyCode: 65, key: 'a' },
  'ga_ie': { keyCode: 65, key: 'a' },
  'en_nz': { keyCode: 65, key: 'a' },
  'sl_si': { keyCode: 65, key: 'a' },
  'sv_se': { keyCode: 65, key: 'a' },
  'sv_fi': { keyCode: 65, key: 'a' },
  'et_ee': { keyCode: 65, key: 'a' },
  'fr_ca': { keyCode: 65, key: 'a' },
  'fr_lu': { keyCode: 65, key: 'a' },
  'fr_ch': { keyCode: 65, key: 'a' },
  'it_ch': { keyCode: 65, key: 'a' },
  'ff_latn_sn': { keyCode: 81, key: 'q' },
  'wo_sn': { keyCode: 81, key: 'q' },
  'ka_ge': { keyCode: 65, key: 'ა' },
  'de_li': { keyCode: 65, key: 'a' },
  'de_ch': { keyCode: 65, key: 'a' },
  'rm_ch': { keyCode: 65, key: 'a' },
  'el_gr': { keyCode: 65, key: 'α' },
  'gn_py': { keyCode: 65, key: 'a' },
  'gu_in': { keyCode: 65, key: 'ો' },
  'ha_latn_ng': { keyCode: 65, key: 'a' },
  'haw_us': { keyCode: 65, key: 'a' },
  'he_il': { keyCode: 65, key: 'ש' },
  'hi_in': { keyCode: 65, key: 'ो' },
  'hu_hu': { keyCode: 65, key: 'a' },
  'is_is': { keyCode: 65, key: 'a' },
  'ig_ng': { keyCode: 65, key: 'a' },
  'iu_latn_ca': { keyCode: 65, key: 'a' },
  'iu_cans_ca': { keyCode: 65, key: 'a' },
  'jv_java': { keyCode: 65, key: 'ꦄ' },
  'kn_in': { keyCode: 65, key: 'ೋ' },
  'ur_pk': { keyCode: 65, key: 'م' },
  'pa_arab_pk': { keyCode: 65, key: 'م' },
  'sd_arab_pk': { keyCode: 65, key: 'م' },
  'ur_in': { keyCode: 65, key: 'م' },
  'kk_kz': { keyCode: 65, key: 'ф' },
  'km_kh': { keyCode: 65, key: 'ា' },
  'ky_kg': { keyCode: 65, key: 'ф' },
  'quc_latn_gt': { keyCode: 65, key: 'a' },
  'arn_cl': { keyCode: 65, key: 'a' },
  'quz_bo': { keyCode: 65, key: 'a' },
  'quz_ec': { keyCode: 65, key: 'a' },
  'quz_pe': { keyCode: 65, key: 'a' },
  'es_ar': { keyCode: 65, key: 'a' },
  'es_bo': { keyCode: 65, key: 'a' },
  'es_cl': { keyCode: 65, key: 'a' },
  'es_co': { keyCode: 65, key: 'a' },
  'es_cr': { keyCode: 65, key: 'a' },
  'es_mx': { keyCode: 65, key: 'a' },
  'es_do': { keyCode: 65, key: 'a' },
  'es_ec': { keyCode: 65, key: 'a' },
  'es_sv': { keyCode: 65, key: 'a' },
  'es_gt': { keyCode: 65, key: 'a' },
  'es_hn': { keyCode: 65, key: 'a' },
  'es_419': { keyCode: 65, key: 'a' },
  'es_ni': { keyCode: 65, key: 'a' },
  'es_pa': { keyCode: 65, key: 'a' },
  'es_py': { keyCode: 65, key: 'a' },
  'es_pe': { keyCode: 65, key: 'a' },
  'es_pr': { keyCode: 65, key: 'a' },
  'es_us': { keyCode: 65, key: 'a' },
  'es_uy': { keyCode: 65, key: 'a' },
  'es_ve': { keyCode: 65, key: 'a' },
  'lo_la': { keyCode: 65, key: 'ັ' },
  'lv_lv': { keyCode: 65, key: 'a' },
  'lt_lt': { keyCode: 65, key: 'a' },
  'dsb_de': { keyCode: 65, key: 'a' },
  'hsb_de': { keyCode: 65, key: 'a' },
  'lb_lu': { keyCode: 65, key: 'a' },
  'mk_mk': { keyCode: 65, key: 'а' },
  'ml_in': { keyCode: 65, key: 'ോ' },
  'mt_mt': { keyCode: 65, key: 'a' },
  'mi_nz': { keyCode: 65, key: 'a' },
  'mr_in': { keyCode: 65, key: 'ो' },
  'fa_ir': { keyCode: 65, key: 'ش' },
  'mn_mn': { keyCode: 65, key: 'й' },
  'mn_mong_cn': { keyCode: 65, key: 'ᠠ' },
  'mn_mong_mn': { keyCode: 65, key: 'ᠠ' },
  'nqo': { keyCode: 65, key: 'ߏ' },
  'ne_np': { keyCode: 65, key: 'ब' },
  'ne_in': { keyCode: 65, key: 'ब' },
  'se_no': { keyCode: 65, key: 'a' },
  'smj_no': { keyCode: 65, key: 'a' },
  'sma_no': { keyCode: 65, key: 'a' },
  'nb_no': { keyCode: 65, key: 'a' },
  'nn_no': { keyCode: 65, key: 'a' },
  'or_in': { keyCode: 65, key: 'ୋ' },
  'ps_af': { keyCode: 65, key: 'ش' },
  'fa_af': { keyCode: 65, key: 'ش' },
  'pl_pl': { keyCode: 65, key: 'a' },
  'pt_br': { keyCode: 65, key: 'a' },
  'pt_pt': { keyCode: 65, key: 'a' },
  'pa_in': { keyCode: 65, key: 'ੋ' },
  'ro_ro': { keyCode: 65, key: 'a' },
  'ro_md': { keyCode: 65, key: 'a' },
  'sah_ru': { keyCode: 65, key: 'ф' },
  'smn_fi': { keyCode: 65, key: 'a' },
  'sms_fi': { keyCode: 65, key: 'a' },
  'se_fi': { keyCode: 65, key: 'a' },
  'smj_se': { keyCode: 65, key: 'a' },
  'sma_se': { keyCode: 65, key: 'a' },
  'se_se': { keyCode: 65, key: 'a' },
  'gd_gb': { keyCode: 65, key: 'a' },
  'sr_latn_rs': { keyCode: 65, key: 'a' },
  'sr_latn_ba': { keyCode: 65, key: 'a' },
  'sr_latn_me': { keyCode: 65, key: 'a' },
  'sr_cyrl_rs': { keyCode: 65, key: 'а' },
  'sr_cyrl_ba': { keyCode: 65, key: 'а' },
  'sr_cyrl_me': { keyCode: 65, key: 'а' },
  'nso_za': { keyCode: 65, key: 'a' },
  'tn_za': { keyCode: 65, key: 'a' },
  'tn_bw': { keyCode: 65, key: 'a' },
  'si_lk': { keyCode: 65, key: '්' },
  'sk_sk': { keyCode: 65, key: 'a' },
  'syr_sy': { keyCode: 65, key: 'ܫ' },
  'tg_cyrl_tj': { keyCode: 65, key: 'ф' },
  'ta_in': { keyCode: 65, key: 'அ' },
  'ta_lk': { keyCode: 65, key: 'அ' },
  'tt_ru': { keyCode: 65, key: 'ф' },
  'te_in': { keyCode: 65, key: 'ో' },
  'th_th': { keyCode: 65, key: 'ฟ' },
  'bo_cn': { keyCode: 65, key: 'འ' },
  'tr_tr': { keyCode: 65, key: 'a' },
  'tk_tm': { keyCode: 65, key: 'a' },
  'uk_ua': { keyCode: 65, key: 'ф' },
  'ug_cn': { keyCode: 65, key: 'ھ' },
  'uz_cyrl_uz': { keyCode: 65, key: 'ф' },
  'cy_gb': { keyCode: 65, key: 'a' },
  'yo_ng': { keyCode: 65, key: 'a' },
};

for (const [locale, { key, keyCode }] of Object.entries(testData)) {
  it(`should fire events on KeyA for ${locale} locale`, async ({ page, server, toImpl }) => {
    toImpl(page).keyboard._testKeyboardLayout(locale);
    await page.goto(server.PREFIX + '/input/keyboard.html');

    await page.keyboard.press('KeyA');
    const charCode = key.charCodeAt(0);
    expect(await page.evaluate('getResult()')).toBe(
        [`Keydown: ${key} KeyA ${keyCode} []`,
          `Keypress: ${key} KeyA ${charCode} ${charCode} []`,
          `Keyup: ${key} KeyA ${keyCode} []`].join('\n'));
  });
}
