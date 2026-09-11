"use client";

import Loading from "@/app/loading";
import ReviewBox from "./ReviewBox";
import { useSession } from "next-auth/react";
import { jsPDF } from "jspdf";
import { FaDownload } from "react-icons/fa";


const TaxReturnHistory = ({ taxReturns, limit, loading }) => {
  const { data: sessionData, status } = useSession();
  const token = sessionData?.accessToken;
  const completedReturns =
    (taxReturns.length > 0 &&
      taxReturns.filter((file) => file?.taxReturn?.status === "completed")) ||
    [];


  const visibleReturns = limit
    ? completedReturns.slice(0, limit)
    : completedReturns;

  if (loading) {
    return <Loading />;
  }

  if (!visibleReturns.length) {
    return (
      <div className="no-tax-return">
        <p>No tax returns found.</p>
      </div>
    );
  }

  const downloadFile = async (downloadUrl, filename) => {
    if (!downloadUrl) {
      return;
    }

    try {
      const fileExtension = downloadUrl.split('.').pop().toLowerCase();

      // Check if it's an image (PNG, JPG, etc.)
      if (fileExtension === 'png' || fileExtension === 'jpg' || fileExtension === 'jpeg') {
        // Convert image to PDF
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const imgUrl = URL.createObjectURL(blob);

        const doc = new jsPDF();
        const img = new Image();
        img.src = imgUrl;

        img.onload = () => {
          // Add the image to the PDF
          doc.addImage(img, 'PNG', 10, 10);
          doc.save(filename || 'certificate.pdf'); // Download as PDF
        };
      } else if (fileExtension === 'pdf') {
        // For PDFs, fetch the file and trigger a download without previewing
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const fileUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = filename || 'certificate.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(fileUrl);
      } else if (fileExtension === 'docx' || fileExtension === 'doc') {
        // For PDFs, fetch the file and trigger a download without previewing
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const fileUrl = URL.createObjectURL(blob);
        const defaultFilename = fileExtension === 'docx' ? 'certificate.docx' : 'certificate.doc';
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = filename || defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(fileUrl);
      } else {
        console.error("Unsupported file type");
      }
    } catch (error) {
      console.error('Error downloading the file:', error);
    }
  };

  return (
    <>
      {visibleReturns.map((file, index) => {
        return (
          <div className="tax_return_bx" key={index}>
            <div className="tax_retur_year">
              <div className="tax_return_yr_left">
                <h4>New Tax Return Year {file?.taxReturn?.taxYear} <span>- {file?.taxReturn?.taxReturnId}</span></h4>
                <p>
                  Your tax filing for the {file?.taxReturn?.taxYear} year has been
                  successfully completed.
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
                  <i className="fa-regular fa-circle-check me-2" />
                </figure>
                <div className="dtls_cmpltd">
                  <h6>Completed on: <span className="theme-color">{file?.finalCertificate?.uploadedAt ? new Date(file.finalCertificate.uploadedAt).toLocaleDateString('en-GB') : "N/A"}</span></h6>
                  <div className="flex items-center gap-1">
                    <span className="text-muted">
                      Assigned accountant: {file?.accountant?.name || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="common-btn"
                onClick={() =>
                  downloadFile(
                    file?.finalCertificate?.downloadUrl,
                    file?.finalCertificate?.filename || 'certificate.pdf'
                  )
                }
              >
                <FaDownload className="me-2" />
                Download Certificate
              </button>
            </div>

            {/* Review box per return */}
            <ReviewBox file={file} token={token} />
          </div>
        )
      })}
    </>
  );
};

export default TaxReturnHistory;
