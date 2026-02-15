import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, GitCompareArrows, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

interface CalculationOption {
  id: string;
  name: string | null;
  ci_identity: string;
  total_cost: number;
  version: number;
  status: string;
  calculation_year: number;
}

interface CalculationVersion {
  id: string;
  calculation_id: string;
  version: number;
  total_cost: number;
  status: string;
  items: unknown;
  created_at: string;
  name: string | null;
  ci_identity: string;
}

interface BudgetOutcome {
  id: string;
  objekt: string | null;
  ansvar: string | null;
  ukonto: string | null;
  budget_2025: number | null;
  budget_2026: number | null;
  utfall_ack: number | null;
  diff: number | null;
  import_label: string | null;
  extraction_date: string | null;
}

interface ConfigItem {
  id: string;
  ci_number: string;
  system_name: string;
  object_number: string | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export default function BudgetComparisonTab() {
  const [calculations, setCalculations] = useState<CalculationOption[]>([]);
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState<string>('');
  const [versions, setVersions] = useState<CalculationVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('current');
  const [budgetData, setBudgetData] = useState<BudgetOutcome[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load calculations and config items on mount
  useEffect(() => {
    async function load() {
      const [calcsRes, ciRes] = await Promise.all([
        supabase
          .from('calculations')
          .select('id, name, ci_identity, total_cost, version, status, calculation_year')
          .order('name', { ascending: true }),
        supabase
          .from('configuration_items')
          .select('id, ci_number, system_name, object_number')
          .eq('is_active', true),
      ]);
      setCalculations(calcsRes.data || []);
      setConfigItems(ciRes.data || []);
      setInitialLoading(false);
    }
    load();
  }, []);

  // When a calculation is selected, load its versions and budget data
  useEffect(() => {
    if (!selectedCalcId) {
      setVersions([]);
      setBudgetData([]);
      return;
    }

    async function loadDetails() {
      setLoading(true);
      const calc = calculations.find(c => c.id === selectedCalcId);
      if (!calc) { setLoading(false); return; }

      // Load versions
      const { data: versionsData } = await supabase
        .from('calculation_versions')
        .select('id, calculation_id, version, total_cost, status, items, created_at, name, ci_identity')
        .eq('calculation_id', selectedCalcId)
        .order('version', { ascending: false });

      setVersions(versionsData || []);
      setSelectedVersion('current');

      // Find object_number via CI - ci_identity is the UUID (id) of the configuration_item
      const ci = configItems.find(c => c.id === calc.ci_identity);
      const objectNumber = ci?.object_number;

      if (objectNumber) {
        // Budget data uses 'objekt' column with format "6110700 Lagring" - match by prefix
        const { data: budgetRows } = await supabase
          .from('budget_outcomes')
          .select('id, objekt, ansvar, ukonto, budget_2025, budget_2026, utfall_ack, diff, import_label, extraction_date, mot')
          .not('objekt', 'is', null);
        
        // Filter rows where objekt starts with the object number
        const matchedRows = (budgetRows || []).filter((r: any) => 
          r.objekt && r.objekt.toString().split(' ')[0].trim() === objectNumber
        );
        setBudgetData(matchedRows);
      } else {
        setBudgetData([]);
      }

      setLoading(false);
    }
    loadDetails();
  }, [selectedCalcId, calculations, configItems]);

  const selectedCalc = calculations.find(c => c.id === selectedCalcId);
  const selectedCI = selectedCalc ? configItems.find(c => c.id === selectedCalc.ci_identity) : null;

  const currentCalcCost = useMemo(() => {
    if (!selectedCalc) return 0;
    if (selectedVersion === 'current') return Number(selectedCalc.total_cost);
    const ver = versions.find(v => v.id === selectedVersion);
    return ver ? Number(ver.total_cost) : Number(selectedCalc.total_cost);
  }, [selectedCalc, selectedVersion, versions]);

  const budgetTotal2025 = budgetData.reduce((s, r) => s + Number(r.budget_2025 || 0), 0);
  const budgetTotal2026 = budgetData.reduce((s, r) => s + Number(r.budget_2026 || 0), 0);
  const utfallTotal = budgetData.reduce((s, r) => s + Number(r.utfall_ack || 0), 0);

  const filteredCalcs = useMemo(() => {
    if (!searchQuery) return calculations;
    const q = searchQuery.toLowerCase();
    return calculations.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      c.ci_identity.toLowerCase().includes(q)
    );
  }, [calculations, searchQuery]);

  const chartData = selectedCalc ? [
    { name: 'Kalkyl', value: currentCalcCost },
    { name: 'Budget 2025', value: budgetTotal2025 },
    { name: 'Budget 2026', value: budgetTotal2026 },
    { name: 'Utfall ack.', value: utfallTotal },
  ] : [];

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5" />
          Jämför kalkyl med budget & utfall
        </CardTitle>
        <CardDescription>
          Välj en kalkyl för att jämföra med budget- och utfallsdata baserat på objektnummer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selection controls */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sök och välj kalkyl</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på namn eller CI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedCalcId} onValueChange={setSelectedCalcId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj kalkyl" />
              </SelectTrigger>
              <SelectContent>
                {filteredCalcs.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name || c.ci_identity} — {c.ci_identity} (v{c.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCalcId && versions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Version</label>
              <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">
                    Aktuell (v{selectedCalc?.version}) — {formatCurrency(Number(selectedCalc?.total_cost || 0))}
                  </SelectItem>
                  {versions.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      v{v.version} — {formatCurrency(v.total_cost)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedCI && (
            <div className="space-y-2">
              <label className="text-sm font-medium">CI-information</label>
              <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
                <div><span className="text-muted-foreground">CI:</span> {selectedCI.ci_number}</div>
                <div><span className="text-muted-foreground">System:</span> {selectedCI.system_name}</div>
                <div>
                  <span className="text-muted-foreground">Objektnr:</span>{' '}
                  {selectedCI.object_number ? (
                    <Badge variant="secondary">{selectedCI.object_number}</Badge>
                  ) : (
                    <span className="text-destructive">Saknas</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {selectedCalcId && !loading && (
          <>
            {!selectedCI?.object_number ? (
              <div className="text-center py-8 text-muted-foreground">
                Vald kalkyl har ingen CI med objektnummer. Kan inte jämföra med budget & utfall.
              </div>
            ) : budgetData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Ingen budget- eller utfallsdata hittades för objektnummer <strong>{selectedCI.object_number}</strong>.
              </div>
            ) : (
              <>
                {/* Summary comparison chart */}
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, i) => {
                          const colors = [
                            'hsl(var(--primary))',
                            'hsl(var(--chart-1))',
                            'hsl(var(--chart-2))',
                            'hsl(var(--chart-3))',
                          ];
                          return <Cell key={i} fill={colors[i % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Kalkylkostnad</p>
                    <p className="text-xl font-bold font-mono text-primary">{formatCurrency(currentCalcCost)}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Budget 2025</p>
                    <p className="text-xl font-bold font-mono">{formatCurrency(budgetTotal2025)}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Budget 2026</p>
                    <p className="text-xl font-bold font-mono">{formatCurrency(budgetTotal2026)}</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Utfall ack.</p>
                    <p className="text-xl font-bold font-mono">{formatCurrency(utfallTotal)}</p>
                  </div>
                </div>

                {/* Diff analysis */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Kalkyl vs Budget 2025</p>
                    <p className={`text-lg font-bold font-mono ${currentCalcCost - budgetTotal2025 > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {currentCalcCost - budgetTotal2025 > 0 ? '+' : ''}{formatCurrency(currentCalcCost - budgetTotal2025)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-sm text-muted-foreground">Kalkyl vs Utfall ack.</p>
                    <p className={`text-lg font-bold font-mono ${currentCalcCost - utfallTotal > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {currentCalcCost - utfallTotal > 0 ? '+' : ''}{formatCurrency(currentCalcCost - utfallTotal)}
                    </p>
                  </div>
                </div>

                {/* Button to open budget detail in popup */}
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const objNr = selectedCI.object_number;
                    const popup = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
                    if (!popup) return;
                    const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n);
                    
                    // Get unique ansvar values
                    const uniqueAnsvar = Array.from(new Set(budgetData.map(r => r.ansvar || '(tomt)'))).sort((a, b) => a.localeCompare(b, 'sv'));
                    
                    let html = '<html><head><title>Budgetrader – Objekt ' + objNr + '</title>';
                    html += '<style>body{font-family:system-ui,sans-serif;margin:20px;color:#333}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb;font-size:14px}th{background:#f3f4f6;font-weight:600;font-size:13px}.right{text-align:right}.total{font-weight:600;background:#f9fafb;border-top:2px solid #d1d5db}.neg{color:#dc2626}.filter-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:16px}.filter-box h3{margin:0 0 8px;font-size:14px;color:#555}.filter-items{display:flex;flex-wrap:wrap;gap:8px}.filter-item{display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer}.filter-item input{cursor:pointer}.filter-actions{margin-top:8px;display:flex;gap:8px}.filter-btn{background:#e5e7eb;border:none;padding:4px 10px;border-radius:4px;font-size:12px;cursor:pointer}.filter-btn:hover{background:#d1d5db}</style>';
                    html += '</head><body>';
                    html += '<h2>Budgetrader – Objekt ' + objNr + '</h2>';
                    
                    // Ansvar filter section
                    html += '<div class="filter-box"><h3>Inkluderade ansvar</h3><div class="filter-items">';
                    uniqueAnsvar.forEach(a => {
                      html += '<label class="filter-item"><input type="checkbox" checked data-ansvar="' + a.replace(/"/g, '&quot;') + '" onchange="filterRows()"> ' + a + '</label>';
                    });
                    html += '</div><div class="filter-actions"><button class="filter-btn" onclick="toggleAll(true)">Markera alla</button><button class="filter-btn" onclick="toggleAll(false)">Avmarkera alla</button></div></div>';
                    
                    html += '<div id="table-container"></div>';
                    
                    // Store data as JSON for JS filtering
                    html += '<script>';
                    html += 'var allData = ' + JSON.stringify(budgetData.map(r => ({ ansvar: r.ansvar || '(tomt)', ukonto: r.ukonto || '-', budget_2025: Number(r.budget_2025 || 0), budget_2026: Number(r.budget_2026 || 0), utfall_ack: Number(r.utfall_ack || 0), diff: Number(r.diff || 0) }))) + ';';
                    html += 'function fmt(n) { return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n); }';
                    html += 'function toggleAll(state) { document.querySelectorAll("[data-ansvar]").forEach(function(cb) { cb.checked = state; }); filterRows(); }';
                    html += 'function filterRows() {';
                    html += '  var checked = []; document.querySelectorAll("[data-ansvar]:checked").forEach(function(cb) { checked.push(cb.getAttribute("data-ansvar")); });';
                    html += '  var filtered = allData.filter(function(r) { return checked.indexOf(r.ansvar) >= 0; });';
                    html += '  var t = { budget_2025: 0, budget_2026: 0, utfall_ack: 0, diff: 0 };';
                    html += '  var h = "<table><thead><tr><th>Ansvar</th><th>Ukonto</th><th class=\\"right\\">Budget 2025</th><th class=\\"right\\">Budget 2026</th><th class=\\"right\\">Utfall ack.</th><th class=\\"right\\">Diff</th></tr></thead><tbody>";';
                    html += '  filtered.forEach(function(r) {';
                    html += '    t.budget_2025 += r.budget_2025; t.budget_2026 += r.budget_2026; t.utfall_ack += r.utfall_ack; t.diff += r.diff;';
                    html += '    h += "<tr><td>" + r.ansvar + "</td><td>" + r.ukonto + "</td><td class=\\"right\\">" + fmt(r.budget_2025) + "</td><td class=\\"right\\">" + fmt(r.budget_2026) + "</td><td class=\\"right\\">" + fmt(r.utfall_ack) + "</td><td class=\\"right" + (r.diff < 0 ? " neg" : "") + "\\">" + fmt(r.diff) + "</td></tr>";';
                    html += '  });';
                    html += '  h += "<tr class=\\"total\\"><td colspan=\\"2\\">Totalt (" + filtered.length + " rader)</td><td class=\\"right\\">" + fmt(t.budget_2025) + "</td><td class=\\"right\\">" + fmt(t.budget_2026) + "</td><td class=\\"right\\">" + fmt(t.utfall_ack) + "</td><td class=\\"right\\">" + fmt(t.diff) + "</td></tr>";';
                    html += '  h += "</tbody></table>";';
                    html += '  document.getElementById("table-container").innerHTML = h;';
                    html += '}';
                    html += 'filterRows();';
                    html += '<\/script>';
                    html += '</body></html>';
                    popup.document.write(html);
                    popup.document.close();
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Visa budgetrader (öppnas i eget fönster)
                </Button>
              </>
            )}
          </>
        )}

        {!selectedCalcId && (
          <div className="text-center py-12 text-muted-foreground">
            Välj en kalkyl ovan för att börja jämföra med budget och utfall.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
