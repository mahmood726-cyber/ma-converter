import sys, io, os, unittest, time, math
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import Select

HTML = 'file:///' + os.path.abspath(r'C:\Models\MAConverter\maconverter.html').replace('\\','/')

class TestMAConverter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        opts = Options()
        opts.add_argument('--headless=new')
        opts.add_argument('--no-sandbox')
        opts.add_argument('--disable-gpu')
        cls.drv = webdriver.Chrome(options=opts)
        cls.drv.get(HTML)
        time.sleep(1)

    @classmethod
    def tearDownClass(cls):
        cls.drv.quit()

    def js(self, script):
        return self.drv.execute_script(script)

    # =============================================
    # 1. Math helpers: SE from CI (log scale)
    # =============================================
    def test_seFromCI_log(self):
        """SE(ln) = [ln(upper) - ln(lower)] / (2*1.96)"""
        se = self.js("return seFromCI_log(0.60, 0.86);")
        expected = (math.log(0.86) - math.log(0.60)) / (2 * 1.96)
        self.assertAlmostEqual(se, expected, places=6)

    def test_seFromCI_log_invalid(self):
        """Negative or zero values should return null."""
        self.assertIsNone(self.js("return seFromCI_log(-1, 2);"))
        self.assertIsNone(self.js("return seFromCI_log(0, 2);"))
        self.assertIsNone(self.js("return seFromCI_log(null, 2);"))

    # =============================================
    # 2. Math helpers: SE from CI (linear scale)
    # =============================================
    def test_seFromCI_linear(self):
        se = self.js("return seFromCI_linear(-0.45, -0.17);")
        expected = (-0.17 - (-0.45)) / (2 * 1.96)
        self.assertAlmostEqual(se, expected, places=6)

    # =============================================
    # 3. CI construction on log scale
    # =============================================
    def test_ciLog(self):
        """ciLog(point, se) -> [exp(ln(point)-1.96*se), exp(ln(point)+1.96*se)]"""
        result = self.js("return ciLog(0.72, 0.1);")
        lo = math.exp(math.log(0.72) - 1.96 * 0.1)
        hi = math.exp(math.log(0.72) + 1.96 * 0.1)
        self.assertAlmostEqual(result[0], lo, places=6)
        self.assertAlmostEqual(result[1], hi, places=6)

    def test_ciLog_null_se(self):
        result = self.js("return ciLog(0.72, null);")
        self.assertEqual(result, [None, None])

    # =============================================
    # 4. CI construction on linear scale
    # =============================================
    def test_ciLinear(self):
        result = self.js("return ciLinear(-0.31, 0.07);")
        self.assertAlmostEqual(result[0], -0.31 - 1.96 * 0.07, places=6)
        self.assertAlmostEqual(result[1], -0.31 + 1.96 * 0.07, places=6)

    # =============================================
    # 5. OR -> RR (exact)
    # =============================================
    def test_OR_to_RR(self):
        """RR = OR / (1 - p0 + p0*OR)"""
        rr = self.js("return OR_to_RR(0.72, 0.05);")
        expected = 0.72 / (1 - 0.05 + 0.05 * 0.72)
        self.assertAlmostEqual(rr, expected, places=6)

    def test_OR_to_RR_high_baseline(self):
        """Higher baseline risk should produce a larger RR-OR gap."""
        rr_low = self.js("return OR_to_RR(0.50, 0.05);")
        rr_high = self.js("return OR_to_RR(0.50, 0.40);")
        # With higher p0, RR is closer to 1 than OR (less extreme)
        self.assertGreater(rr_high, rr_low)

    # =============================================
    # 6. RR -> OR
    # =============================================
    def test_RR_to_OR(self):
        """OR = RR*(1-p0) / (1-p0*RR)"""
        or_val = self.js("return RR_to_OR(0.75, 0.10);")
        expected = 0.75 * (1 - 0.10) / (1 - 0.10 * 0.75)
        self.assertAlmostEqual(or_val, expected, places=6)

    def test_OR_RR_roundtrip(self):
        """OR->RR->OR should be identity."""
        orig_or = 1.50
        p0 = 0.20
        rr = self.js(f"return OR_to_RR({orig_or}, {p0});")
        recovered = self.js(f"return RR_to_OR({rr}, {p0});")
        self.assertAlmostEqual(recovered, orig_or, places=6)

    # =============================================
    # 7. OR -> RD
    # =============================================
    def test_OR_to_RD(self):
        """RD = p1 - p0, where p1 = p0*OR / (1-p0+p0*OR)"""
        rd = self.js("return OR_to_RD(0.72, 0.05);")
        p1 = (0.05 * 0.72) / (1 - 0.05 + 0.05 * 0.72)
        expected = p1 - 0.05
        self.assertAlmostEqual(rd, expected, places=6)

    # =============================================
    # 8. RR -> RD
    # =============================================
    def test_RR_to_RD(self):
        """RD = p0 * (RR - 1)"""
        rd = self.js("return RR_to_RD(0.75, 0.10);")
        expected = 0.10 * (0.75 - 1)
        self.assertAlmostEqual(rd, expected, places=6)

    # =============================================
    # 9. RD -> NNT
    # =============================================
    def test_RD_to_NNT(self):
        nnt = self.js("return RD_to_NNT(-0.025);")
        self.assertAlmostEqual(nnt, 1 / 0.025, places=4)

    def test_RD_to_NNT_zero(self):
        """RD near zero should return null."""
        nnt = self.js("return RD_to_NNT(0);")
        self.assertIsNone(nnt)

    # =============================================
    # 10. OR <-> SMD (Chinn 2000)
    # =============================================
    def test_OR_to_SMD(self):
        """SMD = ln(OR) * sqrt(3)/pi"""
        smd = self.js("return OR_to_SMD(0.72);")
        expected = math.log(0.72) * math.sqrt(3) / math.pi
        self.assertAlmostEqual(smd, expected, places=6)

    def test_SMD_to_OR(self):
        """OR = exp(SMD * pi/sqrt(3))"""
        or_val = self.js("return SMD_to_OR(-0.31);")
        expected = math.exp(-0.31 * math.pi / math.sqrt(3))
        self.assertAlmostEqual(or_val, expected, places=5)

    def test_OR_SMD_roundtrip(self):
        """OR -> SMD -> OR should be identity."""
        smd = self.js("return OR_to_SMD(2.5);")
        recovered = self.js(f"return SMD_to_OR({smd});")
        self.assertAlmostEqual(recovered, 2.5, places=6)

    # =============================================
    # 11. MD <-> SMD
    # =============================================
    def test_MD_to_SMD(self):
        smd = self.js("return MD_to_SMD(-3.1, 10.0);")
        self.assertAlmostEqual(smd, -0.31, places=6)

    def test_SMD_to_MD(self):
        md = self.js("return SMD_to_MD(-0.31, 10.0);")
        self.assertAlmostEqual(md, -3.1, places=6)

    def test_MD_to_SMD_invalid_sd(self):
        self.assertIsNone(self.js("return MD_to_SMD(-3.1, 0);"))
        self.assertIsNone(self.js("return MD_to_SMD(-3.1, -5);"))

    # =============================================
    # 12. HR -> OR (proportional hazards)
    # =============================================
    def test_HR_to_OR(self):
        """p1 = 1 - (1-p0)^HR; OR = p1*(1-p0) / (p0*(1-p1))"""
        or_val = self.js("return HR_to_OR(0.87, 0.08);")
        p1 = 1 - (1 - 0.08) ** 0.87
        expected = (p1 * (1 - 0.08)) / (0.08 * (1 - p1))
        self.assertAlmostEqual(or_val, expected, places=5)

    # =============================================
    # 13. HR -> RR (Shor approximation)
    # =============================================
    def test_HR_to_RR_shor(self):
        """RR = HR^0.7"""
        rr = self.js("return HR_to_RR_shor(0.87);")
        expected = 0.87 ** 0.7
        self.assertAlmostEqual(rr, expected, places=6)

    # =============================================
    # 14. SMD -> NNT (chain: SMD->OR->RD->NNT)
    # =============================================
    def test_SMD_to_NNT(self):
        nnt = self.js("return SMD_to_NNT(-0.31, 0.30);")
        self.assertIsNotNone(nnt)
        self.assertGreater(nnt, 0)
        # Manually verify chain
        or_val = math.exp(-0.31 * math.pi / math.sqrt(3))
        p1 = (0.30 * or_val) / (1 - 0.30 + 0.30 * or_val)
        rd = p1 - 0.30
        expected_nnt = 1 / abs(rd)
        self.assertAlmostEqual(nnt, expected_nnt, places=3)

    # =============================================
    # 15. CHINN_FACTOR constant
    # =============================================
    def test_chinn_factor(self):
        cf = self.js("return CHINN_FACTOR;")
        expected = math.sqrt(3) / math.pi
        self.assertAlmostEqual(cf, expected, places=8)

    # =============================================
    # 16. computeAll: OR input with CI and p0
    # =============================================
    def test_computeAll_OR(self):
        """Full conversion from OR with CI and baseline risk."""
        results = self.js("""
            var r = computeAll('OR', 0.72, 0.60, 0.86, 0.05, null, null);
            return r.map(function(x) { return { label: x.label, cat: x.cat, v: x.v, na: x.na, approx: x.approx }; });
        """)
        cats = [r['cat'].upper() for r in results]
        # Should contain RR, RD, NNT, SMD, MD, HR
        self.assertIn('RR', cats)
        self.assertIn('RD', cats)
        self.assertIn('NNT', cats)
        self.assertIn('SMD', cats)
        # RR should have a valid value
        rr_row = next(r for r in results if r['cat'].upper() == 'RR')
        self.assertIsNotNone(rr_row['v'])
        self.assertFalse(rr_row['na'])

    # =============================================
    # 17. computeAll: SMD input without p0
    # =============================================
    def test_computeAll_SMD_no_p0(self):
        """SMD without p0 should produce OR but not RR/RD/NNT."""
        results = self.js("""
            var r = computeAll('SMD', -0.31, -0.45, -0.17, null, null, null);
            return r.map(function(x) { return { cat: x.cat, v: x.v, na: x.na }; });
        """)
        or_row = next(r for r in results if r['cat'].upper() == 'OR')
        self.assertIsNotNone(or_row['v'])
        rr_row = next(r for r in results if r['cat'].upper() == 'RR')
        self.assertTrue(rr_row['na'])

    # =============================================
    # 18. computeAll: NNT input
    # =============================================
    def test_computeAll_NNT(self):
        """NNT=25 -> RD=0.04"""
        results = self.js("""
            var r = computeAll('NNT', 25, null, null, 0.10, null, null);
            return r.map(function(x) { return { cat: x.cat, v: x.v }; });
        """)
        rd_row = next(r for r in results if r['cat'].upper() == 'RD')
        self.assertIsNotNone(rd_row['v'])
        self.assertAlmostEqual(rd_row['v'], 1.0 / 25.0, places=4)

    # =============================================
    # 19. Delta method: computeRR_CI
    # =============================================
    def test_computeRR_CI(self):
        result = self.js("return computeRR_CI(0.72, 0.09, 0.05);")
        self.assertIsNotNone(result['val'])
        self.assertIsNotNone(result['lo'])
        self.assertIsNotNone(result['hi'])
        self.assertLess(result['lo'], result['val'])
        self.assertGreater(result['hi'], result['val'])

    # =============================================
    # 20. Delta method: computeRD_CI
    # =============================================
    def test_computeRD_CI(self):
        result = self.js("return computeRD_CI(0.72, 0.09, 0.05);")
        self.assertIsNotNone(result['val'])
        self.assertLess(result['val'], 0)  # Protective OR -> negative RD
        self.assertLess(result['lo'], result['val'])
        self.assertGreater(result['hi'], result['val'])

    # =============================================
    # 21. NNT CI computation
    # =============================================
    def test_computeNNT_CI_normal(self):
        result = self.js("return computeNNT_CI(-0.04, 0.01);")
        self.assertAlmostEqual(result['val'], 25.0, places=1)
        self.assertIsNotNone(result['lo'])
        self.assertIsNotNone(result['hi'])

    def test_computeNNT_CI_crosses_zero(self):
        """When RD CI crosses zero, NNT CI is undefined."""
        result = self.js("return computeNNT_CI(-0.01, 0.02);")
        self.assertTrue(result.get('crossesZero', False))

    # =============================================
    # 22. Example dataset loading (UI)
    # =============================================
    def test_load_example_statin(self):
        """Load statin example and verify inputs are populated."""
        self.js("loadExample(0);")
        time.sleep(0.3)
        val = self.drv.find_element(By.ID, 'inputValue').get_attribute('value')
        self.assertEqual(val, '0.72')
        measure = self.drv.find_element(By.ID, 'inputMeasure').get_attribute('value')
        self.assertEqual(measure, 'OR')
        baseline = self.drv.find_element(By.ID, 'inputBaseline').get_attribute('value')
        self.assertEqual(baseline, '0.05')

    def test_load_example_ssri(self):
        self.js("loadExample(1);")
        time.sleep(0.3)
        measure = self.drv.find_element(By.ID, 'inputMeasure').get_attribute('value')
        self.assertEqual(measure, 'SMD')
        val = self.drv.find_element(By.ID, 'inputValue').get_attribute('value')
        self.assertEqual(val, '-0.31')

    def test_load_example_sglt2i(self):
        self.js("loadExample(2);")
        time.sleep(0.3)
        measure = self.drv.find_element(By.ID, 'inputMeasure').get_attribute('value')
        self.assertEqual(measure, 'HR')

    # =============================================
    # 23. Results card visibility
    # =============================================
    def test_results_card_shown_after_conversion(self):
        self.js("loadExample(0);")
        time.sleep(0.3)
        display = self.js("return document.getElementById('resultsCard').style.display;")
        self.assertEqual(display, 'block')

    def test_results_card_hidden_after_clear(self):
        self.js("loadExample(0);")
        time.sleep(0.2)
        self.js("clearInputs();")
        time.sleep(0.2)
        display = self.js("return document.getElementById('resultsCard').style.display;")
        self.assertEqual(display, 'none')

    # =============================================
    # 24. Result rows present after conversion
    # =============================================
    def test_result_rows_count(self):
        """After loading statin example, results grid should have multiple rows."""
        self.js("loadExample(0);")
        time.sleep(0.3)
        count = self.js("return document.querySelectorAll('#resultsGrid .result-row').length;")
        # OR input produces: RR, RD, NNT, SMD, MD, HR = 6 rows
        self.assertGreaterEqual(count, 5)

    # =============================================
    # 25. Tab switching
    # =============================================
    def test_tab_switch_to_batch(self):
        self.js("switchTab('batch');")
        time.sleep(0.2)
        active = self.js("return document.getElementById('tab-batch').classList.contains('active');")
        self.assertTrue(active)

    def test_tab_switch_to_formulas(self):
        self.js("switchTab('formulas');")
        time.sleep(0.2)
        active = self.js("return document.getElementById('tab-formulas').classList.contains('active');")
        self.assertTrue(active)

    def test_tab_switch_to_about(self):
        self.js("switchTab('about');")
        time.sleep(0.2)
        active = self.js("return document.getElementById('tab-about').classList.contains('active');")
        self.assertTrue(active)

    def test_tab_switch_back_to_single(self):
        self.js("switchTab('batch');")
        self.js("switchTab('single');")
        time.sleep(0.2)
        active = self.js("return document.getElementById('tab-single').classList.contains('active');")
        self.assertTrue(active)

    # =============================================
    # 26. Batch mode
    # =============================================
    def test_batch_example_load_and_run(self):
        self.js("switchTab('batch');")
        time.sleep(0.2)
        self.js("loadBatchExample();")
        time.sleep(0.5)
        rows = self.js("return batchResultsData.length;")
        self.assertEqual(rows, 5)  # 5 lines in the batch example

    def test_batch_results_have_correct_measures(self):
        self.js("switchTab('batch');")
        self.js("loadBatchExample();")
        time.sleep(0.3)
        measures = self.js("return batchResultsData.map(function(e){return e.measure;});")
        self.assertEqual(measures, ['OR', 'HR', 'SMD', 'RR', 'RD'])

    def test_batch_invalid_row(self):
        """Invalid measure should produce error entry."""
        self.js("""
            document.getElementById('batchInput').value = 'INVALID, 1.5, 1.0, 2.0, 0.1';
            runBatch();
        """)
        time.sleep(0.3)
        error = self.js("return batchResultsData[0].error;")
        self.assertEqual(error, 'Invalid input')

    # =============================================
    # 27. Theme toggle
    # =============================================
    def test_theme_toggle(self):
        # Start in dark mode (default)
        self.js("document.body.classList.remove('light-mode');")
        self.js("toggleTheme();")
        has_light = self.js("return document.body.classList.contains('light-mode');")
        self.assertTrue(has_light)
        self.js("toggleTheme();")
        has_light2 = self.js("return document.body.classList.contains('light-mode');")
        self.assertFalse(has_light2)

    # =============================================
    # 28. Format helpers
    # =============================================
    def test_fmt_null(self):
        self.assertIsNone(self.js("return fmt(null, 3);"))
        self.assertIsNone(self.js("return fmt(undefined, 3);"))
        self.assertIsNone(self.js("return fmt(Infinity, 3);"))

    def test_fmt_normal(self):
        result = self.js("return fmt(0.72345, 3);")
        self.assertEqual(result, '0.723')

    def test_fmtCI_normal(self):
        result = self.js("return fmtCI(0.60, 0.86, 3);")
        self.assertEqual(result, '[0.600, 0.860]')

    def test_fmtCI_null(self):
        result = self.js("return fmtCI(null, 0.86, 3);")
        self.assertEqual(result, 'CI N/A')

    # =============================================
    # 29. Edge: OR=1 (null effect)
    # =============================================
    def test_OR_1_null_effect(self):
        """OR=1 -> RR=1, RD=0, SMD=0"""
        results = self.js("""
            var r = computeAll('OR', 1.0, null, null, 0.10, null, null);
            return r.map(function(x) { return { cat: x.cat, v: x.v }; });
        """)
        rr = next(r for r in results if r['cat'].upper() == 'RR')
        self.assertAlmostEqual(rr['v'], 1.0, places=6)
        rd = next(r for r in results if r['cat'].upper() == 'RD')
        self.assertAlmostEqual(rd['v'], 0.0, places=6)
        smd = next(r for r in results if r['cat'].upper() == 'SMD')
        self.assertAlmostEqual(smd['v'], 0.0, places=6)

    # =============================================
    # 30. Edge: Large OR
    # =============================================
    def test_large_OR(self):
        """OR=10 should still produce valid results."""
        results = self.js("""
            var r = computeAll('OR', 10.0, null, null, 0.05, null, null);
            return r.map(function(x) { return { cat: x.cat, v: x.v }; });
        """)
        rr = next(r for r in results if r['cat'].upper() == 'RR')
        self.assertIsNotNone(rr['v'])
        self.assertGreater(rr['v'], 1.0)
        smd = next(r for r in results if r['cat'].upper() == 'SMD')
        self.assertGreater(smd['v'], 0)

    # =============================================
    # 31. fmtVal and fmtCI2
    # =============================================
    def test_fmtVal_NNT(self):
        """NNT should be formatted to 1 decimal place."""
        result = self.js("return fmtVal('nnt', 25.456);")
        self.assertEqual(result, '25.5')

    def test_fmtVal_OR(self):
        result = self.js("return fmtVal('or', 0.72345);")
        self.assertEqual(result, '0.723')

    # =============================================
    # 32. computeAll: MD with SD
    # =============================================
    def test_computeAll_MD_with_SD(self):
        results = self.js("""
            var r = computeAll('MD', -3.1, -4.5, -1.7, null, 10.0, null);
            return r.map(function(x) { return { cat: x.cat, v: x.v, na: x.na }; });
        """)
        smd_row = next(r for r in results if r['cat'].upper() == 'SMD')
        self.assertIsNotNone(smd_row['v'])
        self.assertAlmostEqual(smd_row['v'], -0.31, places=2)
        or_row = next(r for r in results if r['cat'].upper() == 'OR')
        self.assertIsNotNone(or_row['v'])

    def test_computeAll_MD_without_SD(self):
        results = self.js("""
            var r = computeAll('MD', -3.1, -4.5, -1.7, null, null, null);
            return r.map(function(x) { return { cat: x.cat, na: x.na }; });
        """)
        smd_row = next(r for r in results if r['cat'].upper() == 'SMD')
        self.assertTrue(smd_row['na'])

    # =============================================
    # 33. computeAll: RD input
    # =============================================
    def test_computeAll_RD_with_p0(self):
        results = self.js("""
            var r = computeAll('RD', -0.04, -0.07, -0.01, 0.08, null, null);
            return r.map(function(x) { return { cat: x.cat, v: x.v, na: x.na }; });
        """)
        nnt_row = next(r for r in results if r['cat'].upper() == 'NNT')
        self.assertIsNotNone(nnt_row['v'])
        self.assertAlmostEqual(nnt_row['v'], 25.0, places=0)
        rr_row = next(r for r in results if r['cat'].upper() == 'RR')
        self.assertIsNotNone(rr_row['v'])
        # RR = 1 + RD/p0 = 1 + (-0.04)/0.08 = 0.5
        self.assertAlmostEqual(rr_row['v'], 0.5, places=4)

    # =============================================
    # 34. HR conversion with and without p0
    # =============================================
    def test_computeAll_HR_with_p0(self):
        results = self.js("""
            var r = computeAll('HR', 0.87, 0.78, 0.97, 0.08, null, null);
            return r.map(function(x) { return { cat: x.cat, v: x.v, approx: x.approx, na: x.na }; });
        """)
        or_row = next(r for r in results if r['cat'].upper() == 'OR')
        self.assertIsNotNone(or_row['v'])
        self.assertTrue(or_row['approx'])  # HR->OR is approximate

    def test_computeAll_HR_without_p0(self):
        results = self.js("""
            var r = computeAll('HR', 0.87, 0.78, 0.97, null, null, null);
            return r.map(function(x) { return { cat: x.cat, v: x.v, na: x.na }; });
        """)
        # Without p0: OR should be N/A, but RR via Shor should exist
        or_row = next(r for r in results if r['cat'].upper() == 'OR')
        self.assertTrue(or_row['na'])
        rr_row = next(r for r in results if r['cat'].upper() == 'RR')
        self.assertIsNotNone(rr_row['v'])

    # =============================================
    # 35. Status message after conversion
    # =============================================
    def test_status_message_after_conversion(self):
        self.js("switchTab('single');")
        self.js("loadExample(0);")
        time.sleep(0.3)
        msg = self.drv.find_element(By.ID, 'statusMsg').text
        self.assertIn('Converted from OR', msg)


if __name__ == '__main__':
    unittest.main(verbosity=2)
