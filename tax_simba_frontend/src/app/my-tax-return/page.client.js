"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useFetchTaxReturnData } from "@/hooks/fetchData";
import TaxTracker from "@/app/dashboard/_components/taxTracker/TaxTracker";
import TaxReturnHistory from "@/components/re-used/TaxReturnHistory";
import axios from "axios";
import { Container } from "react-bootstrap";

/**
 * MyTaxReturnClient — Standalone full page at /my-tax-return.
 * Shows History + Work in Progress tabs with full layout.
 * No pathname conditionals.
 */
const MyTaxReturnClient = ({ serverSession }) => {
  const { data: sessionData, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [taxReturns, setTaxReturns] = useState([]);
  const [taxPrice, setTaxPrice] = useState(120);
  const [isRefresh, setIsRefresh] = useState(false);
  const [isDocUpdated, setIsDocUpdated] = useState(false);
  const [activeTab, setActiveTab] = useState("history");
  const [years, setYears] = useState([]);
  const [fromYear, setFromYear] = useState(new Date().getFullYear() - 1);
  const [toYear, setToYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2020;
    const yearList = [];
    for (let y = startYear; y <= currentYear + 1; y++) {
      yearList.push(y);
    }
    setYears(yearList);
  }, []);

  const handleTaxReturnData = async () => {
    setLoading(true);
    const data = await useFetchTaxReturnData(sessionData?.accessToken);
    if (data && data.length > 0) {
      setTaxReturns(data);
    } else {
      setTaxReturns([]);
    }
    setLoading(false);
  };

  const filteredTaxReturns = taxReturns.filter(item => {
    if (!item?.taxReturn?.taxYear) return true;
    const year = parseInt(item.taxReturn.taxYear);
    const from = parseInt(fromYear);
    const to = parseInt(toYear);
    return year >= from && year <= to;
  });

  const fetchTaxPrice = async () => {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}client/global-fee`,
        { headers: { Authorization: `Bearer ${sessionData?.accessToken}` } }
      );
      if (res.data.success) {
        setTaxPrice(parseInt(res?.data?.data?.globalFee?.baseFee));
      }
    } catch (err) {
      console.error("Error fetching tax price:", err);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && sessionData?.accessToken) {
      handleTaxReturnData();
      fetchTaxPrice();
    }
    if (isDocUpdated) setIsDocUpdated(false);
  }, [status, sessionData?.accessToken, isDocUpdated, isRefresh]);

  return (
    <div className="profile_page">
      <Container>
        <div className="edt_profile_box">
          <div className="edt_prof_head d-flex justify-content-between align-items-center">
            <h3>My Tax Return</h3>
            <div className="year-range-wrapper" style={{ cursor: "pointer" }}>
              <select 
                id="fromYear" 
                className="year-select" 
                value={fromYear}
                onChange={(e) => setFromYear(e.target.value)}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span>–</span>
              <select 
                id="toYear" 
                className="year-select"
                value={toYear}
                onChange={(e) => setToYear(e.target.value)}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <nav className="tax_return_nav">
            <div className="nav nav-tabs" id="nav-tab" role="tablist">
              <button
                className={`nav-link ${activeTab === "history" ? "active" : ""}`}
                type="button"
                onClick={() => setActiveTab("history")}
              >
                History
              </button>
              <button
                className={`nav-link ${activeTab === "progress" ? "active" : ""}`}
                type="button"
                onClick={() => setActiveTab("progress")}
              >
                Work in Progress
              </button>
            </div>
          </nav>

          {activeTab === "history" && (
            <TaxReturnHistory
              taxReturns={filteredTaxReturns}
              limit={null}
              loading={loading}
            />
          )}

          {activeTab === "progress" && (
            <TaxTracker
              serverSession={serverSession}
              setIsDocUpdated={setIsDocUpdated}
              taxPrice={taxPrice}
              setIsRefresh={setIsRefresh}
              isRefresh={isRefresh}
              fromYear={fromYear}
              toYear={toYear}
            />
          )}
        </div>
      </Container>
    </div>
  );
};

export default MyTaxReturnClient;
