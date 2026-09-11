import { useState, useEffect } from "react";
import Link from "next/link";
import { useFetchTaxReturnData } from "@/hooks/fetchData";
import { FaDownload } from "react-icons/fa";

const TaxReturn = ({ sessionData, setTrackUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [taxReturns, setTaxReturns] = useState([]);

  const handleTaxReturnData = async () => {
    setLoading(true);
    const taxReturnData = await useFetchTaxReturnData(sessionData?.accessToken);
    if (taxReturnData && taxReturnData.length > 0) {
      setTaxReturns(taxReturnData[0]?.files?.allFiles || []);
    } else {
      setTaxReturns([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    handleTaxReturnData();
  }, []);

  return (
    <>
      <div className="edt_profile_box">
        <div className="edt_prof_head d-flex justify-content-between align-items-center">
          <h3>My Tax Return</h3>
          <Link className="text-decoration-underline" href="/my-tax-return">
            See all

          </Link>
        </div>

        {loading && <span className="loading-spinner">Loading...</span>}
        {taxReturns?.length > 0 ? (
          taxReturns.map((file, index) => {
            if (index > 1) {
              return;
            }
            return (
              <div className="tax_return_bx" key={index}>
                <div className="tax_retur_year">
                  <div className="tax_return_yr_left">
                    <h4>New Tax Return Year 2025/26</h4>
                    <p>
                      Your tax filing for the 2025–26 year has been successfully
                      completed.
                    </p>
                  </div>
                  <div className="tax_return_yr_right">
                    <span className="fill_date">
                      <i className="fa-regular fa-clock" /> Filed on 10th Nov
                    </span>
                  </div>
                </div>
                <div className="completed_assigned">
                  <div className="left_completed_part">
                    <figure>
                      <i className="fa-regular fa-circle-check" />
                    </figure>
                    <div className="dtls_cmpltd">
                      <h6>Completed on: <span className="theme-color">26/08/2025</span></h6>
                      <p>
                        Assigned accounted: Name surname <strong>4.8</strong>
                        <span className="single_star">
                          <i className="fa-solid fa-star" />
                        </span>
                      </p>
                    </div>
                  </div>
                  <button className="common-btn">
                    Download Certificate
                  </button>
                </div>
                <div className="taxt_rtn_del_wrapper">
                  <p>
                    TaxSimba sit amet, consectetur adipiscing elit, sed
                    do eiusmod tempor incididunt ut labore et dolore magna
                    aliqua.
                  </p>
                  <div className="upload_cntrol">
                    <a className="upload_cntrls_btn" href={file.downloadUrl || "javascript:void(0)"} target="_blank" rel="noreferrer">
                      <FaDownload size={16} className="text-secondary" />
                    </a>
                    <a className="upload_cntrls_btn" href="javascript:void(0)">
                      <img src="/images/del.png" alt="" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-tax-return">
            <p>No tax returns found.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default TaxReturn;
