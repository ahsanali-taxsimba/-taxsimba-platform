"use client";
import { useState, useEffect } from "react";
import { useFetchMyFilesData, useFetchTaxReturnData } from "@/hooks/fetchData";
import Image from "next/image";
import { handleDownload } from "@/app/lib/downloadFiles";
import { FaAngleDown, FaAngleUp } from "react-icons/fa";
import { getFileIcon } from "@/utils/commonHelper";
import Link from "next/link";
import UploadDocuments from "@/app/dashboard/_components/taxTracker/UploadDocuments";


const MyDocuments = ({ sessionData, setTrackUpdate }) => {
  const [userFiles, setUserFiles] = useState([]);
  const [taxReturns, setTaxReturns] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const filesToDisplay = showAll ? userFiles : userFiles.slice(0, 10);
  const accessToken = sessionData?.accessToken;

  const handleShowAllToggle = () => {
    setShowAll(!showAll);
  };
  const clientFilesHandler = async () => {
    const token = sessionData?.accessToken;
    const apiResponse = await useFetchMyFilesData(token);
    if (apiResponse?.success && apiResponse?.data?.files?.documents?.length > 0) {
      setUserFiles(apiResponse?.data?.files?.documents);
    } else {
      setUserFiles([]);
    }
  };

  const loadTaxReturns = async () => {
    if (!accessToken) return;
    const data = await useFetchTaxReturnData(accessToken);
    setTaxReturns(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    clientFilesHandler();
    loadTaxReturns();
  }, [sessionData]);

  // Outstanding staff requests — surface upload here too (notification may land on My Documents).
  const outstandingByCase = (taxReturns || [])
    .map((item) => {
      const requiredDocs = (item?.files?.allFiles || []).filter(
        (f) => f.uploadStatus !== "completed",
      );
      return { item, requiredDocs };
    })
    .filter((row) => row.requiredDocs.length > 0);

  const completedFiles = (userFiles || []).filter(
    (f) => f.uploadStatus === "completed" || (f.status && f.status !== "Requested"),
  );
  const displayFiles = showAll ? completedFiles : completedFiles.slice(0, 10);

  return (
    <>
      <div className="edt_profile_box">
        <div className="edt_prof_head">
          <h3>My Documents</h3>
          <p>Your Financial Documents</p>
        </div>

        {outstandingByCase.length > 0 && (
          <div className="mb-4" data-testid="my-documents-outstanding-uploads">
            {outstandingByCase.map(({ item, requiredDocs }) => (
              <div key={item?.taxReturn?.id || item?.id} className="mb-3">
                <p className="small text-muted mb-2">
                  Outstanding request for {item?.taxReturn?.taxYear || "your tax return"}
                </p>
                <UploadDocuments
                  requiredDocs={requiredDocs}
                  item={item}
                  setTaxReturns={setTaxReturns}
                  setIsDocUpdated={() => {
                    void clientFilesHandler();
                    void loadTaxReturns();
                    if (typeof setTrackUpdate === "function") setTrackUpdate(true);
                  }}
                />
              </div>
            ))}
            <p className="small mt-2">
              Or open{" "}
              <Link href="/dashboard/tax-tracker" className="text-success fw-semibold">
                Tax Tracker
              </Link>{" "}
              to upload against your Self Assessment case.
            </p>
          </div>
        )}

        <div className="upload_box_wrapper">
          {displayFiles?.length > 0 &&
            displayFiles?.map((file, index) => {
              const fileIcon = getFileIcon(file);
              return (
                <div className="upload_pdf"
                  key={index}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleDownload(file.downloadUrl || file.previewUrl, file.filename)}
                >
                  <div className="top_upload_img">
                    <Image
                      src={fileIcon}
                      width={100}
                      height={100}
                      alt=""
                      style={{ height: "100%", width: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div className="upload_label">
                    <label>{file.filename}</label>
                  </div>
                </div>
              );
            })}
          {completedFiles.length === 0 && outstandingByCase.length === 0 && (
            <p className="text-muted">No documents uploaded yet.</p>
          )}
          {completedFiles.length > 10 && (
            <div className="upload_pdf show-all-container">
              <button onClick={handleShowAllToggle} className="show-all-button">
                {showAll ?
                  <>
                    <span className="bounce-up">
                      <FaAngleUp />
                    </span>
                    Show Less</> :
                  <>
                    Show All
                    <span className="bounce-down">
                      <FaAngleDown />
                    </span></>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MyDocuments;
