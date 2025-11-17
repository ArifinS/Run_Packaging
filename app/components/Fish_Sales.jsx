// app/Components/FishSalesTracker.jsx
"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Download,
  Plus,
  Trash2,
  Calculator,
  Menu,
  X,
} from "lucide-react";

export default function FishSalesTracker() {
  /* ────────────────────── CONFIG ────────────────────── */
  const BRANCHES = ["Khulna", "Bashundhara", "Shylet"];
  const RATES = { Small: 6, Big: 6.6 };
  const BRANCHES_WITH_TRANSPORT = ["Khulna", "Shylet"];
  const DEFAULT_TRANSPORT = 500;

  // Use ref to generate IDs only on client
  const idCounter = useRef(0);
  const generateId = () => `tx_${Date.now()}_${idCounter.current++}`;

  // Get today’s date safely (client-side only)
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toISOString().split("T")[0]);
  }, []);

  const formatDateForDisplay = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  /* ─────────────────── LOCAL STORAGE ─────────────────── */
  const loadFromStorage = () => {
    if (typeof window === "undefined") return { transactions: [], payments: [] };
    try {
      const t = localStorage.getItem("fishTransactions");
      const p = localStorage.getItem("fishPayments");
      return {
        transactions: t ? JSON.parse(t) : [],
        payments: p ? JSON.parse(p) : [],
      };
    } catch {
      return { transactions: [], payments: [] };
    }
  };

  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);

  // Load data only on client
  useEffect(() => {
    const data = loadFromStorage();
    setTransactions(data.transactions);
    setPayments(data.payments);
  }, []);

  // Save on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fishTransactions", JSON.stringify(transactions));
    }
  }, [transactions]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fishPayments", JSON.stringify(payments));
    }
  }, [payments]);

  /* ────────────────────── CALCS ────────────────────── */
  const price = (size, type) => (size || 0) * RATES[type];
  const total = (row) => {
    const p = price(row.size, row.rateType);
    const tr = BRANCHES_WITH_TRANSPORT.includes(row.branch)
      ? row.transport || 0
      : 0;
    return p + tr;
  };
  const grandTotal = transactions.reduce((s, t) => s + total(t), 0);
  const advanceTotal = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const due = grandTotal - advanceTotal;

  /* ────────────────────── CRUD ────────────────────── */
  const addTx = () => {
    const branch = BRANCHES[0];
    setTransactions((prev) => [
      ...prev,
      {
        id: generateId(),
        date: today,
        branch,
        size: 0,
        rateType: "Small",
        transport: BRANCHES_WITH_TRANSPORT.includes(branch)
          ? DEFAULT_TRANSPORT
          : 0,
        price: 0,
        total: 0,
      },
    ]);
  };

  const updateTx = (id, field, value) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const upd = {
          ...t,
          [field]:
            field === "size" || field === "transport"
              ? parseFloat(value) || 0
              : value,
        };
        if (field === "branch")
          upd.transport = BRANCHES_WITH_TRANSPORT.includes(value)
            ? DEFAULT_TRANSPORT
            : 0;
        upd.price = price(upd.size, upd.rateType);
        upd.total = total(upd);
        return upd;
      })
    );
  };

  const deleteTx = (id) =>
    setTransactions((prev) => prev.filter((t) => t.id !== id));

  const addPay = () =>
    setPayments((prev) => [
      ...prev,
      { id: generateId(), date: today, amount: 0 },
    ]);

  const updatePay = (id, field, value) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]:
                field === "amount" ? parseFloat(value) || 0 : value,
            }
          : p
      )
    );
  };

  const deletePay = (id) =>
    setPayments((prev) => prev.filter((p) => p.id !== id));

  /* ────────────────────── CSV ────────────────────── */
  const importCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const rows = (ev.target?.result).split("\n").map((l) => l.split(","));
        const imported = [];
        for (let i = 1; i < rows.length; i++) {
          const [date, branch = "Khulna", sizeStr, type = "Small"] = rows[i];
          if (!date?.trim()) continue;
          const sz = parseFloat(sizeStr) || 0;
          const tx = {
            id: generateId(),
            date: date.trim(),
            branch: branch.trim(),
            size: sz,
            rateType: type.trim() === "Big" ? "Big" : "Small",
            transport: BRANCHES_WITH_TRANSPORT.includes(branch.trim())
              ? DEFAULT_TRANSPORT
              : 0,
          };
          tx.price = price(tx.size, tx.rateType);
          tx.total = total(tx);
          imported.push(tx);
        }
        setTransactions(imported);
        alert(`${imported.length} rows imported`);
      } catch {
        alert("Invalid CSV – use: Date,Branch,Size,RateType");
      }
    };
    r.readAsText(file);
  };

  const exportCSV = () => {
    const head = [
      "Date",
      "Branch",
      "Size(kg)",
      "Rate Type",
      "Rate",
      "Price",
      "Transport",
      "Total",
    ];
    const rows = transactions.map((t) => [
      formatDateForDisplay(t.date),
      t.branch,
      t.size,
      t.rateType,
      RATES[t.rateType],
      t.price,
      BRANCHES_WITH_TRANSPORT.includes(t.branch) ? t.transport : 0,
      t.total,
    ]);
    const csv = [head, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fish_sales_${formatDateForDisplay(today)}.csv`;
    a.click();
  };

  const clearAll = () => {
    if (confirm("Delete ALL data?")) {
      setTransactions([]);
      setPayments([]);
      if (typeof window !== "undefined") {
        localStorage.removeItem("fishTransactions");
        localStorage.removeItem("fishPayments");
      }
    }
  };

  /* ────────────────────── MOBILE MENU ────────────────────── */
  const [mobileMenu, setMobileMenu] = useState(false);

  // Show loading state until client is ready
  if (!today) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-2 sm:px-4 md:px-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ───── HEADER ───── */}
        <header className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Calculator className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
             Run Packaging
            </h1>

            <div className="hidden sm:flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept=".csv" onChange={importCSV} className="hidden" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm font-medium transition">
                  <Upload className="w-4 h-4" /> Import
                </div>
              </label>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-medium transition"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-medium transition"
              >
                Clear
              </button>
            </div>

            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {mobileMenu && (
            <div className="mt-3 flex flex-col gap-2 sm:hidden">
              <label className="w-full">
                <input type="file" accept=".csv" onChange={importCSV} className="hidden" />
                <div className="flex items-center justify-center gap-2 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
                  <Upload className="w-4 h-4" /> Import CSV
                </div>
              </label>
              <button
                onClick={exportCSV}
                className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button
                onClick={clearAll}
                className="flex items-center justify-center gap-2 w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                Clear All
              </button>
            </div>
          )}
        </header>
        {/* ───── TRANSACTIONS ───── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">
              Sales Transactions
            </h2>
            <span className="text-xs text-green-600 font-medium">Auto‑saved</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-700">Date</th>
                  <th className="px-2 py-1.5 text-left font-medium text-gray-700">Branch</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-700 text-start">Quantity</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-700 text-start">Size</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-700">Rate</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-700">Price</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-700 text-start">Trans.</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-700">Total</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-gray-500 text-xs">
                      No transactions – tap <strong>Add Transaction</strong>
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const hasTr = BRANCHES_WITH_TRANSPORT.includes(t.branch);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <input
                            type="date"
                            value={t.date}
                            onChange={(e) => updateTx(t.id, "date", e.target.value)}
                            className="w-full px-1 py-0.5 border rounded text-xs focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={t.branch}
                            onChange={(e) => updateTx(t.id, "branch", e.target.value)}
                            className="w-full px-1 py-0.5 border rounded text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            {BRANCHES.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={t.size}
                            onChange={(e) => updateTx(t.id, "size", e.target.value)}
                            className="w-16 px-1 py-0.5 border rounded text-right text-xs focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={t.rateType}
                            onChange={(e) => updateTx(t.id, "rateType", e.target.value)}
                            className="w-full px-1 py-0.5 border rounded text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Small">Small (6)</option>
                            <option value="Big">Big (6.6)</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold text-indigo-600">
                          {RATES[t.rateType]}
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium text-indigo-700">
                          {t.price.toFixed(0)}
                        </td>
                        <td className="px-2 py-1.5">
                          {hasTr ? (
                            <input
                              type="number"
                              min="0"
                              value={t.transport}
                              onChange={(e) => updateTx(t.id, "transport", e.target.value)}
                              className="w-16 px-1 py-0.5 border rounded text-right text-xs focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            <span className="block w-16 text-center text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-bold text-green-700">
                          {t.total.toFixed(0)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => deleteTx(t.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-yellow-50 font-bold text-gray-800">
                  <td colSpan={7} className="px-2 py-1.5 text-right text-xs sm:text-sm">
                    Grand Total:
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm sm:text-base">
                    {grandTotal.toFixed(0)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-3 sm:p-4 border-t border-gray-200">
            <button
              onClick={addTx}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" /> Add Transaction
            </button>
          </div>
        </section>

        {/* ───── PAYMENTS + SUMMARY ───── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                Payments Received
              </h2>
              <span className="text-xs text-green-600 font-medium">Auto‑saved</span>
            </div>

            <div className="space-y-2">
              {payments.length === 0 ? (
                <p className="text-center py-4 text-gray-500 text-xs">No payments yet.</p>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <input
                      type="date"
                      value={p.date}
                      onChange={(e) => updatePay(p.id, "date", e.target.value)}
                      className="flex-1 px-2 py-1 border rounded text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="number"
                      min="0"
                      value={p.amount}
                      onChange={(e) => updatePay(p.id, "amount", e.target.value)}
                      className="w-20 px-2 py-1 border rounded text-right text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => deletePay(p.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={addPay}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition text-xs"
              >
                <Plus className="w-4 h-4" /> Add Payment
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm font-bold">
              <span>Total Advance:</span>
              <span className="text-green-700">{advanceTotal.toFixed(0)}</span>
            </div>
          </section>

          <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl shadow-lg p-4 text-white">
            <h2 className="text-lg font-bold mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-indigo-100">Total Sales</span>
                <span className="font-bold">{grandTotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-indigo-100">Advance Paid</span>
                <span className="font-bold">{advanceTotal.toFixed(0)}</span>
              </div>
              <div className="pt-3 border-t border-white/30">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Balance Due</span>
                  <span className="text-2xl font-bold text-yellow-300">
                    {due >= 0 ? due.toFixed(0) : `(${Math.abs(due).toFixed(0)})`}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}