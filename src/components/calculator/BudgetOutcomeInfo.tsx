import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface BudgetOutcomeInfoProps {
  objectNumber: string | null;
  calculationCostsByUkonto?: Record<string, number>;
}

interface RawRow {
  vht: string;
  ansvar: string;
  ukonto: string;
  ukontoCode: string;
  utfall_ack: number;
  budget_2025: number;
  budget_2026: number;
}

interface UkontoRow {
  ukonto: string;
  utfall_ack: number;
  budget_2025: number;
  budget_2026: number;
  kalkyl: number;
}

export default function BudgetOutcomeInfo({ objectNumber, calculationCostsByUkonto = {} }: BudgetOutcomeInfoProps) {
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [selectedAnsvar, setSelectedAnsvar] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!objectNumber) {
      setRawRows([]);
      setSelectedAnsvar(new Set());
      return;
    }
    loadBudgetData(objectNumber);
  }, [objectNumber]);

  async function loadBudgetData(objNr: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('budget_outcomes')
        .select('vht, ansvar, ukonto, budget_2025, budget_2026, utfall_ack, mot, objekt')
        .not('objekt', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        setRawRows([]);
        return;
      }

      const matched = data.filter((row) => {
        if (!row.objekt) return false;
        return row.objekt.split(' ')[0].trim() === objNr;
      });

      const rows: RawRow[] = matched.map((row) => {
        const ukontoRaw = row.ukonto || '(tomt)';
        const codeMatch = ukontoRaw.match(/^(\d{4,6})/);
        return {
          vht: row.vht || '(tomt)',
          ansvar: row.ansvar || '(tomt)',
          ukonto: ukontoRaw,
          ukontoCode: codeMatch ? codeMatch[1] : ukontoRaw,
          utfall_ack: row.utfall_ack || 0,
          budget_2025: row.budget_2025 || 0,
          budget_2026: row.budget_2026 || 0,
        };
      });

      setRawRows(rows);
      setSelectedAnsvar(new Set(rows.map(r => r.ansvar)));
    } catch (error) {
      console.error('Error loading budget data:', error);
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }

  const uniqueAnsvar = useMemo(() => 
    Array.from(new Set(rawRows.map(r => r.ansvar))).sort((a, b) => a.localeCompare(b, 'sv')),
    [rawRows]
  );

  function extractVhtCode(vht: string): string {
    const match = vht.match(/^(\d{4,6})/);
    return match ? match[1] : vht;
  }

  const rows = useMemo(() => {
    const filtered = rawRows.filter(r => selectedAnsvar.has(r.ansvar));
    const map = new Map<string, UkontoRow>();
    filtered.forEach((row) => {
      const key = row.ukonto;
      const existing = map.get(key);
      if (existing) {
        existing.utfall_ack += row.utfall_ack;
        existing.budget_2025 += row.budget_2025;
        existing.budget_2026 += row.budget_2026;
        // kalkyl already set once for this ukonto group - don't add again
      } else {
        const rowKalkyl = getKalkylCostForUkonto(row.ukontoCode);
        map.set(key, {
          ukonto: key,
          utfall_ack: row.utfall_ack,
          budget_2025: row.budget_2025,
          budget_2026: row.budget_2026,
          kalkyl: rowKalkyl,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.ukonto.localeCompare(b.ukonto, 'sv'));
  }, [rawRows, selectedAnsvar, calculationCostsByUkonto]);

  function getKalkylCostForUkonto(ukontoCode: string): number {
    // Exact match first
    let cost = calculationCostsByUkonto[ukontoCode] || 0;
    if (cost !== 0) return cost;
    // Prefix matching (pricing_config may have 4-5 digit ukonto that matches start of 6-digit budget ukonto)
    for (const [pricingUkonto, pCost] of Object.entries(calculationCostsByUkonto)) {
      if (ukontoCode.startsWith(pricingUkonto) || pricingUkonto.startsWith(ukontoCode)) {
        cost += pCost;
      }
    }
    return cost;
  }

  function toggleAnsvar(ansvar: string) {
    setSelectedAnsvar(prev => {
      const next = new Set(prev);
      if (next.has(ansvar)) next.delete(ansvar);
      else next.add(ansvar);
      return next;
    });
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(value);
  }

  if (!objectNumber) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rawRows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ingen budget-/utfallsdata hittades för objekt {objectNumber}
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasKalkylData = Object.keys(calculationCostsByUkonto).length > 0;

  const incomeRows = rows.filter(r => r.budget_2026 >= 0);
  const costRows = rows.filter(r => r.budget_2026 < 0);

  const sumRows = (arr: UkontoRow[]) => arr.reduce(
    (acc, r) => ({
      utfall_ack: acc.utfall_ack + r.utfall_ack,
      budget_2025: acc.budget_2025 + r.budget_2025,
      budget_2026: acc.budget_2026 + r.budget_2026,
      kalkyl: acc.kalkyl + r.kalkyl,
    }),
    { utfall_ack: 0, budget_2025: 0, budget_2026: 0, kalkyl: 0 }
  );

  const incomeTotals = sumRows(incomeRows);
  const costTotals = sumRows(costRows);
  const grandTotals = sumRows(rows);

  function openDetailPopup() {
    const popup = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
    if (!popup) return;

    const filteredRows = rawRows.filter(r => selectedAnsvar.has(r.ansvar));
    const allAnsvar = uniqueAnsvar;
    const kalkylMap = calculationCostsByUkonto;

    let html = `<!DOCTYPE html><html><head><title>Budget, utfall och kalkyler – Objekt ${objectNumber}</title>
<style>
body{font-family:system-ui,sans-serif;margin:20px;color:#333}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb;font-size:14px}
th{background:#f3f4f6;font-weight:600;font-size:13px}
.right{text-align:right}
.section{background:#f9fafb;font-weight:600;padding:6px 12px;font-size:13px}
.subtotal{font-weight:600;border-top:2px solid #d1d5db}
.grand{font-weight:700;border-top:3px solid #6b7280;font-size:15px}
.indent{padding-left:24px}
.loading{text-align:center;padding:40px;color:#999}
.primary{color:#005595;font-weight:600}
.filter-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:16px}
.filter-box h3{margin:0 0 8px;font-size:14px;color:#555}
.filter-items{display:flex;flex-wrap:wrap;gap:8px}
.filter-item{display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer}
.filter-item input{cursor:pointer}
.filter-actions{margin-top:8px;display:flex;gap:8px}
.filter-btn{background:#e5e7eb;border:none;padding:4px 10px;border-radius:4px;font-size:12px;cursor:pointer}
.filter-btn:hover{background:#d1d5db}
</style></head><body>`;

    html += `<h2>Budget, utfall och kalkyler – Objekt ${objectNumber}</h2>`;

    // Ansvar filter
    html += '<div class="filter-box"><h3>Inkluderade ansvar</h3><div class="filter-items">';
    allAnsvar.forEach(a => {
      const checked = selectedAnsvar.has(a) ? 'checked' : '';
      html += `<label class="filter-item"><input type="checkbox" ${checked} data-ansvar="${a.replace(/"/g, '&quot;')}" onchange="filterRows()"> ${a}</label>`;
    });
    html += '</div><div class="filter-actions"><button class="filter-btn" onclick="toggleAll(true)">Markera alla</button><button class="filter-btn" onclick="toggleAll(false)">Avmarkera alla</button></div></div>';
    html += '<div id="table-container"></div>';

    const hasKalkyl = Object.keys(kalkylMap).length > 0;

    html += '<script>';
    html += 'var allRows = ' + JSON.stringify(filteredRows.length > 0 ? rawRows.map(r => ({ vht: r.vht, ansvar: r.ansvar, ukonto: r.ukonto, ukontoCode: r.ukontoCode, utfall_ack: r.utfall_ack, budget_2025: r.budget_2025, budget_2026: r.budget_2026 })) : []) + ';';
    html += 'var kalkylMap = ' + JSON.stringify(kalkylMap) + ';';
    html += 'var hasKalkyl = ' + JSON.stringify(hasKalkyl) + ';';
    html += 'function fmt(n) { return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n); }';
    html += 'function toggleAll(state) { document.querySelectorAll("[data-ansvar]").forEach(function(cb) { cb.checked = state; }); filterRows(); }';
    html += 'function getKalkylForUkonto(code) { var c = kalkylMap[code] || 0; if (c !== 0) return c; for (var u in kalkylMap) { if (code.indexOf(u) === 0 || u.indexOf(code) === 0) c += kalkylMap[u]; } return c; }';
    html += 'function filterRows() {';
    html += '  var checked = []; document.querySelectorAll("[data-ansvar]:checked").forEach(function(cb) { checked.push(cb.getAttribute("data-ansvar")); });';
    html += '  var filtered = allRows.filter(function(r) { return checked.indexOf(r.ansvar) >= 0; });';
    html += '  var map = {};';
    html += '  filtered.forEach(function(r) { var k = r.ukonto; if (!map[k]) { map[k] = { ukonto: k, utfall_ack: 0, budget_2025: 0, budget_2026: 0, kalkyl: getKalkylForUkonto(r.ukontoCode) }; } map[k].utfall_ack += r.utfall_ack; map[k].budget_2025 += r.budget_2025; map[k].budget_2026 += r.budget_2026; });';
    html += '  var grouped = Object.values(map).sort(function(a, b) { return a.ukonto.localeCompare(b.ukonto, "sv"); });';
    html += '  var incomeRows = grouped.filter(function(r) { return r.budget_2026 >= 0; });';
    html += '  var costRows = grouped.filter(function(r) { return r.budget_2026 < 0; });';
    html += '  var cols = hasKalkyl ? 5 : 4;';
    html += '  var h = "<table><thead><tr><th>Konto</th><th class=\\"right\\">Utfall ack.</th><th class=\\"right\\">Budget 2025</th><th class=\\"right\\">Budget 2026</th>";';
    html += '  if (hasKalkyl) h += "<th class=\\"right primary\\">Denna kalkyl</th>";';
    html += '  h += "</tr></thead><tbody>";';
    html += '  function sumArr(arr) { return arr.reduce(function(a,r) { return { utfall_ack: a.utfall_ack+r.utfall_ack, budget_2025: a.budget_2025+r.budget_2025, budget_2026: a.budget_2026+r.budget_2026, kalkyl: a.kalkyl+r.kalkyl }; }, { utfall_ack:0, budget_2025:0, budget_2026:0, kalkyl:0 }); }';
    html += '  function renderSection(title, sRows) {';
    html += '    var t = sumArr(sRows);';
    html += '    h += "<tr><td colspan=\\"" + cols + "\\" class=\\"section\\">" + title + "</td></tr>";';
    html += '    sRows.forEach(function(r) { h += "<tr><td class=\\"indent\\">" + r.ukonto + "</td><td class=\\"right\\">" + fmt(r.utfall_ack) + "</td><td class=\\"right\\">" + fmt(r.budget_2025) + "</td><td class=\\"right\\">" + fmt(r.budget_2026) + "</td>"; if (hasKalkyl) h += "<td class=\\"right primary\\">" + (r.kalkyl !== 0 ? fmt(r.kalkyl) : "–") + "</td>"; h += "</tr>"; });';
    html += '    h += "<tr class=\\"subtotal\\"><td class=\\"indent\\">Summa " + title.toLowerCase() + "</td><td class=\\"right\\">" + fmt(t.utfall_ack) + "</td><td class=\\"right\\">" + fmt(t.budget_2025) + "</td><td class=\\"right\\">" + fmt(t.budget_2026) + "</td>";';
    html += '    if (hasKalkyl) h += "<td class=\\"right primary\\">" + (t.kalkyl !== 0 ? fmt(t.kalkyl) : "–") + "</td>";';
    html += '    h += "</tr>";';
    html += '  }';
    html += '  if (incomeRows.length > 0) renderSection("Intäkter", incomeRows);';
    html += '  if (costRows.length > 0) renderSection("Kostnader", costRows);';
    html += '  var grand = sumArr(grouped);';
    html += '  h += "<tr class=\\"grand\\"><td>Netto</td><td class=\\"right\\">" + fmt(grand.utfall_ack) + "</td><td class=\\"right\\">" + fmt(grand.budget_2025) + "</td><td class=\\"right\\">" + fmt(grand.budget_2026) + "</td>";';
    html += '  if (hasKalkyl) h += "<td class=\\"right primary\\">" + fmt(grand.kalkyl) + "</td>";';
    html += '  h += "</tr></tbody></table>";';
    html += '  document.getElementById("table-container").innerHTML = h;';
    html += '}';
    html += 'filterRows();';
    html += '<\/script>';

    html += '</body></html>';
    popup.document.write(html);
    popup.document.close();
    // Re-execute scripts
    const scripts = popup.document.querySelectorAll('script');
    scripts.forEach((s: any) => {
      const ns = popup!.document.createElement('script');
      ns.textContent = s.textContent;
      s.parentNode!.replaceChild(ns, s);
    });
  }

  const renderSummarySection = (title: string, totals: { utfall_ack: number; budget_2025: number; budget_2026: number; kalkyl: number }) => (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="space-y-0.5 pl-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Utfall ack.</span>
          <span className="font-mono">{formatNumber(totals.utfall_ack)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Budget 2025</span>
          <span className="font-mono">{formatNumber(totals.budget_2025)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Budget 2026</span>
          <span className="font-mono">{formatNumber(totals.budget_2026)}</span>
        </div>
        {hasKalkylData && (
          <div className="flex justify-between text-xs">
            <span className="text-primary font-medium">Denna kalkyl</span>
            <span className="font-mono text-primary font-medium">
              {totals.kalkyl !== 0 ? formatNumber(totals.kalkyl) : '–'}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Budget, utfall och kalkyler
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ansvar filter */}
        {uniqueAnsvar.length > 0 && (
          <div className="rounded-md border p-2 bg-muted/30 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Inkluderade ansvar ({selectedAnsvar.size}/{uniqueAnsvar.length})</p>
            <div className="flex flex-wrap gap-2">
              {uniqueAnsvar.map(a => (
                <label key={a} className="flex items-center gap-1 text-xs cursor-pointer">
                  <Checkbox
                    checked={selectedAnsvar.has(a)}
                    onCheckedChange={() => toggleAnsvar(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => setSelectedAnsvar(new Set(uniqueAnsvar))}>
                Alla
              </Button>
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => setSelectedAnsvar(new Set())}>
                Inga
              </Button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Inga ansvar valda</p>
        ) : (
          <div className="space-y-3">
            {incomeRows.length > 0 && renderSummarySection('Intäkter', incomeTotals)}
            {costRows.length > 0 && renderSummarySection('Kostnader', costTotals)}
            <div className="border-t-2 border-border pt-2 space-y-0.5">
              <p className="text-xs font-semibold">Netto</p>
              <div className="space-y-0.5 pl-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Utfall ack.</span>
                  <span className="font-mono font-medium">{formatNumber(grandTotals.utfall_ack)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Budget 2025</span>
                  <span className="font-mono font-medium">{formatNumber(grandTotals.budget_2025)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Budget 2026</span>
                  <span className="font-mono font-medium">{formatNumber(grandTotals.budget_2026)}</span>
                </div>
                {hasKalkylData && (
                  <div className="flex justify-between text-xs">
                    <span className="text-primary font-semibold">Denna kalkyl</span>
                    <span className="font-mono text-primary font-semibold">{formatNumber(grandTotals.kalkyl)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs"
          onClick={openDetailPopup}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Visa detaljer (öppnas i eget fönster)
        </Button>
      </CardContent>
    </Card>
  );
}
