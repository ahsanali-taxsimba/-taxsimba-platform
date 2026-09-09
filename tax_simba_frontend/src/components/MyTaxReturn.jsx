"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useFetchTaxReturnData } from "@/hooks/fetchData";
import TaxReturnHistory from "./re-used/TaxReturnHistory";
import axios from "axios";

/**
 * MyTaxReturn — Dashboard embedded widget.
 * Shows only the History tab with a limited number of records and a "See all" link.
 * No pathname conditionals — this component is always used inside the dashboard.
 */
const MyTaxReturn = ({ limit = 2 }) => {
  const { data: sessionData, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [taxReturns, setTaxReturns] = useState([]);

  const handleTaxReturnData = async () => {
    setLoading(true);
    const data = await useFetchTaxReturnData(sessionData?.accessToken);
    const realData = (data && data.length > 0) ? data : [];
    setTaxReturns(realData);
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated" && sessionData?.accessToken) {
      handleTaxReturnData();
    } else if (status === "unauthenticated" || status === "loading") {
      setTaxReturns([]);
      setLoading(false);
    }
  }, [status, sessionData?.accessToken]);

  return (
    <div className="edt_profile_box">
      <div className="edt_prof_head d-flex justify-content-between align-items-center">
        <h3>My Tax Return</h3>
        <Link href="/my-tax-return" className="see_all_link">
          See all

        </Link>
      </div>

      <nav className="tax_return_nav">
        <div className="nav nav-tabs" id="nav-tab" role="tablist">
          <button className="nav-link active" type="button">
            History
          </button>
        </div>
      </nav>

      <TaxReturnHistory
        taxReturns={taxReturns}
        limit={limit}
        loading={loading}
      />
    </div>
  );
};

export default MyTaxReturn;
