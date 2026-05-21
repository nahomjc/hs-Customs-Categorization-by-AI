"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingWrap } from "./LandingWrap";
import { FadeInView, easeOut, fadeUp } from "./motion";

function TrafficLights() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
      <span className="w-3 h-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
      <span className="w-3 h-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
    </div>
  );
}

const mockDocs = [
  { name: "PL-Shipment-2841.xlsx", date: "Today", status: "Completed", statusClass: "bg-emerald-400/25 text-emerald-800 backdrop-blur-sm border border-emerald-200/40" },
  { name: "Packing_List_March.pdf", date: "Yesterday", status: "Classifying", statusClass: "bg-blue-400/25 text-blue-800 backdrop-blur-sm border border-blue-200/40" },
  { name: "Invoice_Lines_Q1.docx", date: "3 days ago", status: "Parsed", statusClass: "bg-amber-400/25 text-amber-800 backdrop-blur-sm border border-amber-200/40" },
];

export function DashboardPreviewSection() {
  return (
    <section
      id="dashboard-preview"
      className="landing-dashboard-preview-bg py-16 sm:py-24 border-t border-white/40"
    >
      <LandingWrap>
        <FadeInView className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <p className="text-sm font-medium text-[#007bff] mb-2">Dashboard</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Manage everything in one place
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            Upload packing lists, track classification progress, and export
            grouped HS files from a clean, focused workspace.
          </p>
        </FadeInView>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: easeOut }}
          className="landing-glass-window rounded-2xl overflow-hidden"
        >
          {/* macOS title bar */}
          <div className="landing-glass-titlebar flex items-center gap-4 px-4 py-3">
            <TrafficLights />
            <div className="flex-1 flex justify-center">
              <span className="text-xs font-medium text-gray-700 truncate max-w-[240px] sm:max-w-md">
                Impact Logistics — Dashboard
              </span>
            </div>
            <div className="w-[52px] shrink-0" aria-hidden />
          </div>

          {/* App chrome */}
          <div className="relative min-h-[420px] sm:min-h-[480px]">
            <div
              className="absolute inset-0 bg-gradient-to-br from-[#007bff]/8 via-transparent to-sky-400/10 pointer-events-none"
              aria-hidden
            />

            {/* In-app header */}
            <div className="landing-glass-header relative flex items-center justify-between gap-4 px-4 sm:px-5 py-3">
              <BrandLogo size="sm" className="min-w-0 max-w-[120px] sm:max-w-none" />
              <nav className="hidden sm:flex items-center gap-1">
                {["Dashboard", "Upload", "History"].map((label, i) => (
                  <span
                    key={label}
                    className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                      i === 0
                        ? "bg-[#007bff]/90 text-white shadow-sm shadow-blue-500/25"
                        : "text-gray-600 bg-white/40 border border-white/50"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </nav>
              <span className="text-[10px] text-gray-500 hidden md:block truncate max-w-[120px]">
                broker@company.com
              </span>
            </div>

            {/* Dashboard body */}
            <div className="relative p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Dashboard</h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Manage and track your packing list categorizations.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#007bff]/90 backdrop-blur-sm text-white text-xs font-semibold shrink-0 w-fit shadow-lg shadow-blue-500/25 border border-white/20">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <title>Upload</title>
                    <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Upload packing list
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { label: "Total documents", value: "24", color: "text-gray-900" },
                  { label: "Completed", value: "18", color: "text-emerald-600" },
                  { label: "Ready to download", value: "18", color: "text-[#007bff]" },
                ].map((stat) => (
                  <div key={stat.label} className="landing-glass-panel rounded-xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs text-gray-600 font-medium">
                      {stat.label}
                    </p>
                    <p className={`text-lg sm:text-2xl font-bold tabular-nums mt-0.5 ${stat.color}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="landing-glass-panel rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/50 flex items-center justify-between bg-white/25 backdrop-blur-sm">
                  <span className="text-xs font-semibold text-gray-900">
                    Recent documents
                  </span>
                  <span className="text-[10px] font-medium text-[#007bff]">
                    View all →
                  </span>
                </div>
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="text-gray-600 bg-white/20 backdrop-blur-sm">
                      <th className="px-4 py-2 font-medium">File</th>
                      <th className="px-4 py-2 font-medium w-20">Date</th>
                      <th className="px-4 py-2 font-medium w-24">Status</th>
                      <th className="px-4 py-2 font-medium w-16 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockDocs.map((doc) => (
                      <tr key={doc.name} className="border-t border-white/40">
                        <td className="px-4 py-2.5 font-medium text-gray-900 truncate max-w-[140px] sm:max-w-none">
                          {doc.name}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{doc.date}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${doc.statusClass}`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[#007bff] font-medium">View</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#007bff]/90 backdrop-blur-sm text-white text-sm font-semibold hover:bg-[#0069d9] transition-colors shadow-lg shadow-blue-500/25 border border-white/20"
          >
            Open your dashboard
          </Link>
        </motion.div>
      </LandingWrap>
    </section>
  );
}
